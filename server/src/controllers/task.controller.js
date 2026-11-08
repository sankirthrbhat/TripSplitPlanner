import { Task } from '../models/Task.model.js';
import { assertTripMembers } from '../services/tripMember.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertObjectId } from '../utils/objectId.js';

export const listTasks = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const query = req.validatedQuery || {};

  const filter = { tripId: trip._id };
  if (query.assignedTo) filter.assignedTo = query.assignedTo;
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.dueBefore) {
    const dueDate = new Date(query.dueBefore);
    if (!Number.isNaN(dueDate.getTime())) {
      filter.dueDate = { $lte: dueDate };
    }
  }

  const tasks = await Task.find(filter)
    .populate('assignedTo', 'displayName email')
    .sort({ status: 1, dueDate: 1, createdAt: -1 });

  const totalTasks = await Task.countDocuments({ tripId: trip._id });
  const doneTasks = await Task.countDocuments({ tripId: trip._id, status: 'done' });

  return res.status(200).json({
    success: true,
    data: {
      tasks: tasks.map((t) => t.toJSON()),
      stats: {
        total: totalTasks,
        done: doneTasks,
        completionPercent: totalTasks === 0 ? 100 : Math.round((doneTasks / totalTasks) * 100),
      },
    },
  });
});

export const createTask = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const { title, description, assignedTo, dueDate, priority, status } = req.body;

  assertTripMembers(trip, [assignedTo], 'Assignee');

  const task = await Task.create({
    tripId: trip._id,
    title,
    description,
    assignedTo,
    dueDate: dueDate ?? null,
    priority,
    status,
    createdBy: req.user._id,
  });

  const populated = await Task.findById(task._id).populate(
    'assignedTo',
    'displayName email'
  );

  return res.status(201).json({
    success: true,
    data: {
      task: populated.toJSON(),
    },
  });
});

export const updateTask = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const { taskId } = req.params;
  assertObjectId(taskId, 'Task ID');

  const task = await Task.findOne({ _id: taskId, tripId: trip._id });
  if (!task) {
    throw new AppError('Task not found in this trip.', 404, 'TASK_NOT_FOUND');
  }

  const updates = req.body;
  if (updates.assignedTo !== undefined) {
    assertTripMembers(trip, [updates.assignedTo], 'Assignee');
  }

  const allowedFields = [
    'title',
    'description',
    'assignedTo',
    'dueDate',
    'priority',
    'status',
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      task[field] = updates[field];
    }
  }

  await task.save();

  const populated = await Task.findById(task._id).populate(
    'assignedTo',
    'displayName email'
  );

  return res.status(200).json({
    success: true,
    data: {
      task: populated.toJSON(),
    },
  });
});

export const deleteTask = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const { taskId } = req.params;
  assertObjectId(taskId, 'Task ID');

  const task = await Task.findOneAndDelete({
    _id: taskId,
    tripId: trip._id,
  });

  if (!task) {
    throw new AppError('Task not found in this trip.', 404, 'TASK_NOT_FOUND');
  }

  return res.status(200).json({
    success: true,
    data: {
      deletedTaskId: String(task._id),
    },
  });
});

