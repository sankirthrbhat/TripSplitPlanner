import mongoose from 'mongoose';

export const BOOKING_CATEGORIES = [
  'accommodation',
  'transportation',
  'activities',
  'other',
];

export const BOOKING_STATUSES = ['tentative', 'confirmed', 'cancelled'];

const bookingSchema = new mongoose.Schema(
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
    provider: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 140,
    },
    category: {
      type: String,
      enum: BOOKING_CATEGORIES,
      required: true,
      default: 'accommodation',
    },
    startAt: {
      type: Date,
      default: null,
    },
    endAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: 'tentative',
      required: true,
    },
    referenceNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    url: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    linkedExpenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
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

bookingSchema.index({ tripId: 1, category: 1, startAt: 1 });

export const Booking =
  mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

