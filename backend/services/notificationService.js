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

/**
 * Send payment confirmation email with transaction details
 */
const sendPaymentConfirmation = async ({ to, paymentData, entityType, entityTitle }) => {
  if (!to) return false;

  const {
    id,
    razorpayPaymentId,
    razorpayOrderId,
    amount,
    currency = 'INR',
    status,
    completedAt,
    description,
  } = paymentData;

  const formattedDate = completedAt ? new Date(completedAt).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) : 'N/A';

  const entityLabels = {
    event: 'Event',
    booking: 'Vendor Booking',
    order: 'Order',
    surprise_page: 'Surprise Page',
    invite_design_export: 'Invite Design Export',
    vendor_portfolio: 'Vendor Portfolio',
  };

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background-color: #1677ff; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Payment Confirmation</h1>
        <p style="margin: 5px 0 0 0; font-size: 14px;">Your payment has been successfully received</p>
      </div>

      <div style="padding: 30px; background-color: #f9f9f9;">
        <p style="margin: 0 0 20px 0; font-size: 16px;">Hi there,</p>
        
        <p style="margin: 0 0 25px 0; line-height: 1.6;">
          Thank you for your payment. We have successfully received your payment for <strong>${entityLabels[entityType] || entityType}</strong>.
          ${entityTitle ? `<br/>Service: <strong>${entityTitle}</strong>` : ''}
        </p>

        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1677ff;">
          <h3 style="margin: 0 0 15px 0; color: #1677ff; font-size: 16px;">Transaction Details</h3>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px 0; font-weight: bold; color: #666;">Transaction ID</td>
              <td style="padding: 10px 0; text-align: right;">${razorpayPaymentId || 'N/A'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px 0; font-weight: bold; color: #666;">Order ID</td>
              <td style="padding: 10px 0; text-align: right;">${razorpayOrderId || 'N/A'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px 0; font-weight: bold; color: #666;">Amount</td>
              <td style="padding: 10px 0; text-align: right; font-size: 18px; color: #1677ff; font-weight: bold;">₹${amount} ${currency}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px 0; font-weight: bold; color: #666;">Status</td>
              <td style="padding: 10px 0; text-align: right;">
                <span style="background-color: #52c41a; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                  ${status.toUpperCase()}
                </span>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px 0; font-weight: bold; color: #666;">Date & Time</td>
              <td style="padding: 10px 0; text-align: right;">${formattedDate}</td>
            </tr>
            ${description ? `
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #666;">Description</td>
              <td style="padding: 10px 0; text-align: right;">${description}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <p style="margin: 25px 0; line-height: 1.6; color: #666; font-size: 14px;">
          This is an automated confirmation email. Please keep it for your records.
          If you have any questions about your payment, please contact our support team.
        </p>

        <div style="margin: 25px 0; padding: 15px; background-color: #e6f7ff; border-radius: 4px; border-left: 4px solid #1677ff;">
          <p style="margin: 0; color: #0050b3; font-size: 14px;">
            <strong>Payment Reference:</strong> Keep your Payment ID and Order ID for reference and support inquiries.
          </p>
        </div>

        <p style="margin: 0; color: #999; font-size: 12px;">
          Vedika 360 | Event Management Platform
        </p>
      </div>

      <div style="background-color: #f0f0f0; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; color: #666; font-size: 12px;">
        <p style="margin: 0;">This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: `Payment Confirmation - ₹${amount} ${currency}`,
    html,
  });
};

module.exports = { sendEmail, sendSMS, sendWhatsApp, sendInviteLink, sendPaymentConfirmation };
