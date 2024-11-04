import dbConnect from '../lib/dbConnect.js';
import auth from '../lib/auth.js';
import Payment from '../models/Payment.js';
import Sale from '../models/Sale.js';
import PaymentManager from './payment-providers/PaymentManager.js';

export default async function handler(req, res) {
  await dbConnect();
  const isAuthenticated = auth(req, res);
  if (!isAuthenticated) return;

  switch(req.method) {
    case 'POST':
      if (req.url.includes('/card')) {
        return handleCardPayment(req, res);
      } else if (req.url.includes('/callback')) {
        return handlePaymentCallback(req, res);
      } else if (req.url.includes('/simulate')) {
        return handleSimulatedPayment(req, res);
      }
      break;
    
    case 'GET':
      if (req.url.includes('/status')) {
        return getPaymentStatus(req, res);
      }
      break;
    
    default:
      return res.status(405).json({ message: 'Método não permitido' });
  }
}

async function handleCardPayment(req, res) {
  try {
    const { amount, saleId, customerCpf } = req.body;
    
    const provider = await PaymentManager.getAvailableProvider();
    const paymentData = await provider.initializePayment(amount, saleId);

    const payment = await Payment.create({
      saleId,
      userId: req.userId,
      amount,
      paymentMethod: 'card',
      status: paymentData.isGeneric ? 'completed' : 'pending',
      provider: paymentData.provider,
      customerCpf,
      transactionId: paymentData.isGeneric ? `MANUAL-${Date.now()}` : null
    });

    if (paymentData.isGeneric) {
      await Sale.findByIdAndUpdate(saleId, {
        paymentStatus: 'paid',
        transactionId: payment.transactionId
      });
    }

    return res.json({ 
      success: true,
      paymentId: payment._id,
      ...paymentData
    });
    
  } catch (error) {
    console.error('Erro ao gerar pagamento:', error);
    return res.status(500).json({ 
      success: false,
      message: error.message || 'Erro ao gerar pagamento' 
    });
  }
}

async function handlePaymentCallback(req, res) {
  try {
    const { order_id, status, transaction_id, error_message } = req.body;

    const payment = await Payment.findById(order_id);
    if (!payment) {
      return res.status(404).json({ message: 'Pagamento não encontrado' });
    }

    payment.status = status === 'approved' ? 'completed' : 'failed';
    payment.transactionId = transaction_id;
    payment.errorMessage = error_message;
    
    if (status === 'approved') {
      payment.completedAt = new Date();
      
      // Atualizar status da venda
      await Sale.findByIdAndUpdate(payment.saleId, {
        paymentStatus: 'paid',
        transactionId: transaction_id
      });
    }

    await payment.save();
    
    return res.json({ success: true });
    
  } catch (error) {
    console.error('Erro no callback de pagamento:', error);
    return res.status(500).json({ success: false });
  }
}

async function getPaymentStatus(req, res) {
  try {
    const { paymentId } = req.query;
    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      return res.status(404).json({ message: 'Pagamento não encontrado' });
    }

    return res.json({
      status: payment.status,
      errorMessage: payment.errorMessage,
      completedAt: payment.completedAt
    });
    
  } catch (error) {
    console.error('Erro ao buscar status:', error);
    return res.status(500).json({ message: 'Erro ao buscar status' });
  }
}

async function retryPayment(req, res) {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      return res.status(404).json({ message: 'Pagamento não encontrado' });
    }

    if (payment.retryCount >= 3) {
      return res.status(400).json({ message: 'Número máximo de tentativas excedido' });
    }

    payment.status = 'pending';
    payment.retryCount += 1;
    payment.lastRetryAt = new Date();
    await payment.save();

    const deeplinkUrl = `infinitepay://payment?` + 
      `amount=${Math.round(payment.amount * 100)}` +
      `&order_id=${payment._id}` +
      `&callback_url=${encodeURIComponent(process.env.CALLBACK_URL)}`;

    return res.json({ 
      success: true,
      deeplinkUrl
    });
    
  } catch (error) {
    console.error('Erro ao retentar pagamento:', error);
    return res.status(500).json({ message: 'Erro ao retentar pagamento' });
  }
}

async function cancelPayment(req, res) {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      return res.status(404).json({ message: 'Pagamento não encontrado' });
    }

    payment.status = 'cancelled';
    await payment.save();

    // Atualizar status da venda
    await Sale.findByIdAndUpdate(payment.saleId, {
      paymentStatus: 'cancelled'
    });

    return res.json({ success: true });
    
  } catch (error) {
    console.error('Erro ao cancelar pagamento:', error);
    return res.status(500).json({ message: 'Erro ao cancelar pagamento' });
  }
}

async function handleSimulatedPayment(req, res) {
  try {
    const { amount, saleId, customerCpf } = req.body;
    
    // Criar registro de pagamento
    const payment = await Payment.create({
      saleId,
      userId: req.userId,
      amount,
      paymentMethod: 'card',
      status: 'completed',
      provider: 'simulado',
      customerCpf,
      transactionId: `SIM-${Date.now()}`
    });

    // Atualizar status da venda
    await Sale.findByIdAndUpdate(saleId, {
      paymentStatus: 'paid',
      transactionId: payment.transactionId
    });

    return res.json({ 
      success: true,
      paymentId: payment._id
    });
    
  } catch (error) {
    console.error('Erro na simulação:', error);
    return res.status(500).json({ 
      success: false,
      message: error.message || 'Erro na simulação' 
    });
  }
} 