import express from 'express';
import { auth } from '../middleware/auth.js';
import RepositoryFactory from '../repositories/RepositoryFactory.js';

const router = express.Router();
const taskRepository = RepositoryFactory.getTaskRepository();

// Create new task
router.post('/', auth, async (req, res) => {
  try {
    const taskData = {
      ...req.body,
      userId: req.user._id
    };
    
    const task = await taskRepository.create(taskData);
    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ message: 'Error creating task' });
  }
});

// List tasks by service order
router.get('/service-order/:serviceOrderId', auth, async (req, res) => {
  try {
    const tasks = await taskRepository.findByServiceOrder(
      req.params.serviceOrderId,
      req.user._id
    );
    res.json(tasks);
  } catch (error) {
    console.error('Error listing tasks:', error);
    res.status(500).json({ message: 'Error listing tasks' });
  }
});

// Update task status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const task = await taskRepository.updateStatus(
      req.params.id,
      status,
      req.user._id
    );
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ message: 'Error updating task status' });
  }
});

export default router; 