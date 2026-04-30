const Razorpay = require('razorpay');

// Use test credentials in test environment if not provided
const keyId = process.env.RAZORPAY_KEY_ID || (process.env.NODE_ENV === 'test' ? 'rzp_test_dummy_key_id' : '');
const keySecret = process.env.RAZORPAY_KEY_SECRET || (process.env.NODE_ENV === 'test' ? 'test_dummy_key_secret' : '');

const razorpayInstance = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

module.exports = razorpayInstance;
