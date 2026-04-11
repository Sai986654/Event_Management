const https = require('https');

/**
 * Messaging service abstraction (IMessageService pattern).
 *
 * Supports multiple providers via MESSAGING_PROVIDER env var:
 *   - 'log'       : Console-only (dev/testing)
 *   - 'whatsapp'  : WhatsApp Business API (generic)
 *   - 'twilio'    : Twilio WhatsApp API
 *
 * Implement additional providers by adding a class below.
 */

/* ── Interface ──────────────────────────────────────────────── */

class IMessageService {
  /**
   * @param {string} phone - E.164 phone number (e.g. '919999999999')
   * @param {string} message - Message text
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
   */
  async sendMessage(phone, message) {
    throw new Error('sendMessage() not implemented');
  }
}

/* ── Console Logger (development) ───────────────────────────── */

class LogMessageService extends IMessageService {
  async sendMessage(phone, message) {
    console.log(`[MSG→${phone}] ${message}`);
    return { success: true, messageId: `log-${Date.now()}` };
  }
}

/* ── Generic WhatsApp Business API ──────────────────────────── */

class WhatsAppMessageService extends IMessageService {
  constructor() {
    super();
    this.apiUrl = process.env.WHATSAPP_API_URL;       // e.g. https://graph.facebook.com/v18.0/{phone_number_id}/messages
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  }

  async sendMessage(phone, message) {
    if (!this.apiUrl || !this.accessToken) {
      throw new Error('WHATSAPP_API_URL and WHATSAPP_ACCESS_TOKEN are required');
    }

    const body = JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: message },
    });

    return new Promise((resolve, reject) => {
      const url = new URL(this.apiUrl);
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const data = JSON.parse(Buffer.concat(chunks).toString());
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, messageId: data.messages?.[0]?.id });
            } else {
              resolve({ success: false, error: JSON.stringify(data.error || data) });
            }
          });
        }
      );
      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.end(body);
    });
  }
}

/* ── Twilio WhatsApp ────────────────────────────────────────── */

class TwilioMessageService extends IMessageService {
  constructor() {
    super();
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_WHATSAPP_FROM; // e.g. whatsapp:+14155238886
  }

  async sendMessage(phone, message) {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      throw new Error('TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM are required');
    }

    const toNum = phone.startsWith('+') ? phone : `+${phone}`;
    const body = new URLSearchParams({
      To: `whatsapp:${toNum}`,
      From: this.fromNumber,
      Body: message,
    }).toString();

    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.twilio.com',
          path: `/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const data = JSON.parse(Buffer.concat(chunks).toString());
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, messageId: data.sid });
            } else {
              resolve({ success: false, error: data.message || JSON.stringify(data) });
            }
          });
        }
      );
      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.end(body);
    });
  }
}

/* ── Factory ────────────────────────────────────────────────── */

function createMessageService() {
  const provider = (process.env.MESSAGING_PROVIDER || 'log').toLowerCase();
  switch (provider) {
    case 'whatsapp':
      return new WhatsAppMessageService();
    case 'twilio':
      return new TwilioMessageService();
    case 'log':
    default:
      return new LogMessageService();
  }
}

/** Singleton instance */
const messagingService = createMessageService();

module.exports = { messagingService, createMessageService, IMessageService };
