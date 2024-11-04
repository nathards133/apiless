import mongoose from 'mongoose';

const SaleSchema = new mongoose.Schema({
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    quantity: Number,
    price: Number
  }],
  totalValue: Number,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paymentMethod: String,
  customerCpf: String,
  customerName: String,
  nfeStatus: {
    type: String,
    enum: ['pending', 'issued', 'failed'],
    default: 'pending'
  },
  nfeNumber: String,
  nfeKey: String,
  nfeUrl: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Sale', SaleSchema);
