import mongoose from 'mongoose';

const recipeSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    unique: true
  },
  ingredients: [
    {
      ingredient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ingredient',
        required: true
      },
      quantity: {
        type: Number,
        required: true
      }
    }
  ],
  instructions: {
    type: String,
    default: ''
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

recipeSchema.index({ product: 1 });

const Recipe = mongoose.model('Recipe', recipeSchema);
export default Recipe;
