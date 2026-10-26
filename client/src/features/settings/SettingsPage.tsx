import { secondaryButtonClass } from '../../components/ui/form'
import { supabase } from '../../lib/supabase'
import { useSession } from '../auth/auth-context'
import { useUserData } from '../auth/user-data'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function SettingsPage() {
  const session = useSession()
  const { profile, categories } = useUserData()

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Account</h2>
        <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          {profile.display_name && (
            <>
              <dt className="text-ink-muted">Name</dt>
              <dd>{profile.display_name}</dd>
            </>
          )}
          <dt className="text-ink-muted">Email</dt>
          <dd className="break-all">{session.user.email}</dd>
          <dt className="text-ink-muted">Time zone</dt>
          <dd>{profile.timezone}</dd>
          <dt className="text-ink-muted">Week starts</dt>
          <dd>{WEEKDAYS[profile.week_starts_on]}</dd>
        </dl>
        <button type="button" className={`${secondaryButtonClass} mt-5`} onClick={() => void supabase.auth.signOut()}>
          Sign out
        </button>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Categories</h2>
        {categories.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No categories yet.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {categories.map((c) => (
              <li
                key={c.id}
                className="rounded-full px-3 py-1 text-sm font-medium text-ink"
                style={{ backgroundColor: c.color }}
              >
                {c.name}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
