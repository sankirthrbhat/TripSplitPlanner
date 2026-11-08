import mongoose from 'mongoose';

const invitationSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    invitedEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      maxlength: 160,
    },
    label: {
      type: String,
      trim: true,
      default: '',
      maxlength: 100,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'revoked'],
      default: 'pending',
      required: true,
    },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret.tokenHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

invitationSchema.index({ tripId: 1, createdAt: -1 });

export const Invitation =
  mongoose.models.Invitation || mongoose.model('Invitation', invitationSchema);

