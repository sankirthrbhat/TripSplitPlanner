import mongoose from 'mongoose';

export function isValidIanaTimezone(tz) {
  if (typeof tz !== 'string' || !tz.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch (_err) {
    return false;
  }
}

const tripMemberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'member'],
      required: true,
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    destination: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator(val) {
          if (!this.startDate || !val) return true;
          return val.getTime() >= this.startDate.getTime();
        },
        message: 'Trip end date cannot be before start date.',
      },
    },
    timezone: {
      type: String,
      required: true,
      default: 'Asia/Kolkata',
      trim: true,
      validate: {
        validator: isValidIanaTimezone,
        message: 'Invalid IANA timezone identifier.',
      },
    },
    currency: {
      type: String,
      enum: ['INR'],
      default: 'INR',
      required: true,
    },
    budgetLimitMinor: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'budgetLimitMinor must be an integer in paise.',
      },
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    members: {
      type: [tripMemberSchema],
      required: true,
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.length >= 1;
        },
        message: 'Trip must have at least one member.',
      },
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

tripSchema.index({ 'members.userId': 1, startDate: -1 });

export const Trip = mongoose.models.Trip || mongoose.model('Trip', tripSchema);

