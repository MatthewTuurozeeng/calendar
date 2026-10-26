import { format } from 'date-fns'
import { useLocation } from 'react-router'
import { navItemFor } from './nav'

export function Header() {
  const { pathname } = useLocation()
  const { label } = navItemFor(pathname)
  const today = new Date()

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-line bg-canvas/90 px-4 backdrop-blur md:h-16 md:px-8">
      <h1 className="text-lg font-semibold md:text-xl">{label}</h1>
      <time dateTime={format(today, 'yyyy-MM-dd')} className="text-sm text-ink-muted">
        <span className="hidden sm:inline">{format(today, 'EEEE, d MMMM')}</span>
        <span className="sm:hidden">{format(today, 'EEE d MMM')}</span>
      </time>
    </header>
  )
}
