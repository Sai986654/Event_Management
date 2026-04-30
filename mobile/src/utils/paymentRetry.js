import { getPaymentRequirement } from './helpers';
import { paymentService } from '../services/paymentService';

export const runWithPaymentRetry = async ({
  action,
  paymentDescription,
  onPaymentError,
  hasRetriedAfterPayment = false,
}) => {
  try {
    return await action();
  } catch (error) {
    const paymentRequirement = getPaymentRequirement(error);
    if (!paymentRequirement || hasRetriedAfterPayment) {
      throw error;
    }

    try {
      await paymentService.checkoutForRequirement(paymentRequirement, paymentDescription);
      return await runWithPaymentRetry({
        action,
        paymentDescription,
        onPaymentError,
        hasRetriedAfterPayment: true,
      });
    } catch (paymentError) {
      if (typeof onPaymentError === 'function') {
        onPaymentError(paymentError);
        return null;
      }
      throw paymentError;
    }
  }
};
