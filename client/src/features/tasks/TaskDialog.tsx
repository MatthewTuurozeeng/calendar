import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import {
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../components/ui/form'
import { XIcon } from '../../components/ui/icons'
import { parseLocal, toDateString, toTimeString } from '../../lib/dates'
import { validateTask, type FieldErrors } from '../../lib/validation'
import { useSession } from '../auth/auth-context'
import { useUserData } from '../auth/user-data'
import { formatOffset } from '../settings/prefs'
import {
  createTask,
  deleteTask,
  statusColumns,
  updateTask,
  type SubtaskDraft,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from './api'

type TaskDialogProps = {
  /** The task to edit, or omit to create one. */
  task?: Task
  /** Due date for a new task, 'yyyy-MM-dd'. */
  defaultDueDate?: string | null
  onClose: () => void
}

type DueMode = 'none' | 'date' | 'time'

type FormState = {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  categoryId: string
  dueMode: DueMode
  dueDate: string
  dueTime: string
  estimate: string
  reminders: number[]
  subtasks: (SubtaskDraft & { key: string })[]
}

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const DUE_MODES: { value: DueMode; label: string }[] = [
  { value: 'none', label: 'No date' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Date & time' },
]

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'pending', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Done' },
]

const REMINDER_CHOICES = [0, 15, 60, 1440]

function initialForm(task: Task | undefined, defaultDueDate: string | null | undefined): FormState {
  const dueAt = task?.due_at ? new Date(task.due_at) : null
  const fallbackDate = defaultDueDate ?? toDateString(new Date())
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    status: (task?.status as TaskStatus) ?? 'pending',
    priority: (task?.priority as TaskPriority) ?? 'medium',
    categoryId: task?.category_id ?? '',
    dueMode: dueAt ? 'time' : task?.due_date || (!task && defaultDueDate) ? 'date' : 'none',
    dueDate: dueAt ? toDateString(dueAt) : (task?.due_date ?? fallbackDate),
    dueTime: dueAt ? toTimeString(dueAt) : '17:00',
    estimate: task?.estimated_minutes ? String(task.estimated_minutes) : '',
    reminders: task?.reminder_offsets ?? [],
    subtasks: (task?.task_subtasks ?? []).map((s) => ({
      key: s.id,
      id: s.id,
      title: s.title,
      is_completed: s.is_completed,
    })),
  }
}

export function TaskDialog({ task, defaultDueDate, onClose }: TaskDialogProps) {
  const session = useSession()
  const { categories } = useUserData()
  const titleId = useId()
  const [form, setForm] = useState(() => initialForm(task, defaultDueDate))
  const [newSubtask, setNewSubtask] = useState('')
  const [errors, setErrors] = useState<FieldErrors<'title' | 'due' | 'estimate'>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function update(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function addSubtask() {
    const title = newSubtask.trim()
    if (!title) return
    update({ subtasks: [...form.subtasks, { key: crypto.randomUUID(), title, is_completed: false }] })
    setNewSubtask('')
  }

  function updateSubtask(key: string, patch: Partial<SubtaskDraft>) {
    update({ subtasks: form.subtasks.map((s) => (s.key === key ? { ...s, ...patch } : s)) })
  }

  function toggleReminder(minutes: number) {
    const next = form.reminders.includes(minutes)
      ? form.reminders.filter((m) => m !== minutes)
      : [...form.reminders, minutes]
    update({ reminders: next.sort((a, b) => a - b) })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const due =
      form.dueMode === 'none' ? null : parseLocal(form.dueDate, form.dueMode === 'time' ? form.dueTime : undefined)
    const found = validateTask({ title: form.title, due, estimatedMinutes: form.estimate })
    setErrors(found)
    if (Object.keys(found).length > 0) return

    const values = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      category_id: form.categoryId || null,
      due_date: form.dueMode === 'date' ? form.dueDate : null,
      due_at: form.dueMode === 'time' && due ? due.toISOString() : null,
      estimated_minutes: form.estimate.trim() ? Number(form.estimate) : null,
      reminder_offsets: form.dueMode === 'none' ? [] : form.reminders,
      // Keep the original completion time unless the status changed.
      ...(task?.status === form.status ? {} : statusColumns(form.status)),
    }
    // Pending text in the "Add a subtask" box counts too.
    const typed = newSubtask.trim()
    const subtasks = [
      ...form.subtasks.map((s) => ({ ...s, title: s.title.trim() })).filter((s) => s.title),
      ...(typed ? [{ title: typed, is_completed: false }] : []),
    ]

    setPending(true)
    setSaveError(null)
    try {
      if (task) await updateTask(task, values, subtasks)
      else await createTask({ ...values, user_id: session.user.id }, subtasks)
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong while saving.')
      setPending(false)
    }
  }

  async function handleDelete() {
    if (!task) return
    setPending(true)
    setSaveError(null)
    try {
      await deleteTask(task.id)
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong while deleting.')
      setPending(false)
    }
  }

  function handleSubtaskKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    addSubtask()
  }

  return (
    <Dialog labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId} className="text-lg font-semibold">
        {task ? 'Edit task' : 'New task'}
      </h2>

      <form onSubmit={handleSubmit} noValidate className="mt-5 flex flex-col gap-4">
        <div>
          <label htmlFor="task-title" className={labelClass}>
            Title
          </label>
          <input
            id="task-title"
            className={inputClass}
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'task-title-error' : undefined}
            autoFocus
          />
          {errors.title && (
            <p id="task-title-error" className={errorClass}>
              {errors.title}
            </p>
          )}
        </div>

        <fieldset>
          <legend className={labelClass}>Due</legend>
          <Segmented options={DUE_MODES} value={form.dueMode} onChange={(dueMode) => update({ dueMode })} label="Due" />
          {form.dueMode !== 'none' && (
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
              <div className={form.dueMode === 'date' ? 'col-span-2' : ''}>
                <label htmlFor="task-due-date" className="sr-only">
                  Due date
                </label>
                <input
                  id="task-due-date"
                  type="date"
                  className={inputClass}
                  value={form.dueDate}
                  onChange={(e) => update({ dueDate: e.target.value })}
                  aria-invalid={!!errors.due}
                  aria-describedby={errors.due ? 'task-due-error' : undefined}
                />
              </div>
              {form.dueMode === 'time' && (
                <div>
                  <label htmlFor="task-due-time" className="sr-only">
                    Due time
                  </label>
                  <input
                    id="task-due-time"
                    type="time"
                    className={inputClass}
                    value={form.dueTime}
                    onChange={(e) => update({ dueTime: e.target.value })}
                    aria-invalid={!!errors.due}
                  />
                </div>
              )}
            </div>
          )}
          {errors.due && (
            <p id="task-due-error" className={errorClass}>
              {errors.due}
            </p>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className={labelClass}>Priority</legend>
            <Segmented
              options={PRIORITIES}
              value={form.priority}
              onChange={(priority) => update({ priority })}
              label="Priority"
            />
          </fieldset>
          <div>
            <label htmlFor="task-status" className={labelClass}>
              Status
            </label>
            <select
              id="task-status"
              className={inputClass}
              value={form.status}
              onChange={(e) => update({ status: e.target.value as TaskStatus })}
            >
              {STATUSES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="task-category" className={labelClass}>
              Category
            </label>
            <select
              id="task-category"
              className={inputClass}
              value={form.categoryId}
              onChange={(e) => update({ categoryId: e.target.value })}
            >
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="task-estimate" className={labelClass}>
              Estimate <span className="font-normal text-ink-muted">(minutes)</span>
            </label>
            <input
              id="task-estimate"
              inputMode="numeric"
              className={inputClass}
              value={form.estimate}
              onChange={(e) => update({ estimate: e.target.value })}
              placeholder="e.g. 30"
              aria-invalid={!!errors.estimate}
              aria-describedby={errors.estimate ? 'task-estimate-error' : undefined}
            />
            {errors.estimate && (
              <p id="task-estimate-error" className={errorClass}>
                {errors.estimate}
              </p>
            )}
          </div>
        </div>

        {form.dueMode !== 'none' && (
          <fieldset>
            <legend className={labelClass}>Reminders</legend>
            <div className="flex flex-wrap gap-2">
              {REMINDER_CHOICES.map((minutes) => {
                const on = form.reminders.includes(minutes)
                return (
                  <button
                    key={minutes}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleReminder(minutes)}
                    className={`min-h-11 rounded-full border px-3 text-sm ${
                      on ? 'border-transparent bg-soft-rose/60 font-medium' : 'border-line text-ink-muted hover:bg-canvas'
                    }`}
                  >
                    {minutes === 0 ? 'When due' : `${formatOffset(minutes).replace(/minutes?/, 'min')} before`}
                  </button>
                )
              })}
            </div>
            {form.dueMode === 'date' && (
              <p className="mt-1 text-xs text-ink-muted">
                Tasks due on a date remind relative to your all-day reminder time in Settings.
              </p>
            )}
          </fieldset>
        )}

        <fieldset>
          <legend className={labelClass}>Subtasks</legend>
          {form.subtasks.length > 0 && (
            <ul className="mb-2 flex flex-col gap-1">
              {form.subtasks.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-ink"
                    checked={s.is_completed}
                    onChange={(e) => updateSubtask(s.key, { is_completed: e.target.checked })}
                    aria-label={`Done: ${s.title}`}
                  />
                  <input
                    className={`${inputClass} min-h-10 ${s.is_completed ? 'text-ink-muted line-through' : ''}`}
                    value={s.title}
                    onChange={(e) => updateSubtask(s.key, { title: e.target.value })}
                    aria-label="Subtask"
                  />
                  <button
                    type="button"
                    onClick={() => update({ subtasks: form.subtasks.filter((x) => x.key !== s.key) })}
                    className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl text-ink-muted hover:bg-canvas hover:text-ink"
                    aria-label={`Remove ${s.title}`}
                  >
                    <XIcon className="size-5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            className={inputClass}
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            onKeyDown={handleSubtaskKey}
            placeholder="Add a subtask, then press Enter"
            aria-label="Add a subtask"
          />
        </fieldset>

        <div>
          <label htmlFor="task-description" className={labelClass}>
            Notes <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <textarea
            id="task-description"
            rows={3}
            className={`${inputClass} py-2`}
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
          />
        </div>

        {saveError && (
          <p role="alert" className={errorClass}>
            {saveError}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {task &&
            (confirmingDelete ? (
              <button
                type="button"
                disabled={pending}
                onClick={handleDelete}
                className={`${secondaryButtonClass} border-dusty-orange`}
              >
                Confirm delete
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmingDelete(true)}
                className={secondaryButtonClass}
              >
                Delete
              </button>
            ))}
          <div className="ml-auto flex gap-3">
            <button type="button" onClick={onClose} className={secondaryButtonClass}>
              Cancel
            </button>
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}

type SegmentedProps<T extends string> = {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
}

function Segmented<T extends string>({ options, value, onChange, label }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex rounded-xl bg-line/60 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 flex-1 rounded-lg px-2 text-sm font-medium ${
            value === o.value ? 'bg-surface shadow-sm' : 'text-ink-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
