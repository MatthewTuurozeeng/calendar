import type {
  DateSelectArg,
  DatesSetArg,
  EventChangeArg,
  EventClickArg,
  EventContentArg,
  EventInput,
  EventSourceFuncArg,
} from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useUserData } from '../auth/user-data'
import { calendarPrefs, type CalendarPrefs } from '../settings/prefs'
import { Dialog } from '../../components/ui/Dialog'
import { CheckIcon } from '../../components/ui/icons'
import { toDateString } from '../../lib/dates'
import { eventChanges } from '../events/api'
import { useCourseColors } from '../academic/api'
import { EventDialog } from '../events/EventDialog'
import { withDefaultEnd, type EventTiming } from '../events/timing'
import { fetchOccurrences, saveOccurrence } from '../recurrence/api'
import type { Occurrence } from '../recurrence/expand'
import { parseRule } from '../recurrence/rule'
import { ScopeChooser } from '../recurrence/ScopeChooser'
import type { EditScope } from '../recurrence/scopes'
import { setTaskStatus, taskChanges } from '../tasks/api'
import { CalendarToolbar, type CalendarView } from './CalendarToolbar'

const UNCATEGORIZED_COLOR = '#E7E2E0'
const INK = '#29272A'

type DialogState = { occurrence: Occurrence } | { timing: EventTiming } | null

/** A drag of a repeating event, waiting for "this / following / all". */
type PendingMove = { occurrence: Occurrence; timing: EventTiming; revert: () => void }

function initialView(preferred: CalendarPrefs['default_view']): CalendarView {
  if (preferred !== 'auto') return preferred
  // Agenda is the default on narrow screens (README §4.1).
  return window.matchMedia('(max-width: 767px)').matches ? 'listWeek' : 'timeGridWeek'
}

export function CalendarPage() {
  const { profile, allCategories } = useUserData()
  const prefs = calendarPrefs(profile)
  const hour12 = prefs.time_format === '12h'
  const calendarRef = useRef<FullCalendar>(null)
  const [title, setTitle] = useState('')
  const [view, setView] = useState<CalendarView>(() => initialView(prefs.default_view))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const [moving, setMoving] = useState(false)

  // Includes archived categories, so past events keep their color.
  const colorByCategory = useMemo(() => new Map(allCategories.map((c) => [c.id, c.color])), [allCategories])
  // Classes, quizzes and exams take their course's color (README §4.8).
  const courseColors = useCourseColors()

  const loadEvents = useCallback(
    async (range: EventSourceFuncArg): Promise<EventInput[]> => {
      try {
        const occurrences = await fetchOccurrences(range.start, range.end)
        setLoadError(null)
        return occurrences.map((occurrence) => {
          const { timing, category_id } = occurrence
          const courseId = occurrence.event.course_id
          const color =
            (courseId && courseColors.get(courseId)) ||
            (category_id && colorByCategory.get(category_id)) ||
            UNCATEGORIZED_COLOR
          return {
            id: occurrence.key,
            title: occurrence.title,
            allDay: timing.allDay,
            start: timing.allDay ? toDateString(timing.start) : timing.start,
            end: timing.allDay ? toDateString(timing.end) : timing.end,
            backgroundColor: color,
            borderColor: color,
            textColor: INK,
            classNames: occurrence.original ? ['is-recurring'] : [],
            extendedProps: { occurrence },
          }
        })
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Could not load events.')
        return []
      }
    },
    [colorByCategory, courseColors],
  )

  // Refetch after any event is created, edited or deleted, including from quick-add.
  useEffect(() => {
    const refetch = () => calendarRef.current?.getApi().refetchEvents()
    eventChanges.addEventListener('change', refetch)
    taskChanges.addEventListener('change', refetch)
    return () => {
      eventChanges.removeEventListener('change', refetch)
      taskChanges.removeEventListener('change', refetch)
    }
  }, [])

  function handleDatesSet(arg: DatesSetArg) {
    setTitle(arg.view.title)
    setView(arg.view.type as CalendarView)
  }

  function handleSelect(arg: DateSelectArg) {
    arg.view.calendar.unselect()
    setDialog({ timing: { allDay: arg.allDay, start: arg.start, end: arg.end } })
  }

  function handleEventClick(arg: EventClickArg) {
    arg.jsEvent.preventDefault()
    const occurrence = arg.event.extendedProps.occurrence as Occurrence
    // The checkbox on a task's time block completes or reopens the task (README §4.3).
    if (occurrence.task && (arg.jsEvent.target as Element).closest('[data-task-toggle]')) {
      const done = occurrence.task.status === 'completed'
      setTaskStatus(occurrence.task.id, done ? 'pending' : 'completed').catch((err: unknown) =>
        setLoadError(err instanceof Error ? err.message : 'Could not update the task.'),
      )
      return
    }
    setDialog({ occurrence })
  }

  // Drag to move, drag the edge to resize. Repeating events ask which occurrences to move.
  function handleEventChange(arg: EventChangeArg) {
    const { event } = arg
    if (!event.start) return arg.revert()
    const occurrence = event.extendedProps.occurrence as Occurrence
    const timing = withDefaultEnd(event.allDay, event.start, event.end)
    if (occurrence.original) setPendingMove({ occurrence, timing, revert: arg.revert })
    else void move({ occurrence, timing, revert: arg.revert }, 'all')
  }

  async function move({ occurrence, timing, revert }: PendingMove, scope: EditScope) {
    const { event } = occurrence
    setMoving(true)
    try {
      await saveOccurrence(
        occurrence,
        scope,
        {
          title: occurrence.title,
          description: occurrence.description,
          location: occurrence.location,
          category_id: occurrence.category_id,
          timing,
        },
        event.rrule ? parseRule(event.rrule) : null,
      )
    } catch (err) {
      revert()
      setLoadError(err instanceof Error ? err.message : 'Could not move the event.')
    } finally {
      setMoving(false)
      setPendingMove(null)
    }
  }

  const api = () => calendarRef.current?.getApi()

  return (
    <div className="flex flex-col gap-4">
      <CalendarToolbar
        title={title}
        view={view}
        onToday={() => api()?.today()}
        onPrev={() => api()?.prev()}
        onNext={() => api()?.next()}
        onViewChange={(v) => api()?.changeView(v)}
      />

      {loadError && (
        <p role="alert" className="rounded-xl bg-warm-peach/25 px-3 py-2 text-sm">
          {loadError}
        </p>
      )}

      <div className="calendar-surface h-[calc(100dvh-15rem)] min-h-[28rem] rounded-2xl border border-line bg-surface p-2 md:h-[calc(100dvh-11rem)]">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={view}
          headerToolbar={false}
          height="100%"
          firstDay={profile.week_starts_on}
          weekends={prefs.show_weekends}
          weekNumbers={prefs.show_week_numbers}
          events={loadEvents}
          datesSet={handleDatesSet}
          selectable
          selectMirror
          editable
          select={handleSelect}
          eventClick={handleEventClick}
          eventChange={handleEventChange}
          eventContent={renderEventContent}
          nowIndicator
          scrollTime={`${String(prefs.day_start_hour).padStart(2, '0')}:00:00`}
          allDayText="All day"
          dayMaxEventRows={3}
          noEventsContent="Nothing scheduled"
          slotLabelFormat={{ hour: 'numeric', minute: '2-digit', omitZeroMinute: hour12, meridiem: 'short', hour12 }}
          eventTimeFormat={{ hour: 'numeric', minute: '2-digit', omitZeroMinute: hour12, meridiem: 'short', hour12 }}
        />
      </div>

      {dialog && (
        <EventDialog
          {...('occurrence' in dialog ? { occurrence: dialog.occurrence } : { timing: dialog.timing })}
          onClose={() => setDialog(null)}
        />
      )}

      {pendingMove && (
        <Dialog
          labelledBy="move-scope"
          onClose={() => {
            if (moving) return
            pendingMove.revert()
            setPendingMove(null)
          }}
        >
          <h2 id="move-scope" className="sr-only">
            Move recurring event
          </h2>
          <ScopeChooser
            action="save"
            pending={moving}
            onCancel={() => {
              pendingMove.revert()
              setPendingMove(null)
            }}
            onChoose={(scope) => void move(pendingMove, scope)}
          />
        </Dialog>
      )}
    </div>
  )
}

/** Task time blocks get a completion checkbox; other events render as usual. */
function renderEventContent(arg: EventContentArg) {
  const { task } = arg.event.extendedProps.occurrence as Occurrence
  if (!task) return true
  const done = task.status === 'completed'
  return (
    <div className="flex min-w-0 items-start gap-1 overflow-hidden">
      {/* Clicks are handled in eventClick; this span only marks the target. */}
      <span
        data-task-toggle
        role="checkbox"
        aria-checked={done}
        aria-label={done ? 'Reopen task' : 'Complete task'}
        title={done ? 'Reopen task' : 'Complete task'}
        className="-m-0.5 shrink-0 p-0.5"
      >
        <span className="mt-px grid size-3.5 place-items-center rounded-full border border-on-pastel/70 bg-white/70">
          {done && <CheckIcon className="size-2.5" strokeWidth={3} />}
        </span>
      </span>
      <span className="min-w-0">
        {arg.timeText && <span className="mr-1 text-[0.7rem] opacity-80">{arg.timeText}</span>}
        <span className={done ? 'line-through opacity-70' : ''}>{arg.event.title}</span>
      </span>
    </div>
  )
}
