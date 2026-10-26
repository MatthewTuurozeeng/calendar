import type {
  DateSelectArg,
  DatesSetArg,
  EventChangeArg,
  EventClickArg,
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
import { eventChanges, fetchEventsInRange, updateEvent, type EventRow } from '../events/api'
import { EventDialog } from '../events/EventDialog'
import { timingToColumns, withDefaultEnd, type EventTiming } from '../events/timing'
import { CalendarToolbar, type CalendarView } from './CalendarToolbar'

const UNCATEGORIZED_COLOR = '#E7E2E0'
const INK = '#29272A'

type DialogState = { event: EventRow } | { timing: EventTiming } | null

function initialView(): CalendarView {
  // Agenda is the default on narrow screens (README §4.1).
  return window.matchMedia('(max-width: 767px)').matches ? 'listWeek' : 'timeGridWeek'
}

export function CalendarPage() {
  const { profile, categories } = useUserData()
  const calendarRef = useRef<FullCalendar>(null)
  const [title, setTitle] = useState('')
  const [view, setView] = useState<CalendarView>(initialView)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)

  const colorByCategory = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories])

  const loadEvents = useCallback(
    async (range: EventSourceFuncArg): Promise<EventInput[]> => {
      try {
        const rows = await fetchEventsInRange(range.start, range.end)
        setLoadError(null)
        return rows.map((row) => {
          const color = (row.category_id && colorByCategory.get(row.category_id)) || UNCATEGORIZED_COLOR
          return {
            id: row.id,
            title: row.title,
            allDay: row.all_day,
            start: row.all_day ? row.start_date! : row.start_at!,
            end: row.all_day ? row.end_date! : row.end_at!,
            backgroundColor: color,
            borderColor: color,
            textColor: INK,
            extendedProps: { row },
          }
        })
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Could not load events.')
        return []
      }
    },
    [colorByCategory],
  )

  // Refetch after any event is created, edited or deleted, including from quick-add.
  useEffect(() => {
    const refetch = () => calendarRef.current?.getApi().refetchEvents()
    eventChanges.addEventListener('change', refetch)
    return () => eventChanges.removeEventListener('change', refetch)
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
    setDialog({ event: arg.event.extendedProps.row as EventRow })
  }

  // Drag to move, drag the edge to resize.
  async function handleEventChange(arg: EventChangeArg) {
    const { event } = arg
    if (!event.start) return arg.revert()
    try {
      await updateEvent(event.id, timingToColumns(withDefaultEnd(event.allDay, event.start, event.end)))
    } catch (err) {
      arg.revert()
      setLoadError(err instanceof Error ? err.message : 'Could not move the event.')
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
          events={loadEvents}
          datesSet={handleDatesSet}
          selectable
          selectMirror
          editable
          select={handleSelect}
          eventClick={handleEventClick}
          eventChange={handleEventChange}
          nowIndicator
          scrollTime="06:00:00"
          allDayText="All day"
          dayMaxEventRows={3}
          noEventsContent="Nothing scheduled"
          slotLabelFormat={{ hour: 'numeric', minute: '2-digit', omitZeroMinute: true, meridiem: 'short' }}
        />
      </div>

      {dialog && (
        <EventDialog
          {...('event' in dialog ? { event: dialog.event } : { timing: dialog.timing })}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
