import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, LogOut, Menu, Search, X } from 'lucide-react'
import { navGroups } from '../lib/nav'
import { useSession } from '../context/session'
import { useData } from '../lib/useData'
import { getAlerts } from '../data/api'
import { Logo } from './ui'

const roleLabel = { patient: 'Patient', doctor: 'Doctor', admin: 'Admin' } as const

export default function AppLayout() {
  const { session, logout } = useSession()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { data: alerts, error: apiError } = useData(() => getAlerts(session!.patientId), [session?.patientId])
  const unread = alerts?.filter((a) => a.status === 'unread').length ?? 0

  const sidebar = (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto px-4 pb-6 pt-5">
      <Link to="/" className="px-2" onClick={() => setOpen(false)}>
        <Logo />
      </Link>
      {navGroups.map((g) => {
        const items = g.items.filter((i) => i.roles.includes(session!.role))
        if (!items.length) return null
        return (
          <div key={g.title}>
            <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-mute">{g.title}</p>
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/app'}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors ${
                        isActive ? 'bg-teal-brand text-white shadow-[0_6px_16px_-10px_rgba(15,118,110,.9)]' : 'text-ink-soft hover:bg-white hover:text-ink'
                      }`
                    }
                  >
                    <item.icon className="size-[17px] shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.to === '/app/notifications' && unread > 0 && (
                      <span className="num rounded-full bg-rose-brand px-1.5 text-[11px] font-semibold text-white">{unread}</span>
                    )}
                    {item.milestone > 1 && <span className="size-1.5 rounded-full bg-line group-hover:bg-ink-mute" title="On the roadmap" />}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      <div className="mt-auto rounded-2xl border border-line bg-white p-3">
        <p className="truncate text-sm font-semibold">{session!.name}</p>
        <p className="truncate text-xs text-ink-mute">
          {roleLabel[session!.role]} · {session!.email}
        </p>
        <button
          onClick={() => {
            logout()
            navigate('/login')
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-line py-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
        >
          <LogOut className="size-3.5" /> Sign out
        </button>
      </div>
    </nav>
  )

  return (
    <div className="grain min-h-screen lg:grid lg:grid-cols-[268px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-canvas lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink/30" />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-canvas shadow-2xl animate-rise" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-3 top-4 rounded-lg p-1.5 text-ink-mute" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-canvas/85 px-4 py-3 backdrop-blur md:px-8">
          <button className="rounded-lg p-2 text-ink-soft lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-mute" />
            <input className="field !rounded-full !py-2 pl-9" placeholder="Search records, medications, doctors…" aria-label="Search" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            {session!.role !== 'patient' && (
              <span className="hidden rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-ink-soft sm:inline">
                Viewing: <span className="font-semibold text-ink">Meera Raghunathan</span>
              </span>
            )}
            <span className="rounded-full bg-violet-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-violet-brand">{roleLabel[session!.role]}</span>
            <Link to="/app/notifications" className="relative rounded-full border border-line bg-white p-2 text-ink-soft hover:text-ink" aria-label="Notifications">
              <Bell className="size-4" />
              {unread > 0 && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-white bg-rose-brand" />}
            </Link>
          </div>
        </header>
        <main key={location.pathname} className="mx-auto max-w-[1280px] px-4 py-8 md:px-8">
          {apiError && (
            <div role="alert" className="mb-6 rounded-xl border border-rose-brand/30 bg-rose-soft px-4 py-3 text-sm text-ink">
              <strong className="font-semibold">Can't load data from the server.</strong> {apiError}
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
