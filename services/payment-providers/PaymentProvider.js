class PaymentProvider {
  async initializePayment(amount, orderId) {
    throw new Error('Método não implementado');
  }

  async checkStatus(paymentId) {
    throw new Error('Método não implementado');
  }

  async handleCallback(data) {
    throw new Error('Método não implementado');
  }

  isAvailable() {
    return false;
  }
}

export default PaymentProvider; 