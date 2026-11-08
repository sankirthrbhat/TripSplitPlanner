import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  CheckSquare,
  Edit2,
  Plus,
  Trash2,
  User,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useOutletContext } from 'react-router-dom';
import { z } from 'zod';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState, Skeleton } from '../components/ui/EmptyState';
import { FormField, inputClassName } from '../components/ui/FormField';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';
import { tasksApi } from '../services/api';
import { formatDate } from '../utils/format';

const TASK_PRIORITIES = ['low', 'medium', 'high'];
const TASK_STATUSES = ['todo', 'in_progress', 'done'];

const taskFormSchema = z.object({
  title: z.string().trim().min(2, 'Task title is required.').max(140),
  description: z.string().trim().max(1000).optional().default(''),
  assignedTo: z.string().min(1, 'Please assign this task to a trip member.'),
  dueDate: z.string().optional().default(''),
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(TASK_STATUSES),
});

export function TasksPage() {
  const { trip, tripId } = useOutletContext();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const tasksQuery = useQuery({
    queryKey: ['trip', tripId, 'tasks', assigneeFilter, statusFilter],
    queryFn: () =>
      tasksApi.list(tripId, {
        assignedTo: assigneeFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      assignedTo: trip.members?.[0]?.userId || '',
      dueDate: '',
      priority: 'medium',
      status: 'todo',
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'tasks'] });
    queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'summary'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload) => tasksApi.create(tripId, payload),
    onSuccess: (data) => {
      invalidateAll();
      setModalOpen(false);
      toast.success('Task assigned', `"${data.task.title}" created.`);
    },
    onError: (err) => toast.error('Could not create task', err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => tasksApi.update(tripId, id, payload),
    onSuccess: () => {
      invalidateAll();
      setModalOpen(false);
      setEditingTask(null);
      toast.success('Task updated');
    },
    onError: (err) => toast.error('Could not update task', err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => tasksApi.remove(tripId, id),
    onSuccess: () => {
      invalidateAll();
      setDeleteTarget(null);
      toast.info('Task deleted');
    },
    onError: (err) => toast.error('Could not delete task', err.message),
  });

  const openCreateModal = () => {
    setEditingTask(null);
    reset({
      title: '',
      description: '',
      assignedTo: trip.members?.[0]?.userId || '',
      dueDate: '',
      priority: 'medium',
      status: 'todo',
    });
    setModalOpen(true);
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    reset({
      title: task.title,
      description: task.description || '',
      assignedTo: String(task.assignedTo?._id || task.assignedTo?.id || task.assignedTo),
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
      priority: task.priority,
      status: task.status,
    });
    setModalOpen(true);
  };

  const onSubmit = (values) => {
    const payload = {
      title: values.title,
      description: values.description,
      assignedTo: values.assignedTo,
      dueDate: values.dueDate
        ? new Date(`${values.dueDate}T12:00:00.000Z`).toISOString()
        : null,
      priority: values.priority,
      status: values.status,
    };

    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const tasks = tasksQuery.data?.tasks || [];
  const stats = tasksQuery.data?.stats || { total: 0, done: 0, completionPercent: 100 };

  const priorityVariants = {
    high: 'rose',
    medium: 'amber',
    low: 'neutral',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy-900">
            Responsibilities & Tasks
          </h2>
          <p className="text-xs text-slate-600">
            Assign packing, permits, and booking follow-ups across trip members.
          </p>
        </div>

        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Completion Progress Bar */}
      <Card className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 flex-1">
          <div className="flex items-center justify-between text-xs font-semibold text-navy-900">
            <span>Task Completion Progress</span>
            <span className="tabular-nums">
              {stats.done}/{stats.total} completed ({stats.completionPercent}%)
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-teal-600 transition-all"
              style={{ width: `${stats.completionPercent}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-canvas-border bg-white p-3">
        <div className="flex items-center gap-2">
          <label htmlFor="task-filter-assignee" className="text-xs font-semibold text-slate-500">
            Assignee:
          </label>
          <select
            id="task-filter-assignee"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
          >
            <option value="">All Members</option>
            {trip.members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="task-filter-status" className="text-xs font-semibold text-slate-500">
            Status:
          </label>
          <select
            id="task-filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      {tasksQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks match the current filter"
          description="Create tasks to divide trip responsibilities clearly among group members."
          action={
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Create Task
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Card key={task.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={task.status} />
                  <Badge variant={priorityVariants[task.priority] || 'neutral'} className="capitalize">
                    {task.priority} priority
                  </Badge>
                </div>

                <h3
                  className={`text-sm font-bold text-navy-900 ${
                    task.status === 'done' ? 'line-through text-slate-500' : ''
                  }`}
                >
                  {task.title}
                </h3>

                {task.description ? (
                  <p className="text-xs text-slate-600">{task.description}</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-teal-600" />
                    {task.assignedTo?.displayName || 'Member'}
                  </span>
                  {task.dueDate ? (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      Due {formatDate(task.dueDate, trip.timezone)}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  aria-label={`Change status for ${task.title}`}
                  value={task.status}
                  onChange={(e) =>
                    updateMutation.mutate({
                      id: task.id,
                      payload: { status: e.target.value },
                    })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openEditModal(task)}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete ${task.title}`}
                  onClick={() => setDeleteTarget(task)}
                  className="text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTask ? 'Edit Task' : 'Create & Assign Task'}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormField
            label="Task Title"
            htmlFor="task-title"
            required
            error={errors.title?.message}
          >
            <input
              id="task-title"
              type="text"
              placeholder="e.g. Confirm Innova pickup point"
              className={inputClassName}
              {...register('title')}
            />
          </FormField>

          <FormField label="Description" htmlFor="task-description">
            <textarea
              id="task-description"
              rows={2}
              placeholder="Details or checklist..."
              className={inputClassName}
              {...register('description')}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Assigned Member"
              htmlFor="task-assignedTo"
              required
              error={errors.assignedTo?.message}
            >
              <select
                id="task-assignedTo"
                className={inputClassName}
                {...register('assignedTo')}
              >
                {trip.members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Due Date" htmlFor="task-dueDate">
              <input
                id="task-dueDate"
                type="date"
                className={inputClassName}
                {...register('dueDate')}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Priority" htmlFor="task-priority">
              <select
                id="task-priority"
                className={inputClassName}
                {...register('priority')}
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Status" htmlFor="task-status">
              <select
                id="task-status"
                className={inputClassName}
                {...register('status')}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </FormField>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editingTask
                  ? 'Save Changes'
                  : 'Create Task'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
        title="Delete Task"
        message={`Delete task "${deleteTarget?.title}"?`}
        confirmLabel="Delete Task"
      />
    </div>
  );
}

