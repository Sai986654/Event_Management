/**
 * Vendor Registration Email Template Service
 * 
 * Sends automated emails to vendors at different stages of registration
 */

const nodemailer = require('nodemailer');

/**
 * Email template for form submission confirmation
 */
const getFormSubmissionTemplate = (vendor) => {
  return {
    subject: `Welcome to Vedika 360, ${vendor.businessName}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f0f4f8; padding: 20px; border-radius: 10px;">
          <h2 style="color: #2c3e50;">Thank You for Registering! ✨</h2>
          
          <p>Hi ${vendor.name || 'Vendor'},</p>
          
          <p>We've received your vendor registration for <strong>${vendor.businessName}</strong>. 
          Our team is reviewing your application and will get back to you soon.</p>
          
          <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Business Name:</strong> ${vendor.businessName}</p>
            <p style="margin: 5px 0;"><strong>Category:</strong> ${vendor.category}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${vendor.contactEmail}</p>
          </div>
          
          <h3 style="color: #2c3e50; margin-top: 30px;">What's Next?</h3>
          <ol>
            <li><strong>Review:</strong> Our team will review your application (usually 24-48 hours)</li>
            <li><strong>Approval:</strong> You'll receive an email with your login credentials</li>
            <li><strong>Setup:</strong> Complete your vendor profile and upload samples</li>
            <li><strong>Launch:</strong> Start receiving bookings!</li>
          </ol>
          
          <div style="background-color: #e8f4f8; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>💡 Tip:</strong> Make sure to keep your portfolio samples ready. 
            You can upload photos and videos once your account is activated.</p>
          </div>
          
          <p style="margin-top: 30px; color: #666;">
            Questions? Contact us at <a href="mailto:support@vedika360.com">support@vedika360.com</a>
          </p>
          
          <div style="border-top: 1px solid #ddd; margin-top: 30px; padding-top: 20px; text-align: center; color: #999; font-size: 12px;">
            <p>© 2024 Vedika 360. All rights reserved.</p>
          </div>
        </div>
      </div>
    `,
  };
};

/**
 * Email template for vendor approval
 */
const getApprovalTemplate = (vendor, credentials) => {
  return {
    subject: `🎉 Your Vedika 360 Vendor Account is Approved!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f0f4f8; padding: 20px; border-radius: 10px;">
          <h2 style="color: #27ae60;">Your Account is Ready! 🎉</h2>
          
          <p>Hi ${vendor.name || 'Vendor'},</p>
          
          <p>Great news! Your <strong>${vendor.businessName}</strong> vendor account has been approved 
          and is ready to go live on Vedika 360.</p>
          
          <h3 style="color: #2c3e50; margin-top: 30px;">Your Login Credentials</h3>
          <div style="background-color: white; padding: 20px; border-radius: 8px; border: 2px solid #27ae60;">
            <p style="margin: 10px 0;"><strong>Email:</strong> ${credentials.email}</p>
            <p style="margin: 10px 0;"><strong>Temporary Password:</strong> <code style="background-color: #f5f5f5; padding: 5px 10px; border-radius: 4px; font-family: monospace;">${credentials.tempPassword}</code></p>
            <p style="margin: 10px 0; font-size: 12px; color: #e74c3c;">⚠️ <strong>Important:</strong> Change this password after first login for security</p>
          </div>
          
          <h3 style="color: #2c3e50; margin-top: 30px;">Quick Start Guide</h3>
          <div style="background-color: #ecf0f1; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <ol style="margin: 10px 0; padding-left: 20px;">
              <li>Visit: <a href="https://vendor.vedika360.com/login" style="color: #2980b9;">vendor.vedika360.com/login</a></li>
              <li>Log in with your email and temporary password</li>
              <li>Change your password immediately</li>
              <li>Complete your vendor profile</li>
              <li>Upload portfolio samples (photos & videos)</li>
              <li>Create your service packages</li>
              <li>Enable notifications</li>
              <li>Start receiving bookings!</li>
            </ol>
          </div>
          
          <h3 style="color: #2c3e50;">Next Steps</h3>
          <p><strong>Complete Your Profile:</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Add business description</li>
            <li>Update contact information</li>
            <li>Set your service packages and pricing</li>
            <li>Upload 5-10 portfolio samples</li>
            <li>Add customer testimonials</li>
          </ul>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>📧 Pro Tip:</strong> Enable email notifications to get alerts 
            when customers request your services. Respond quickly for better conversion rates!</p>
          </div>
          
          <h3 style="color: #2c3e50; margin-top: 30px;">Support</h3>
          <p>Need help? We're here for you!</p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Email:</strong> <a href="mailto:support@vedika360.com">support@vedika360.com</a></li>
            <li><strong>Phone:</strong> +91-XXX-XXX-XXXX</li>
            <li><strong>Help Center:</strong> <a href="https://help.vedika360.com">help.vedika360.com</a></li>
          </ul>
          
          <p style="margin-top: 30px; color: #666;">
            Welcome to the Vedika 360 vendor community! We're excited to have you on board.
          </p>
          
          <div style="border-top: 1px solid #ddd; margin-top: 30px; padding-top: 20px; text-align: center; color: #999; font-size: 12px;">
            <p>© 2024 Vedika 360. All rights reserved.</p>
          </div>
        </div>
      </div>
    `,
  };
};

/**
 * Email template for rejection
 */
const getRejectionTemplate = (vendor, reason) => {
  return {
    subject: `Your Vedika 360 Vendor Application`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f0f4f8; padding: 20px; border-radius: 10px;">
          <h2 style="color: #2c3e50;">Application Review Complete</h2>
          
          <p>Hi ${vendor.name || 'Vendor'},</p>
          
          <p>Thank you for your interest in joining Vedika 360. We've reviewed your application for 
          <strong>${vendor.businessName}</strong>, and unfortunately, we're unable to move forward at this time.</p>
          
          <div style="background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c;">
            <p style="margin: 5px 0;"><strong>Reason:</strong></p>
            <p style="margin: 5px 0; color: #555;">${reason || 'Your application does not meet our current requirements.'}</p>
          </div>
          
          <h3 style="color: #2c3e50; margin-top: 30px;">What You Can Do</h3>
          <p>We encourage you to reapply after addressing the concerns mentioned above. 
          You may also reach out to us with any questions.</p>
          
          <p style="margin-top: 30px; color: #666;">
            Questions? Contact us at <a href="mailto:support@vedika360.com">support@vedika360.com</a>
          </p>
          
          <p style="color: #999; font-style: italic;">
            We hope to welcome you to Vedika 360 in the future!
          </p>
          
          <div style="border-top: 1px solid #ddd; margin-top: 30px; padding-top: 20px; text-align: center; color: #999; font-size: 12px;">
            <p>© 2024 Vedika 360. All rights reserved.</p>
          </div>
        </div>
      </div>
    `,
  };
};

/**
 * Send email notification
 */
async function sendVendorEmail(to, template) {
  try {
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: `Vedika 360 <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject: template.subject,
      html: template.html,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`[VendorEmail] Sent to ${to}:`, result.messageId);
    return result;
  } catch (error) {
    console.error(`[VendorEmail] Failed to send to ${to}:`, error.message);
    throw error;
  }
}

/**
 * Trigger approval email with login credentials
 */
async function sendApprovalEmail(vendor, tempPassword) {
  const credentials = {
    email: vendor.user?.email || vendor.contactEmail,
    tempPassword,
  };

  const template = getApprovalTemplate(vendor, credentials);
  return sendVendorEmail(credentials.email, template);
}

/**
 * Trigger submission confirmation email
 */
async function sendSubmissionConfirmationEmail(vendor) {
  const template = getFormSubmissionTemplate(vendor);
  return sendVendorEmail(vendor.contactEmail, template);
}

/**
 * Trigger rejection email
 */
async function sendRejectionEmail(vendor, reason) {
  const template = getRejectionTemplate(vendor, reason);
  return sendVendorEmail(vendor.contactEmail, template);
}

module.exports = {
  sendVendorEmail,
  sendApprovalEmail,
  sendSubmissionConfirmationEmail,
  sendRejectionEmail,
  getFormSubmissionTemplate,
  getApprovalTemplate,
  getRejectionTemplate,
};
