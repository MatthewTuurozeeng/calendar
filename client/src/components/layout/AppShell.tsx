import { useState } from 'react'
import { Outlet, useLocation, useSearchParams } from 'react-router'
import { useUserData } from '../../features/auth/user-data'
import { EventDialog } from '../../features/events/EventDialog'
import { defaultTiming, type EventTiming } from '../../features/events/timing'
import { useReminderSync } from '../../features/reminders/sync'
import { calendarPrefs } from '../../features/settings/prefs'
import { TaskDialog } from '../../features/tasks/TaskDialog'
import { defaultDueDate, taskViewFromParams } from '../../features/tasks/views'
import { PlusIcon } from '../ui/icons'
import { BottomNav } from './BottomNav'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const { profile } = useUserData()
  useReminderSync()
  const [quickAdd, setQuickAdd] = useState<EventTiming | null>(null)
  const openQuickAdd = () => setQuickAdd(defaultTiming(new Date(), calendarPrefs(profile).default_event_minutes))

  // New task is due in the list you're looking at: today, tomorrow for Upcoming, else no date.
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const onTasks = pathname.startsWith('/tasks')
  const [newTask, setNewTask] = useState<{ dueDate: string | null } | null>(null)
  const openNewTask = () =>
    setNewTask({ dueDate: defaultDueDate(onTasks ? taskViewFromParams(params) : 'today', new Date()) })

  return (
    <div className="flex min-h-dvh">
      <Sidebar onNewEvent={openQuickAdd} onNewTask={openNewTask} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 px-4 pt-4 pb-32 md:px-8 md:pt-6 md:pb-8">
          <Outlet />
        </main>
      </div>

      <BottomNav />

      {/* Mobile floating quick-add, sits above the bottom navigation; adds a task on the Tasks page */}
      <button
        type="button"
        onClick={onTasks ? openNewTask : openQuickAdd}
        aria-label={onTasks ? 'New task' : 'New event'}
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] grid size-14 place-items-center rounded-full bg-accent text-ink shadow-lg shadow-ink/15 md:hidden"
      >
        <PlusIcon />
      </button>

      {quickAdd && <EventDialog timing={quickAdd} onClose={() => setQuickAdd(null)} />}
      {newTask && <TaskDialog defaultDueDate={newTask.dueDate} onClose={() => setNewTask(null)} />}
    </div>
  )
}
