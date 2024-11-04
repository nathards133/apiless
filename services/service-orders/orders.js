import express from 'express';
import { auth } from '../middleware/auth.js';
import RepositoryFactory from '../repositories/RepositoryFactory.js';

const router = express.Router();
const serviceOrderRepository = RepositoryFactory.getServiceOrderRepository();

// Criar nova OS
router.post('/', auth, async (req, res) => {
  try {
    const { clientId, services, deliveryDate, totalValue } = req.body;
    
    const newOrder = await serviceOrderRepository.create({
      clientId,
      services,
      deliveryDate,
      totalValue
    });
    
    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Error creating service order:', error);
    res.status(500).json({ message: 'Error creating service order' });
  }
});

// Listar todas as OS
router.get('/', auth, async (req, res) => {
  try {
    const { status } = req.query;
    const orders = await serviceOrderRepository.findAll({ status });
    res.json(orders);
  } catch (error) {
    console.error('Error listing service orders:', error);
    res.status(500).json({ message: 'Error listing service orders' });
  }
});

// Obter OS específica
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await serviceOrderRepository.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Service order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Error fetching service order:', error);
    res.status(500).json({ message: 'Error fetching service order' });
  }
});

// Atualizar OS
router.put('/:id', auth, async (req, res) => {
  try {
    const updatedOrder = await serviceOrderRepository.update(req.params.id, req.body);
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating service order:', error);
    res.status(500).json({ message: 'Error updating service order' });
  }
});

// Deletar OS
router.delete('/:id', auth, async (req, res) => {
  try {
    await serviceOrderRepository.delete(req.params.id);
    res.json({ message: 'Service order deleted successfully' });
  } catch (error) {
    console.error('Error deleting service order:', error);
    res.status(500).json({ message: 'Error deleting service order' });
  }
});

export default router;