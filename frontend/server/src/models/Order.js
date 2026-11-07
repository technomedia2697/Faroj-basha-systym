import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema(
  {
    order_number: {
      type: String,
      unique: true,
      required: true,
    },
    idempotencyKey: {
      type: String,
      maxlength: 128,
    },
    customer_name: {
      type: String,
      required: true,
    },
    customer_phone: {
      type: String,
      default: '',
    },
    customer_address: {
      type: String,
      default: '',
      required: function() { return this.type === 'delivery'; }
    },
    items: [
      {
        product_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: false,
        },
        product_name: String,
        price: Number,
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        subtotal: Number,
      },
    ],
    subtotal: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled'],
      default: 'pending',
    },
    payment_method: {
      type: String,
      enum: ['cash', 'card', 'other'],
      default: 'cash',
    },
    type: {
      type: String,
      enum: ['table', 'takeaway', 'delivery'],
      default: 'takeaway'
    },
    table_number: {
      type: String,
      default: null
    },
    table_section: {
      type: String,
      default: null
    },
    delivery_fee: {
      type: Number,
      default: 0
    },
    checks: [
      {
        type: {
          type: String,
          enum: ['table', 'takeaway', 'delivery'],
        },
        table_number: String,
        delivery_fee: Number,
        items: [
          {
            product_id: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'Product'
            },
            product_name: String,
            price: Number,
            quantity: Number,
            subtotal: Number
          }
        ],
        subtotal: Number,
        total: Number,
        inventory_deducted: { type: Boolean, default: false },
        closedAt: Date,
        consumed: [
          {
            ingredientId: String,
            name: String,
            consumed: Number,
            remaining: Number,
            unit: String
          }
        ]
      }
    ],
    inventory_deducted: {
      type: Boolean,
      default: false
    },
    notes: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }, 
    createdAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: Date,
  },
  { timestamps: true }
);

OrderSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

OrderSchema.pre('validate', function () {
  if (this.isNew && !this.order_number) {
    this.order_number = `ORD-${Date.now().toString(36).toUpperCase()}-${this._id.toString().slice(-6).toUpperCase()}`;
  }
});

export default mongoose.model('Order', OrderSchema);
