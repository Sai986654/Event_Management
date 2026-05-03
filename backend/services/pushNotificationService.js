const { prisma } = require('../config/db');

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

function isExpoPushToken(value) {
  return /^ExponentPushToken\[[^\]]+\]$|^ExpoPushToken\[[^\]]+\]$/.test(String(value || ''));
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function deactivateToken(expoPushToken) {
  await prisma.pushToken.updateMany({
    where: { expoPushToken },
    data: { isActive: false },
  });
}

async function sendExpoPushBatch(messages) {
  const response = await fetch(EXPO_PUSH_API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Expo push request failed with status ${response.status}`);
  }

  return response.json();
}

async function sendPushToUser(userId, { title, body, data = {} }) {
  const tokens = await prisma.pushToken.findMany({
    where: { userId, isActive: true },
    select: { expoPushToken: true },
  });

  const validTokens = tokens
    .map((item) => item.expoPushToken)
    .filter((token) => isExpoPushToken(token));

  if (!validTokens.length) {
    return { sent: 0 };
  }

  const messages = validTokens.map((to) => ({
    to,
    sound: 'default',
    title,
    body,
    data,
    priority: 'high',
    channelId: 'default',
  }));

  let sent = 0;
  for (const batch of chunk(messages, 100)) {
    const result = await sendExpoPushBatch(batch);
    const items = Array.isArray(result?.data) ? result.data : [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (item?.status === 'ok') {
        sent += 1;
        continue;
      }

      const errorCode = item?.details?.error;
      if (errorCode === 'DeviceNotRegistered') {
        await deactivateToken(batch[index]?.to);
      }
    }
  }

  return { sent };
}

module.exports = {
  isExpoPushToken,
  sendPushToUser,
};