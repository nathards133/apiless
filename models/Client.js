import mongoose from 'mongoose';

const ClientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: {
    street: { type: String },
    number: { type: String },
    complement: { type: String },
    district: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String }
  },
  document: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Client', ClientSchema); 