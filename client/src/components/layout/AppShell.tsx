import { useState } from 'react'
import { Outlet } from 'react-router'
import { useUserData } from '../../features/auth/user-data'
import { EventDialog } from '../../features/events/EventDialog'
import { defaultTiming, type EventTiming } from '../../features/events/timing'
import { calendarPrefs } from '../../features/settings/prefs'
import { PlusIcon } from '../ui/icons'
import { BottomNav } from './BottomNav'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const { profile } = useUserData()
  const [quickAdd, setQuickAdd] = useState<EventTiming | null>(null)
  const openQuickAdd = () => setQuickAdd(defaultTiming(new Date(), calendarPrefs(profile).default_event_minutes))

  return (
    <div className="flex min-h-dvh">
      <Sidebar onQuickAdd={openQuickAdd} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 px-4 pt-4 pb-32 md:px-8 md:pt-6 md:pb-8">
          <Outlet />
        </main>
      </div>

      <BottomNav />

      {/* Mobile floating quick-add, sits above the bottom navigation */}
      <button
        type="button"
        onClick={openQuickAdd}
        aria-label="New event"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] grid size-14 place-items-center rounded-full bg-accent text-ink shadow-lg shadow-ink/15 md:hidden"
      >
        <PlusIcon />
      </button>

      {quickAdd && <EventDialog timing={quickAdd} onClose={() => setQuickAdd(null)} />}
    </div>
  )
}
