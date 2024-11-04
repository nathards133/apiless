import PaymentProvider from './PaymentProvider.js';

class GenericProvider extends PaymentProvider {
  isAvailable() {
    return true; // Sempre disponível como última opção
  }

  async initializePayment(amount, orderId) {
    return {
      provider: 'outros',
      isGeneric: true,
      requiresManualConfirmation: true
    };
  }

  async handleCallback(data) {
    return {
      orderId: data.orderId,
      success: true,
      transactionId: `MANUAL-${Date.now()}`
    };
  }
}

export default GenericProvider; 