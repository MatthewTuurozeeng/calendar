import { NavLink } from 'react-router'
import { useUserData } from '../../features/auth/user-data'
import { PlusIcon } from '../ui/icons'
import { NAV_ITEMS } from './nav'

type SidebarProps = {
  onQuickAdd: () => void
}

export function Sidebar({ onQuickAdd }: SidebarProps) {
  const { categories } = useUserData()

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-surface px-4 py-5 md:flex">
      <p className="px-3 text-lg font-semibold">Calendar</p>

      <button
        type="button"
        onClick={onQuickAdd}
        className="flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 font-medium text-ink"
      >
        <PlusIcon className="size-5" />
        New event
      </button>

      <nav aria-label="Main">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-xl px-3 ${
                    isActive ? 'bg-soft-rose/45 font-semibold' : 'text-ink-muted hover:bg-canvas'
                  }`
                }
              >
                <Icon className="size-5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="sidebar-categories">
        <h2 id="sidebar-categories" className="px-3 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Categories
        </h2>
        <ul className="mt-2 flex flex-col">
          {categories.map((c) => (
            <li key={c.id} className="flex min-h-9 items-center gap-3 px-3 text-sm">
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />
              {c.name}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}
