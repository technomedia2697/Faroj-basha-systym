import mongoose from 'mongoose';

const ingredientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'g', 'l', 'ml', 'pcs', 'dozen']
  },
  reorderLevel: {
    type: Number,
    required: true,
    default: 10
  },
  unitCost: {
    type: Number,
    required: true,
    default: 0
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

ingredientSchema.index({ name: 1 });

const Ingredient = mongoose.model('Ingredient', ingredientSchema);
export default Ingredient;
