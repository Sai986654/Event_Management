const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/chat/threads — list threads the user participates in
exports.getThreads = asyncHandler(async (req, res) => {
  const threads = await prisma.chatThread.findMany({
    where: {
      OR: [
        { creatorId: req.user.id },
        { participants: { some: { userId: req.user.id } } },
      ],
    },
    include: {
      creator: { select: { id: true, name: true, role: true } },
      participants: { select: { userId: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { id: true, name: true } } } },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({ threads });
});

// POST /api/chat/threads — create a new support thread
exports.createThread = asyncHandler(async (req, res) => {
  const { subject, message } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ message: 'Subject and message are required' });
  }

  const thread = await prisma.chatThread.create({
    data: {
      subject: subject.trim(),
      creatorId: req.user.id,
      participants: {
        create: { userId: req.user.id },
      },
      messages: {
        create: { senderId: req.user.id, body: message.trim() },
      },
    },
    include: {
      creator: { select: { id: true, name: true, role: true } },
      messages: { include: { sender: { select: { id: true, name: true } } } },
      _count: { select: { messages: true } },
    },
  });

  // Auto-add admins and organizers to the thread so they can see and reply
  const staffUsers = await prisma.user.findMany({
    where: { role: { in: ['admin', 'organizer'] }, isActive: true, id: { not: req.user.id } },
    select: { id: true },
  });
  if (staffUsers.length > 0) {
    await prisma.chatParticipant.createMany({
      data: staffUsers.map((u) => ({ threadId: thread.id, userId: u.id })),
      skipDuplicates: true,
    });
  }

  // Send response immediately so the client doesn't time out
  res.status(201).json({ thread });

  // Fire-and-forget: socket notifications + in-app notifications
  try {
    const io = req.app.get('io');
    const allParticipantIds = [req.user.id, ...staffUsers.map((u) => u.id)];
    allParticipantIds.forEach((uid) => {
      io.to(`user-${uid}`).emit('chat:new-thread', thread);
    });

    const { createNotification } = require('../services/inAppNotificationService');
    for (const staff of staffUsers) {
      await createNotification(io, {
        userId: staff.id,
        type: 'chat_new',
        title: 'New Support Chat',
        body: `${req.user.name || 'A user'} started a chat: "${subject.trim()}"`,
        metadata: { threadId: thread.id },
      });
    }
  } catch (err) {
    console.error('Chat notification error (non-blocking):', err.message);
  }
});

// GET /api/chat/threads/:threadId/messages — get messages for a thread
exports.getMessages = asyncHandler(async (req, res) => {
  const threadId = Number(req.params.threadId);

  // Verify participation
  const thread = await prisma.chatThread.findFirst({
    where: {
      id: threadId,
      OR: [
        { creatorId: req.user.id },
        { participants: { some: { userId: req.user.id } } },
      ],
    },
  });
  if (!thread) return res.status(404).json({ message: 'Thread not found' });

  const messages = await prisma.chatMessage.findMany({
    where: { threadId },
    include: { sender: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ messages, thread });
});

// POST /api/chat/threads/:threadId/messages — send a message
exports.sendMessage = asyncHandler(async (req, res) => {
  const threadId = Number(req.params.threadId);
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ message: 'Message body is required' });

  // Verify participation
  const thread = await prisma.chatThread.findFirst({
    where: {
      id: threadId,
      OR: [
        { creatorId: req.user.id },
        { participants: { some: { userId: req.user.id } } },
      ],
    },
  });
  if (!thread) return res.status(404).json({ message: 'Thread not found' });

  const message = await prisma.chatMessage.create({
    data: { threadId, senderId: req.user.id, body: body.trim() },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });

  // Update thread timestamp
  await prisma.chatThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });

  // Send response immediately so the client doesn't time out
  res.status(201).json({ message });

  // Fire-and-forget: socket + in-app notifications
  try {
    const io = req.app.get('io');
    io.to(`chat-${threadId}`).emit('chat:message', message);

    const participants = await prisma.chatParticipant.findMany({
      where: { threadId },
      select: { userId: true },
    });
    const { createNotification } = require('../services/inAppNotificationService');
    for (const p of participants) {
      if (p.userId !== req.user.id) {
        io.to(`user-${p.userId}`).emit('chat:message', message);
        await createNotification(io, {
          userId: p.userId,
          type: 'chat_message',
          title: `Chat: ${thread.subject}`,
          body: `${req.user.name || 'Someone'}: ${body.trim().slice(0, 100)}`,
          metadata: { threadId },
        });
      }
    }
  } catch (err) {
    console.error('Chat notification error (non-blocking):', err.message);
  }
});

// PATCH /api/chat/threads/:threadId/close — close a thread
exports.closeThread = asyncHandler(async (req, res) => {
  const threadId = Number(req.params.threadId);
  const thread = await prisma.chatThread.findUnique({ where: { id: threadId } });
  if (!thread) return res.status(404).json({ message: 'Thread not found' });

  if (thread.creatorId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const updated = await prisma.chatThread.update({
    where: { id: threadId },
    data: { status: 'closed' },
  });

  const io = req.app.get('io');
  io.to(`chat-${threadId}`).emit('chat:thread-closed', { threadId });

  res.json({ thread: updated });
});
