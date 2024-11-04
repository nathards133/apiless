import mongoose from 'mongoose';

const ReportSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  period: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Report', ReportSchema);
