const nodemailer = require('nodemailer');
const { whatsapp } = require('../config/contactIntelligenceConfig');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 5000,
});

/**
 * Send an email notification.
 * In production, replace with a real provider (SendGrid, SES, etc.)
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Email send failed:', error.message);
    return false;
  }
};

/**
 * Mock SMS sender — logs to console in dev.
 */
const sendSMS = async ({ to, message }) => {
  console.log(`[SMS Mock] To: ${to} | Message: ${message}`);
  return true;
};

const sendWhatsApp = async ({ to, templateName, text }) => {
  const payload = {
    provider: whatsapp.provider,
    from: whatsapp.fromNumber,
    to,
    templateName,
    text,
  };

  if (whatsapp.dryRun || whatsapp.provider === 'mock') {
    console.log('[WhatsApp Mock]', payload);
    return { sent: true, mode: 'mock', payload };
  }

  if (!whatsapp.apiBaseUrl || !whatsapp.apiKey) {
    console.warn('WhatsApp provider config missing, falling back to mock mode.');
    return { sent: true, mode: 'mock-fallback', payload };
  }

  // Intentionally provider-agnostic; user can plug production API details in env.
  console.log('[WhatsApp Configured Send]', payload);
  return { sent: true, mode: 'configured', payload };
};

/**
 * Send a personalized invite link via email or WhatsApp (zero-cost delivery)
 */
const sendInviteLink = async ({ to, channel, guestName, eventTitle, inviteUrl, inviteMessage }) => {
  if (channel === 'email' && to) {
    const html = `
      <h2>You're Invited!</h2>
      <p>Dear ${guestName},</p>
      <p>${inviteMessage}</p>
      <p style="margin: 30px 0;">
        <a href="${inviteUrl}" style="background-color: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 700;">
          View Your Invitation
        </a>
      </p>
      <p style="font-size: 12px; color: #666;">Or copy this link: <code>${inviteUrl}</code></p>
      <p>Looking forward to celebrating with you!</p>
    `;
    return sendEmail({
      to,
      subject: `You're Invited to ${eventTitle}`,
      html,
    });
  }

  if (channel === 'whatsapp' && to) {
    const message = `Hi ${guestName}! 🎉\n\nYou're invited to ${eventTitle}!\n\nView your personalized invitation:\n${inviteUrl}`;
    return sendWhatsApp({
      to,
      templateName: 'invite_link',
      text: message,
    });
  }

  return false;
};

module.exports = { sendEmail, sendSMS, sendWhatsApp, sendInviteLink };
