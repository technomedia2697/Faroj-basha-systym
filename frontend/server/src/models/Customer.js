import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, required: true, trim: true, maxlength: 40 },
  normalizedPhone: { type: String, required: true, unique: true, index: true },
  address: { type: String, default: '', trim: true, maxlength: 500 },
  notes: { type: String, default: '', trim: true, maxlength: 1000 },
  nextFollowUp: { type: String, default: '', trim: true, maxlength: 30 },
  loyaltyPoints: { type: Number, default: 0, min: 0 },
  orderCount: { type: Number, default: 0, min: 0 },
  totalSpent: { type: Number, default: 0, min: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

customerSchema.pre('save', function () {
  this.updatedAt = new Date();
});

export default mongoose.model('Customer', customerSchema);
