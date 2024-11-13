import mongoose from 'mongoose';

const CashRegisterSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  initialAmount: { type: Number, required: true },
  currentAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open'
  },
  openedAt: { type: Date, default: Date.now },
  closedAt: Date,
  transactions: [{
    type: { type: String, enum: ['sale', 'withdrawal', 'deposit'] },
    amount: Number,
    description: String,
    timestamp: { type: Date, default: Date.now }
  }]
});

export default mongoose.models.CashRegister || mongoose.model('CashRegister', CashRegisterSchema); 