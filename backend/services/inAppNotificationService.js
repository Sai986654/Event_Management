const { prisma } = require('../config/db');
const { sendEmail } = require('./notificationService');

function emitToUser(io, userId, payload) {
  if (!io) return;
  io.to(`user-${userId}`).emit('notification:new', payload);
}

/**
 * @param {import('@prisma/client').PrismaClient} _
 */
async function createNotification(io, { userId, type, title, body, metadata = {} }) {
  const row = await prisma.appNotification.create({
    data: { userId, type, title, body, metadata },
  });
  emitToUser(io, userId, { notification: row });
  return row;
}

async function getAdmins() {
  return prisma.user.findMany({
    where: { role: 'admin', isActive: true },
    select: { id: true, email: true },
  });
}

async function getAdminUserIds() {
  const admins = await getAdmins();
  return admins.map((a) => a.id);
}

function eventDetailLines(event, creator) {
  const d = event.date ? new Date(event.date).toISOString() : '';
  return [
    `Title: ${event.title}`,
    `Type: ${event.type}`,
    `Date: ${d}`,
    `Venue: ${event.venue}`,
    event.address ? `Address: ${event.address}` : null,
    [event.city, event.state].filter(Boolean).length ? `Location: ${[event.city, event.state].filter(Boolean).join(', ')}` : null,
    event.description ? `Description: ${event.description}` : null,
    `Guest count: ${event.guestCount ?? 0}`,
    `Budget: ${event.budget ?? 0}`,
    `Status: ${event.status}`,
    `Created by: ${creator.name} <${creator.email}> (role: ${creator.role})`,
    `Organizer user ID: ${event.organizerId}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function eventHtmlBlock(event, creator) {
  const text = eventDetailLines(event, creator);
  return text.replace(/\n/g, '<br/>');
}

/**
 * Customer/organizer creates an event — notify admins, organizer (creator), optional vendors.
 */
async function dispatchEventCreated(io, event, creator, concernedVendorIds = []) {
  const ids = Array.isArray(concernedVendorIds)
    ? concernedVendorIds.map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const title = `New event: ${event.title}`;
  const bodyText = eventDetailLines(event, creator);
  const meta = { eventId: event.id, slug: event.slug, type: 'event_created' };

  const admins = await getAdmins();
  for (const a of admins) {
    await createNotification(io, {
      userId: a.id,
      type: 'event_created',
      title: `[Admin] ${title}`,
      body: bodyText,
      metadata: { ...meta, audience: 'admin' },
    });
    await sendEmail({
      to: a.email,
      subject: `[Vedika 360 Admin] ${event.title}`,
      html: `<p>A new event was created.</p><div style="font-family:sans-serif">${eventHtmlBlock(event, creator)}</div>`,
    }).catch(() => {});
  }

  await createNotification(io, {
    userId: creator.id,
    type: 'event_created',
    title: 'Event created successfully',
    body: bodyText,
    metadata: { ...meta, audience: 'organizer' },
  });
  await sendEmail({
    to: creator.email,
    subject: `Event created: ${event.title}`,
    html: `<p>Your event is saved. Details:</p><div style="font-family:sans-serif">${eventHtmlBlock(event, creator)}</div>`,
  }).catch(() => {});

  const seenVendorUsers = new Set();
  for (const vid of ids) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vid },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (!vendor?.user) continue;
    if (seenVendorUsers.has(vendor.userId)) continue;
    seenVendorUsers.add(vendor.userId);

    const vTitle = `New event request: ${event.title}`;
    const vBody = `${bodyText}\n\nYou were listed as a concerned vendor for this event. Business: ${vendor.businessName}`;
    await createNotification(io, {
      userId: vendor.userId,
      type: 'event_created',
      title: vTitle,
      body: vBody,
      metadata: { ...meta, audience: 'vendor', vendorId: vendor.id },
    });
    await sendEmail({
      to: vendor.user.email,
      subject: `[Vedika 360] Event ${event.title} — action may be needed`,
      html: `<p>Hello ${vendor.businessName},</p><p>An event was created and you are listed as a concerned vendor.</p><div style="font-family:sans-serif">${eventHtmlBlock(event, creator)}</div>`,
    }).catch(() => {});
  }

  return { notifiedAdmins: admins.length, notifiedVendors: seenVendorUsers.size };
}

async function dispatchBookingCreated(io, booking, extras = {}) {
  const event = await prisma.event.findUnique({ where: { id: booking.eventId } });
  const organizer = await prisma.user.findUnique({ where: { id: booking.organizerId } });
  const vendor = await prisma.vendor.findUnique({
    where: { id: booking.vendorId },
    include: { user: true },
  });
  if (!event || !organizer || !vendor?.user) return;

  const creator = extras.creatorUser || organizer;
  const lines = [
    `Event: ${event.title} (#${event.id})`,
    `Service date: ${new Date(booking.serviceDate).toISOString()}`,
    `Price: ${booking.price}`,
    `Status: ${booking.status}`,
    `Vendor: ${vendor.businessName}`,
    `Booked by: ${creator.name} <${creator.email}>`,
    booking.notes ? `Notes: ${booking.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const meta = { eventId: event.id, bookingId: booking.id, vendorId: vendor.id, type: 'booking_created' };

  for (const uid of await getAdminUserIds()) {
    await createNotification(io, {
      userId: uid,
      type: 'booking_created',
      title: `[Admin] Booking: ${event.title}`,
      body: lines,
      metadata: { ...meta, audience: 'admin' },
    });
  }

  await createNotification(io, {
    userId: organizer.id,
    type: 'booking_created',
    title: `Booking confirmed: ${vendor.businessName}`,
    body: lines,
    metadata: { ...meta, audience: 'organizer' },
  });

  await createNotification(io, {
    userId: vendor.userId,
    type: 'booking_created',
    title: `New booking for ${event.title}`,
    body: lines,
    metadata: { ...meta, audience: 'vendor' },
  });

  await sendEmail({ to: organizer.email, subject: `Booking: ${vendor.businessName}`, html: `<pre style="font-family:sans-serif">${lines.replace(/\n/g, '<br/>')}</pre>` }).catch(() => {});
  await sendEmail({ to: vendor.user.email, subject: `New booking — ${event.title}`, html: `<pre style="font-family:sans-serif">${lines.replace(/\n/g, '<br/>')}</pre>` }).catch(() => {});
}

async function dispatchOrderQuoted(io, order, event, customer, items = []) {
  const organizer = await prisma.user.findUnique({ where: { id: order.organizerId } });
  if (!organizer) return;

  const vendorIds = [...new Set(items.map((i) => i.vendorId))];
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds } },
    include: { user: { select: { id: true, email: true } } },
  });

  const lines = [
    `Event: ${event.title} (#${event.id})`,
    `Order #${order.id}`,
    `Status: ${order.status}`,
    `Quoted total: ${order.quotedTotal}`,
    `Customer: ${customer.name} <${customer.email}>`,
    `Organizer: ${organizer.name} <${organizer.email}>`,
    `Packages: ${items.length}`,
  ].join('\n');

  const meta = { eventId: event.id, orderId: order.id, type: 'order_quoted' };

  const adminIds = await getAdminUserIds();
  const tasks = adminIds.map((uid) =>
    createNotification(io, {
      userId: uid,
      type: 'order_quoted',
      title: `[Admin] Quote placed: ${event.title}`,
      body: lines,
      metadata: { ...meta, audience: 'admin' },
    })
  );

  tasks.push(
    createNotification(io, {
      userId: organizer.id,
      type: 'order_quoted',
      title: `New vendor quote: ${event.title}`,
      body: lines,
      metadata: { ...meta, audience: 'organizer' },
    })
  );

  if (customer.id !== organizer.id) {
    tasks.push(
      createNotification(io, {
        userId: customer.id,
        type: 'order_quoted',
        title: `Quote ready: ${event.title}`,
        body: lines,
        metadata: { ...meta, audience: 'customer' },
      })
    );
  }

  for (const v of vendors) {
    tasks.push(
      createNotification(io, {
        userId: v.userId,
        type: 'order_quoted',
        title: `Included in quote — ${event.title}`,
        body: `${lines}\n\nYour business: ${v.businessName}`,
        metadata: { ...meta, audience: 'vendor', vendorId: v.id },
      })
    );
  }

  await Promise.all(tasks);
}

/**
 * Guest uploaded a remote-blessing photo from the public page — notify organizer (and admins).
 */
async function dispatchRemoteBlessingUploaded(io, { event, media, guestName }) {
  if (!event?.organizerId) return;
  const organizer = await prisma.user.findUnique({ where: { id: event.organizerId } });
  if (!organizer) return;

  const who = guestName && String(guestName).trim() ? String(guestName).trim() : 'A guest';
  const lines = [
    `${who} uploaded a remote blessing photo for "${event.title}".`,
    `Include it in your review / AI collage workflow.`,
    media?.id ? `Media ID: ${media.id}` : null,
    event.slug ? `Public page: /public/${event.slug}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const meta = {
    eventId: event.id,
    mediaId: media?.id,
    type: 'remote_blessing_uploaded',
  };

  await createNotification(io, {
    userId: organizer.id,
    type: 'remote_blessing',
    title: `Remote blessing photo — ${event.title}`,
    body: lines,
    metadata: { ...meta, audience: 'organizer' },
  });
  await sendEmail({
    to: organizer.email,
    subject: `[Vedika 360] Remote blessing photo — ${event.title}`,
    html: `<p>${lines.replace(/\n/g, '<br/>')}</p>`,
  }).catch(() => {});

  for (const uid of await getAdminUserIds()) {
    await createNotification(io, {
      userId: uid,
      type: 'remote_blessing',
      title: `[Admin] Remote blessing — ${event.title}`,
      body: lines,
      metadata: { ...meta, audience: 'admin' },
    });
  }
}

module.exports = {
  createNotification,
  getAdminUserIds,
  dispatchEventCreated,
  dispatchBookingCreated,
  dispatchOrderQuoted,
  dispatchRemoteBlessingUploaded,
  eventDetailLines,
};
