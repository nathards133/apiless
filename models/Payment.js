import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
  saleId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Sale', 
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: { 
    type: String, 
    required: true 
  },
  transactionId: String,
  errorMessage: String,
  retryCount: { 
    type: Number, 
    default: 0 
  },
  lastRetryAt: Date,
  completedAt: Date,
  provider: {
    type: String,
    enum: ['infinity_pay', 'mercado_pago', 'stone', 'outros'],
    required: true
  }
}, { timestamps: true });

export default mongoose.models.Payment || mongoose.model('Payment', PaymentSchema); 