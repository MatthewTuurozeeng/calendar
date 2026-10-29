import type { ComponentType, SVGProps } from 'react'
import { CalendarIcon, GraduationCapIcon, SettingsIcon, SunIcon, TasksIcon } from '../ui/icons'

export type NavItem = {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Shown only while this module is enabled. */
  module?: string
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Today', icon: SunIcon },
  { to: '/calendar', label: 'Calendar', icon: CalendarIcon },
  { to: '/tasks', label: 'Tasks', icon: TasksIcon },
  { to: '/academic', label: 'Academic', icon: GraduationCapIcon, module: 'academic' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

/** The navigation for a user with these modules enabled. */
export function visibleNavItems(enabledModules: string[]): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.module || enabledModules.includes(item.module))
}

export function navItemFor(pathname: string): NavItem {
  return (
    NAV_ITEMS.find((item) => item.to !== '/' && pathname.startsWith(item.to)) ?? NAV_ITEMS[0]
  )
}
