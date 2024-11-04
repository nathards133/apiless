import PaymentProvider from './PaymentProvider.js';
import axios from 'axios';

class MercadoPagoProvider extends PaymentProvider {
  constructor() {
    super();
    this.clientId = process.env.MERCADO_PAGO_CLIENT_ID;
    this.clientSecret = process.env.MERCADO_PAGO_CLIENT_SECRET;
    this.accessToken = null;
  }

  async isAvailable() {
    return !!(this.clientId && this.clientSecret);
  }

  async initializePayment(amount, orderId) {
    if (!this.accessToken) {
      await this.authenticate();
    }

    const response = await axios.post('https://api.mercadopago.com/pos/integration/devices/payment', {
      amount,
      external_reference: orderId
    }, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });

    return {
      provider: 'mercado_pago',
      paymentId: response.data.id,
      deviceId: response.data.device_id
    };
  }

  async handleCallback(data) {
    return {
      orderId: data.external_reference,
      success: data.status === 'approved',
      transactionId: data.payment_id
    };
  }

   async authenticate() {
    const response = await axios.post('https://api.mercadopago.com/oauth/token', {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'client_credentials'
    });
    this.accessToken = response.data.access_token;
  }
}

export default MercadoPagoProvider; 