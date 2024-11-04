import express from 'express';
import { auth } from '../middleware/auth.js';
import RepositoryFactory from '../repositories/RepositoryFactory.js';

const router = express.Router();
const clientRepository = RepositoryFactory.getClientRepository();

// Create new client
router.post('/', auth, async (req, res) => {
  try {
    const clientData = {
      ...req.body,
      userId: req.user._id
    };
    
    const client = await clientRepository.create(clientData);
    res.status(201).json(client);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ message: 'Error creating client' });
  }
});

// List all clients
router.get('/', auth, async (req, res) => {
  try {
    const clients = await clientRepository.findAll({ userId: req.user._id });
    res.json(clients);
  } catch (error) {
    console.error('Error listing clients:', error);
    res.status(500).json({ message: 'Error listing clients' });
  }
});

// Get specific client
router.get('/:id', auth, async (req, res) => {
  try {
    const client = await clientRepository.findById(req.params.id, req.user._id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ message: 'Error fetching client' });
  }
});

// Update client
router.put('/:id', auth, async (req, res) => {
  try {
    const client = await clientRepository.update(
      req.params.id,
      req.body,
      req.user._id
    );
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ message: 'Error updating client' });
  }
});

// Delete client (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    await clientRepository.delete(req.params.id, req.user._id);
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ message: 'Error deleting client' });
  }
});

export default router; 