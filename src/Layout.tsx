import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { markNotificationsRead, resetDemo, roleIn, switchUser, useDB } from './store'
import { Avatar, RoleBadge, fmt } from './ui'

const NAV = [
  { to: '/', label: 'Campaigns', end: true },
  { to: '/queue', label: 'Review & release' },
  { to: '/audit', label: 'Audit trail' },
  { to: '/team', label: 'Team & roles' },
  { to: '/about', label: 'How it works' },
]

export default function Layout() {
  const db = useDB()
  const me = db.users.find((u) => u.id === db.currentUserId)!
  const [bell, setBell] = useState(false)
  const [menu, setMenu] = useState(false)
  const navigate = useNavigate()
  const mine = db.notifications.filter((n) => n.userId === me.id)
  const unread = mine.filter((n) => !n.read).length

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-bold text-slate-900">
            <img src="/favicon.svg" className="h-7 w-7" alt="" />
            <span className="hidden sm:inline">Brand Compliance AI</span>
          </NavLink>
          <nav className="hidden flex-1 gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button
                className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                onClick={() => {
                  setBell(!bell)
                  setMenu(false)
                }}
                aria-label="Notifications"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
                </svg>
                {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
              </button>
              {bell && (
                <div className="card absolute right-0 mt-2 w-80 p-2">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-sm font-semibold">Notifications</span>
                    <button className="text-xs text-indigo-600" onClick={markNotificationsRead}>
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {mine.length === 0 && <p className="p-3 text-sm text-slate-500">Nothing yet.</p>}
                    {mine.slice(0, 15).map((n) => (
                      <button
                        key={n.id}
                        className={`block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 ${n.read ? 'text-slate-500' : 'font-medium text-slate-800'}`}
                        onClick={() => {
                          setBell(false)
                          if (n.link) navigate(n.link)
                        }}
                      >
                        {n.text}
                        <div className="text-xs font-normal text-slate-400">{fmt(n.at)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 hover:bg-slate-50"
                onClick={() => {
                  setMenu(!menu)
                  setBell(false)
                }}
              >
                <Avatar name={me.name} />
                <span className="hidden text-left text-sm sm:block">
                  <span className="block font-medium leading-tight">{me.name}</span>
                  <span className="block text-xs leading-tight text-slate-500">{me.orgAdmin ? 'Org admin' : 'Member'} · switch user</span>
                </span>
              </button>
              {menu && (
                <div className="card absolute right-0 mt-2 w-80 p-2">
                  <p className="px-2 py-1 text-xs text-slate-500">Demo: act as another person. Roles are per campaign.</p>
                  {db.users.map((u) => (
                    <button
                      key={u.id}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50 ${u.id === me.id ? 'bg-indigo-50' : ''}`}
                      onClick={() => {
                        switchUser(u.id)
                        setMenu(false)
                      }}
                    >
                      <Avatar name={u.name} />
                      <span className="flex-1 text-sm">
                        <span className="block font-medium">{u.name}</span>
                        <span className="flex flex-wrap gap-1">
                          {db.campaigns.map((c) => (
                            <span key={c.id} className="flex items-center gap-1 text-[11px] text-slate-500">
                              {c.name.split(' ')[0]}: <RoleBadge role={roleIn(db, u.id, c.id)} />
                            </span>
                          ))}
                        </span>
                      </span>
                    </button>
                  ))}
                  <button
                    className="mt-1 w-full rounded-lg px-2 py-2 text-left text-xs text-rose-600 hover:bg-rose-50"
                    onClick={() => {
                      if (confirm('Reset all demo data?')) {
                        resetDemo()
                        setMenu(false)
                        navigate('/')
                      }
                    }}
                  >
                    Reset demo data
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8" onClick={() => (bell || menu) && (setBell(false), setMenu(false))}>
        <Outlet />
      </main>
    </div>
  )
}
