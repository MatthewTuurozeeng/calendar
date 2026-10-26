import { useId, useState, type FormEvent } from 'react'
import { errorClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/form'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, PlusIcon } from '../../components/ui/icons'
import { useSession } from '../auth/auth-context'
import { useUserData, type Category } from '../auth/user-data'
import { CATEGORY_COLORS, createCategory, deleteCategory, reorderCategories, updateCategory } from '../categories/api'
import type { TrackSave } from './save-status'

const iconButton =
  'grid min-h-11 min-w-11 place-items-center rounded-xl text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent'
const textButton = 'min-h-11 rounded-xl px-3 text-sm font-medium hover:bg-canvas'

export function CategorySettings({ track }: { track: TrackSave }) {
  const session = useSession()
  const { allCategories, reloadCategories } = useUserData()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)

  const active = allCategories.filter((c) => !c.archived_at)
  const archived = allCategories.filter((c) => c.archived_at)

  /** Saves, then reloads so every view picks up the change. */
  const run = (save: () => Promise<unknown>) =>
    track(async () => {
      try {
        await save()
      } finally {
        await reloadCategories()
      }
    })

  function move(index: number, by: -1 | 1) {
    const order = [...active]
    ;[order[index], order[index + by]] = [order[index + by], order[index]]
    void run(() => reorderCategories(order))
  }

  const nextPosition = Math.max(-1, ...allCategories.map((c) => c.position)) + 1

  return (
    <>
      {active.length === 0 && editing !== 'new' && (
        <p className="py-4 text-sm text-ink-muted">No categories yet. Add one to color-code your events.</p>
      )}

      <ul className="divide-y divide-line">
        {active.map((c, i) =>
          editing === c.id ? (
            <li key={c.id} className="py-4">
              <CategoryEditor
                category={c}
                onCancel={() => setEditing(null)}
                onSave={async (values) => {
                  const ok = await run(() => updateCategory(c.id, values))
                  if (ok) setEditing(null)
                }}
                onArchive={async () => {
                  const ok = await run(() => updateCategory(c.id, { archived_at: new Date().toISOString() }))
                  if (ok) setEditing(null)
                }}
                onDelete={async () => {
                  const ok = await run(() => deleteCategory(c.id))
                  if (ok) setEditing(null)
                }}
              />
            </li>
          ) : (
            <li key={c.id} className="flex min-h-14 items-center gap-1 py-1.5">
              <span className="mr-2 size-4 shrink-0 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <button
                type="button"
                className={iconButton}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label={`Move ${c.name} up`}
              >
                <ChevronUpIcon className="size-5" />
              </button>
              <button
                type="button"
                className={iconButton}
                disabled={i === active.length - 1}
                onClick={() => move(i, 1)}
                aria-label={`Move ${c.name} down`}
              >
                <ChevronDownIcon className="size-5" />
              </button>
              <button
                type="button"
                className={textButton}
                onClick={() => setEditing(c.id)}
                aria-label={`Edit ${c.name}`}
              >
                Edit
              </button>
            </li>
          ),
        )}

        {editing === 'new' && (
          <li className="py-4">
            <CategoryEditor
              onCancel={() => setEditing(null)}
              onSave={async (values) => {
                const ok = await run(() =>
                  createCategory({ ...values, user_id: session.user.id, position: nextPosition }),
                )
                if (ok) setEditing(null)
              }}
            />
          </li>
        )}
      </ul>

      {editing !== 'new' && (
        <div className="py-3">
          <button
            type="button"
            onClick={() => setEditing('new')}
            className={`${textButton} -ml-3 inline-flex items-center gap-2`}
          >
            <PlusIcon className="size-5" />
            Add category
          </button>
        </div>
      )}

      {archived.length > 0 && (
        <div className="py-3">
          <button
            type="button"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
            className={`${textButton} -ml-3 inline-flex items-center gap-2 text-ink-muted`}
          >
            <ChevronDownIcon className={`size-5 transition-transform ${showArchived ? 'rotate-180' : ''}`} />
            Archived ({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-1">
              {archived.map((c) => (
                <li key={c.id} className="flex min-h-14 flex-wrap items-center gap-1 py-1.5">
                  <span
                    className="mr-2 size-4 shrink-0 rounded-full opacity-60"
                    style={{ backgroundColor: c.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-ink-muted">{c.name}</span>
                  {confirmingDelete === c.id ? (
                    <>
                      <button type="button" className={textButton} onClick={() => setConfirmingDelete(null)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={`${textButton} text-danger`}
                        onClick={() => void run(() => deleteCategory(c.id))}
                      >
                        Confirm delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={textButton}
                        onClick={() =>
                          void run(() => updateCategory(c.id, { archived_at: null, position: nextPosition }))
                        }
                      >
                        Restore
                      </button>
                      <button type="button" className={textButton} onClick={() => setConfirmingDelete(c.id)}>
                        Delete
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  )
}

type CategoryValues = Pick<Category, 'name' | 'color'>

type CategoryEditorProps = {
  category?: Category
  onSave: (values: CategoryValues) => Promise<void>
  onCancel: () => void
  onArchive?: () => Promise<void>
  onDelete?: () => Promise<void>
}

function CategoryEditor({ category, onSave, onCancel, onArchive, onDelete }: CategoryEditorProps) {
  const id = useId()
  const [name, setName] = useState(category?.name ?? '')
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0].hex)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const isPreset = CATEGORY_COLORS.some((c) => c.hex.toLowerCase() === color.toLowerCase())

  async function handle(action: () => Promise<void>) {
    setPending(true)
    await action()
    setPending(false)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Give the category a name.')
    if (trimmed.length > 50) return setError('Keep the name under 50 characters.')
    setError(null)
    void handle(() => onSave({ name: trimmed, color }))
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <label htmlFor={`${id}-name`} className={labelClass}>
          Name
        </label>
        <input
          id={`${id}-name`}
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          autoFocus
        />
        {error && (
          <p id={`${id}-error`} className={errorClass}>
            {error}
          </p>
        )}
      </div>

      <fieldset>
        <legend className={labelClass}>Color</legend>
        <div className="flex flex-wrap items-center gap-1">
          {CATEGORY_COLORS.map((c) => {
            const selected = c.hex.toLowerCase() === color.toLowerCase()
            return (
              <label key={c.hex} className="grid size-11 cursor-pointer place-items-center rounded-full" title={c.name}>
                <input
                  type="radio"
                  name={`${id}-color`}
                  value={c.hex}
                  checked={selected}
                  onChange={() => setColor(c.hex)}
                  className="peer sr-only"
                />
                <span className="sr-only">{c.name}</span>
                <span
                  className="grid size-8 place-items-center rounded-full ring-ink ring-offset-2 peer-checked:ring-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ink"
                  style={{ backgroundColor: c.hex }}
                >
                  {selected && <CheckIcon className="size-4 text-ink" />}
                </span>
              </label>
            )
          })}
          <label
            className={`ml-1 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm ${
              isPreset ? 'text-ink-muted' : 'font-medium'
            }`}
          >
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="size-8 cursor-pointer rounded-full border border-line bg-transparent"
            />
            Custom
          </label>
        </div>
      </fieldset>

      {confirmingDelete && (
        <p role="status" className="rounded-xl bg-warm-peach/25 px-3 py-2 text-sm">
          Delete <span className="font-medium">{category?.name}</span>? Its events and tasks stay, without a category.
          Archive it instead to hide it from pickers but keep its color.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {category && onArchive && onDelete && (
          <div className="flex gap-3">
            {confirmingDelete ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void handle(onDelete)}
                className={`${secondaryButtonClass} border-dusty-orange`}
              >
                Confirm delete
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void handle(onArchive)}
                  className={secondaryButtonClass}
                >
                  Archive
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmingDelete(true)}
                  className={secondaryButtonClass}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
        <div className="ml-auto flex gap-3">
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {category ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </form>
  )
}
