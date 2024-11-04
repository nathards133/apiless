import mongoose from 'mongoose';

const TaskSchema = new mongoose.Schema({
  serviceOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceOrder', required: true },
  description: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dueDate: { type: Date },
  completedAt: { type: Date },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  notes: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export default mongoose.model('Task', TaskSchema); 