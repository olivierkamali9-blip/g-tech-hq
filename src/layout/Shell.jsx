import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutGrid, FolderKanban, Sparkles, Users, Bell, MessageCircle, Users2, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getUnreadCount } from '../lib/notifications'

const NAV = [
  { to: '/', label: 'Organisation', icon: LayoutGrid, end: true },
  { to: '/nouveau', label: 'Nouveau projet', icon: Sparkles },
  { to: '/projets', label: 'Mes projets', icon: FolderKanban },
  { to: '/reunion', label: 'Réunion', icon: Users2 },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/equipe', label: 'Équipe', icon: Users },
]

export default function Shell() {
  const [notifCount, setNotifCount] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    getUnreadCount().then(setNotifCount)
  }, [location])

  useEffect(() => {
    setMobileOpen(false)
  }, [location])

  return (
    <div className="h-screen flex bg-[color:var(--color-void)] text-[color:var(--color-ivory)]">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-[color:var(--color-line)] flex-col">
        <SidebarContent notifCount={notifCount} />
      </aside>

      {/* Sidebar — mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-72 bg-[color:var(--color-void)] border-r border-[color:var(--color-line)] flex flex-col">
            <SidebarContent notifCount={notifCount} onNavigate={() => setMobileOpen(false)} />
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 md:h-20 border-b border-[color:var(--color-line)] flex items-center justify-between px-4 md:px-8">
          <button className="md:hidden w-9 h-9 flex items-center justify-center" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="flex-1 md:hidden text-center font-display text-sm">G-Tech HQ</div>
          <div className="hidden md:block flex-1" />
          <NavLink to="/messages" className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-[color:var(--color-surface)] transition-colors">
            <Bell size={18} strokeWidth={1.75} className="text-[color:var(--color-ivory-dim)]" />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[color:var(--color-gold)] text-[10px] font-semibold text-[color:var(--color-void)] flex items-center justify-center">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </NavLink>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function SidebarContent({ notifCount, onNavigate }) {
  return (
    <>
      <div className="h-20 flex items-center justify-between gap-3 px-6 border-b border-[color:var(--color-line)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full border border-[color:var(--color-gold)] flex items-center justify-center">
            <span className="font-display text-[color:var(--color-gold-bright)] text-lg">G</span>
          </div>
          <div className="leading-tight">
            <div className="font-display text-[15px] tracking-wide">G-Tech HQ</div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-mute)]">Espace de travail</div>
          </div>
        </div>
        {onNavigate && (
          <button onClick={onNavigate} className="w-8 h-8 flex items-center justify-center text-[color:var(--color-mute)]">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-[color:var(--color-surface-2)] text-[color:var(--color-gold-bright)]'
                  : 'text-[color:var(--color-ivory-dim)] hover:text-[color:var(--color-ivory)] hover:bg-[color:var(--color-surface)]'
              }`
            }
          >
            <span className="flex items-center gap-3">
              <Icon size={17} strokeWidth={1.75} />
              {label}
            </span>
            {label === 'Messages' && notifCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[color:var(--color-gold)] text-[10px] font-semibold text-[color:var(--color-void)] flex items-center justify-center">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-[color:var(--color-line)]">
        <div className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-mute)] px-2 mb-2">Statut</div>
        <div className="flex items-center gap-2 px-2 text-xs text-[color:var(--color-ivory-dim)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-good)]" />
          5 moteurs connectés
        </div>
      </div>
    </>
  )
}
