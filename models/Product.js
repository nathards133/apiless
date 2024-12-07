import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { 
    type: Number, 
    required: true,
    min: [0, 'A quantidade não pode ser negativa']
  },
  unit: { type: String, required: true },
  barcode: { type: String, unique: true },
  minStockLevel: { type: Number, default: 5 },
  expirationDate: { type: Date },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  archived: { type: Boolean, default: false },
  profitMargin: { type: Number, default: 0 },
  finalPrice: { type: Number }
}, { timestamps: true });

export default mongoose.model('Product', ProductSchema);
