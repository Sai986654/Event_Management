import api from './api';
import Constants from 'expo-constants';

export const paymentService = {
  getRequirement: async (entityType, entityId) => {
    const response = await api.get(`/payments/requirements/${entityType}/${entityId}`);
    return response.data;
  },

  initiatePayment: async ({ entityType, entityId, amount, description }) => {
    const response = await api.post('/payments/initiate', {
      entityType,
      entityId,
      amount,
      description,
    });
    return response.data;
  },

  verifyPayment: async ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
    const response = await api.post('/payments/verify', {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
    return response.data;
  },

  createPaymentOrderFromRequirement: async (requirement, description) => {
    if (!requirement?.entityType || !requirement?.entityId) {
      throw new Error('Invalid payment requirement');
    }
    const configAmount = Number(requirement?.config?.amount || 0);
    const fallbackAmount = Number(requirement?.suggestedAmount || requirement?.booking?.price || 0);
    const amount = configAmount > 0 ? configAmount : fallbackAmount;

    return paymentService.initiatePayment({
      entityType: requirement.entityType,
      entityId: requirement.entityId,
      amount,
      description,
    });
  },

  checkoutForRequirement: async (requirement, description) => {
    const order = await paymentService.createPaymentOrderFromRequirement(requirement, description);

    if (Constants.appOwnership === 'expo') {
      throw new Error('Native Razorpay checkout is not available in Expo Go. Use an EAS dev/preview/prod build.');
    }

    let RazorpayCheckout = null;
    try {
      // Lazy-load native module to avoid hard crash when running Expo Go.
      RazorpayCheckout = require('react-native-razorpay').default;
    } catch (_err) {
      throw new Error('Native Razorpay checkout is unavailable in this build. Use a dev/production build.');
    }

    const options = {
      description: description || `Payment for ${requirement.entityType}`,
      currency: 'INR',
      key: order.keyId,
      amount: Math.round(Number(order.amount || 0) * 100),
      name: 'Vedika 360',
      order_id: order.orderId,
      prefill: {},
      theme: { color: '#1677ff' },
    };

    const result = await RazorpayCheckout.open(options);
    await paymentService.verifyPayment({
      razorpayOrderId: result.razorpay_order_id,
      razorpayPaymentId: result.razorpay_payment_id,
      razorpaySignature: result.razorpay_signature,
    });

    return result;
  },
};
