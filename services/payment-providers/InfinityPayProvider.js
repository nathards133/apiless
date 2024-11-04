import PaymentProvider from './PaymentProvider.js';

class InfinityPayProvider extends PaymentProvider {
  isAvailable() {
    return true; // Sempre disponível pois usa deeplink
  }

  async initializePayment(amount, orderId) {
    const amountInCents = Math.round(amount * 100);
    const deeplinkUrl = `infinitepay://payment?` + 
      `amount=${amountInCents}` +
      `&order_id=${orderId}` +
      `&callback_url=${encodeURIComponent(process.env.INFINITY_PAY_CALLBACK_URL)}`;

    return {
      provider: 'infinity_pay',
      deeplinkUrl,
      fallbackUrl: 'https://play.google.com/store/apps/details?id=com.infinitepay.app'
    };
  }

  async handleCallback(data) {
    const { order_id, status, transaction_id } = data;
    return {
      orderId: order_id,
      success: status === 'approved',
      transactionId: transaction_id
    };
  }
}

export default InfinityPayProvider; 