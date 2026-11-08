import mongoose from 'mongoose';

export const ACTIVITY_CATEGORIES = [
  'sightseeing',
  'dining',
  'transit',
  'leisure',
  'adventure',
  'other',
];

export const ACTIVITY_STATUSES = ['planned', 'confirmed', 'cancelled'];

const activitySchema = new mongoose.Schema(
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
    location: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    category: {
      type: String,
      enum: ACTIVITY_CATEGORIES,
      default: 'sightseeing',
      required: true,
    },
    startAt: {
      type: Date,
      required: true,
    },
    endAt: {
      type: Date,
      required: true,
      validate: {
        validator(val) {
          if (!this.startAt || !val) return true;
          return val.getTime() > this.startAt.getTime();
        },
        message: 'Activity endAt must be strictly after startAt.',
      },
    },
    status: {
      type: String,
      enum: ACTIVITY_STATUSES,
      default: 'planned',
      required: true,
    },
    assignedParticipantIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
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

activitySchema.index({ tripId: 1, startAt: 1, endAt: 1 });

export const Activity =
  mongoose.models.Activity || mongoose.model('Activity', activitySchema);

