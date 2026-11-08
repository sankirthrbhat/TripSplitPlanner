import mongoose from 'mongoose';

export const TASK_PRIORITIES = ['low', 'medium', 'high'];
export const TASK_STATUSES = ['todo', 'in_progress', 'done'];

const taskSchema = new mongoose.Schema(
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
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      default: 'medium',
      required: true,
    },
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: 'todo',
      required: true,
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

taskSchema.index({ tripId: 1, status: 1, dueDate: 1 });
taskSchema.index({ tripId: 1, assignedTo: 1 });

export const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);

