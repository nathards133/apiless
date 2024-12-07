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
    type: { 
      type: String, 
      enum: ['sale', 'withdrawal', 'deposit', 'surplus', 'shortage'] 
    },
    amount: Number,
    description: String,
    paymentMethod: String,
    timestamp: { type: Date, default: Date.now }
  }],
  finalAmounts: {
    type: Map,
    of: Number
  },
  closingSummary: {
    initialAmount: Number,
    sales: {
      total: Number,
      byMethod: {
        type: Map,
        of: Number
      }
    },
    withdrawals: {
      total: Number
    },
    expectedBalance: {
      total: Number,
      byMethod: {
        type: Map,
        of: Number
      }
    },
    finalAmounts: {
      type: Map,
      of: Number
    },
    differences: {
      type: Map,
      of: Number
    },
    observations: String
  },
  cashLimit: { type: Number, required: false }
});

export default mongoose.models.CashRegister || mongoose.model('CashRegister', CashRegisterSchema); 