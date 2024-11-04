import express from 'express';
import { auth } from '../middleware/auth.js';
import RepositoryFactory from '../repositories/RepositoryFactory.js';

const router = express.Router();
const paymentRepository = RepositoryFactory.getPaymentRepository();

// Criar novo pagamento
router.post('/', auth, async (req, res) => {
  try {
    const paymentData = {
      ...req.body,
      userId: req.user._id
    };
    
    const payment = await paymentRepository.create(paymentData);
    res.status(201).json(payment);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ message: 'Error creating payment' });
  }
});

// Listar pagamentos
router.get('/', auth, async (req, res) => {
  try {
    const { status, serviceOrderId } = req.query;
    const payments = await paymentRepository.findAll({
      userId: req.user._id,
      status,
      serviceOrderId
    });
    res.json(payments);
  } catch (error) {
    console.error('Error listing payments:', error);
    res.status(500).json({ message: 'Error listing payments' });
  }
});

// Atualizar status do pagamento
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const payment = await paymentRepository.updateStatus(
      req.params.id,
      status,
      req.user._id
    );
    res.json(payment);
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ message: 'Error updating payment status' });
  }
});

export default router; 