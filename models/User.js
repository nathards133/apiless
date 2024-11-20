import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import validator from 'validator';

const UserSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    validate: [validator.isEmail, 'Email inválido']
  },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  company: { type: String, required: true },
  businessType: { 
    type: String, 
    enum: [
      'Açougue',
      'Padaria',
      'Mercearia',
      'Papelaria',
      'Material de Construção',
      'Distribuidora de Bebidas',
      'Sorveteria',
      'Outros'
    ],
    required: true 
  },
  city: { type: String, required: true },
  salt: { type: String },
  salesPassword: { type: String, select: true },
  hasCertificate: { type: Boolean, default: false },
  certificateExpiration: Date,
  nfeConfig: {
    ambiente: { type: String, enum: ['homologacao', 'producao'], default: 'homologacao' },
    serie: { type: String, default: '1' },
    numeroInicial: { type: Number, default: 1 }
  },
  
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.salt = salt; 
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);

// Adicione este método estático para buscar um usuário com salesPassword
User.findOneWithSalesPassword = function(query) {
  return this.findOne(query).select('+salesPassword');
};

export default User;