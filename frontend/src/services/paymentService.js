import api from './api';

let razorpayScriptPromise = null;

const loadRazorpayScript = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay checkout is only available in browser'));
  }
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Unable to load Razorpay checkout'));
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
};

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

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

  checkoutForEntity: async ({ entityType, entityId, amount, description }) => {
    await loadRazorpayScript();

    const order = await paymentService.initiatePayment({ entityType, entityId, amount, description });
    const user = getCurrentUser();

    return new Promise((resolve, reject) => {
      const options = {
        key: order.keyId,
        amount: Math.round(Number(order.amount || 0) * 100),
        currency: 'INR',
        name: 'Vedika 360',
        description: description || `Payment for ${entityType}`,
        order_id: order.orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        notes: {
          entityType,
          entityId: String(entityId),
        },
        theme: {
          color: '#1677ff',
        },
        handler: async (response) => {
          try {
            const verified = await paymentService.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            resolve(verified);
          } catch (err) {
            reject(err);
          }
        },
        modal: {
          ondismiss: () => reject(new Error('Payment cancelled')),
        },
      };

      const checkout = new window.Razorpay(options);
      checkout.on('payment.failed', (resp) => {
        const reason = resp?.error?.description || 'Payment failed';
        reject(new Error(reason));
      });
      checkout.open();
    });
  },
};
