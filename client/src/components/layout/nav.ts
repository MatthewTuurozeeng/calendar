import type { ComponentType, SVGProps } from 'react'
import { CalendarIcon, SettingsIcon, SunIcon, TasksIcon } from '../ui/icons'

export type NavItem = {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Today', icon: SunIcon },
  { to: '/calendar', label: 'Calendar', icon: CalendarIcon },
  { to: '/tasks', label: 'Tasks', icon: TasksIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export function navItemFor(pathname: string): NavItem {
  return (
    NAV_ITEMS.find((item) => item.to !== '/' && pathname.startsWith(item.to)) ?? NAV_ITEMS[0]
  )
}
