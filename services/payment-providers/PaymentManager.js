import InfinityPayProvider from './InfinityPayProvider.js';
import MercadoPagoProvider from './MercadoPagoProvider.js';
import GenericProvider from './GenericProvider.js';

class PaymentManager {
  constructor() {
    this.providers = [
      new InfinityPayProvider(),
      new MercadoPagoProvider(),
      new GenericProvider()
    ];
  }

  async getAvailableProvider() {
    for (const provider of this.providers) {
      if (await provider.isAvailable()) {
        return provider;
      }
    }
    return new GenericProvider();
  }
}

export default new PaymentManager(); 