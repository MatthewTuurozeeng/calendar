export type CalendarView = 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth' | 'listWeek'

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: 'timeGridDay', label: 'Day' },
  { id: 'timeGridWeek', label: 'Week' },
  { id: 'dayGridMonth', label: 'Month' },
  { id: 'listWeek', label: 'Agenda' },
]

type CalendarToolbarProps = {
  title: string
  view: CalendarView
  onToday: () => void
  onPrev: () => void
  onNext: () => void
  onViewChange: (view: CalendarView) => void
}

const navButton =
  'grid min-h-11 min-w-11 place-items-center rounded-xl border border-line bg-surface hover:bg-canvas'

export function CalendarToolbar({ title, view, onToday, onPrev, onNext, onViewChange }: CalendarToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onToday} className={`${navButton} px-4 font-medium`}>
          Today
        </button>
        <button type="button" onClick={onPrev} aria-label="Previous" className={navButton}>
          <Chevron direction="left" />
        </button>
        <button type="button" onClick={onNext} aria-label="Next" className={navButton}>
          <Chevron direction="right" />
        </button>
      </div>

      <h2 className="min-w-0 flex-1 truncate text-lg font-semibold" aria-live="polite">
        {title}
      </h2>

      <div role="group" aria-label="View" className="flex w-full rounded-xl bg-line/60 p-1 sm:w-auto">
        {VIEWS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            onClick={() => onViewChange(id)}
            className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-medium sm:flex-none ${
              view === id ? 'bg-surface shadow-sm' : 'text-ink-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="size-5">
      <path d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
