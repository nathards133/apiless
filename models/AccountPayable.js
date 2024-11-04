import mongoose from 'mongoose';

const AccountPayableSchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true, 
    enum: ['supplier', 'rent', 'other', 'installment'] 
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
    required: function() { return this.type === 'other' || this.type === 'rent' || this.type === 'installment'; }
  },
  quantity: { 
    type: Number, 
    required: function() { return this.type === 'supplier'; },
    default: null
  },
  totalValue: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  isPaid: { type: Boolean, default: false },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isRecurring: { type: Boolean, default: false },
  isInstallment: { type: Boolean, default: false },
  installmentNumber: { 
    type: Number, 
    required: function() { return this.isInstallment; },
    min: 1
  },
  totalInstallments: { 
    type: Number, 
    required: function() { return this.isInstallment; },
    min: 2
  },
  installmentValue: { 
    type: Number, 
    required: function() { return this.isInstallment; }
  },
  parentInstallmentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'AccountPayable',
    default: null
  },
  dueDay: {
    type: Number,
    required: function() { return this.isRecurring; },
    min: 1,
    max: 31
  }
}, { timestamps: true });

export default mongoose.model('AccountPayable', AccountPayableSchema);
