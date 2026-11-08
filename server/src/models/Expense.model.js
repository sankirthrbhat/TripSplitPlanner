import mongoose from 'mongoose';

export const EXPENSE_CATEGORIES = [
  'accommodation',
  'transport',
  'food',
  'activities',
  'shopping',
  'misc',
];

export const EXPENSE_STATUSES = ['planned', 'paid'];
export const EXPENSE_SHARE_MODES = ['equal', 'custom'];

const participantShareSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shareMinor: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'shareMinor must be an integer in paise.',
      },
    },
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 140,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'amountMinor must be a positive integer in paise.',
      },
    },
    currency: {
      type: String,
      enum: ['INR'],
      default: 'INR',
      required: true,
    },
    category: {
      type: String,
      enum: EXPENSE_CATEGORIES,
      default: 'misc',
      required: true,
    },
    status: {
      type: String,
      enum: EXPENSE_STATUSES,
      default: 'planned',
      required: true,
    },
    paidByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    expenseDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    shareMode: {
      type: String,
      enum: EXPENSE_SHARE_MODES,
      default: 'equal',
      required: true,
    },
    participantShares: {
      type: [participantShareSchema],
      required: true,
      validate: {
        validator(shares) {
          if (!Array.isArray(shares) || shares.length === 0) return false;
          const total = shares.reduce((sum, s) => sum + (s.shareMinor || 0), 0);
          return total === this.amountMinor;
        },
        message: 'Sum of participantShares must equal amountMinor.',
      },
    },
    linkedActivityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Activity',
      default: null,
    },
    linkedBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret.__v;
        return ret;
      },
    },
  }
);

expenseSchema.index({ tripId: 1, status: 1, expenseDate: -1 });

export const Expense =
  mongoose.models.Expense || mongoose.model('Expense', expenseSchema);

