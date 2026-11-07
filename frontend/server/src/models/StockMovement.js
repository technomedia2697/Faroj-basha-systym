import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema({
  ingredient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ingredient',
    required: true
  },
  movementType: {
    type: String,
    enum: ['IN', 'OUT'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  reference: {
    type: String,
    default: ''
  },
  reason: {
    type: String,
    enum: ['purchase', 'production', 'waste', 'return', 'adjustment'],
    required: true
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  remaining_after: {
    type: Number,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

stockMovementSchema.index({ ingredient: 1 });
stockMovementSchema.index({ createdAt: -1 });
stockMovementSchema.index({ movementType: 1 });

const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
export default StockMovement;
