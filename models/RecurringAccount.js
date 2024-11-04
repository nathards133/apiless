import mongoose from 'mongoose';

const RecurringAccountSchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true, 
    enum: ['supplier', 'rent', 'other'] 
  },
  supplier: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Supplier', 
    required: function() { return this.type === 'supplier'; },
    default: null
  },
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product', 
    required: function() { return this.type === 'supplier'; },
    default: null
  },
  description: { 
    type: String, 
    required: function() { return this.type === 'other' || this.type === 'rent'; }
  },
  quantity: { 
    type: Number, 
    required: function() { return this.type === 'supplier'; },
    default: null
  },
  totalValue: { type: Number, required: true },
  dueDay: { 
    type: Number, 
    required: true,
    min: 1,
    max: 31
  },
  isActive: { type: Boolean, default: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export default mongoose.model('RecurringAccount', RecurringAccountSchema);
