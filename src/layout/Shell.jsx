import { NavLink, Outlet } from 'react-router-dom'
import { LayoutGrid, FolderKanban, Sparkles, Users, Bell } from 'lucide-react'
import { useState } from 'react'

const NAV = [
  { to: '/', label: 'Organisation', icon: LayoutGrid, end: true },
  { to: '/nouveau', label: 'Nouveau projet', icon: Sparkles },
  { to: '/projets', label: 'Mes projets', icon: FolderKanban },
  { to: '/equipe', label: 'Équipe', icon: Users },
]

export default function Shell() {
  const [notifCount] = useState(2)

  return (
    <div className="h-screen flex bg-[color:var(--color-void)] text-[color:var(--color-ivory)]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-[color:var(--color-line)] flex flex-col">
        <div className="h-20 flex items-center gap-3 px-6 border-b border-[color:var(--color-line)]">
          <div className="w-9 h-9 rounded-full border border-[color:var(--color-gold)] flex items-center justify-center">
            <span className="font-display text-[color:var(--color-gold-bright)] text-lg">G</span>
          </div>
          <div className="leading-tight">
            <div className="font-display text-[15px] tracking-wide">G-Tech HQ</div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-mute)]">Espace de travail</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-[color:var(--color-surface-2)] text-[color:var(--color-gold-bright)]'
                    : 'text-[color:var(--color-ivory-dim)] hover:text-[color:var(--color-ivory)] hover:bg-[color:var(--color-surface)]'
                }`
              }
            >
              <Icon size={17} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[color:var(--color-line)]">
          <div className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-mute)] px-2 mb-2">Statut</div>
          <div className="flex items-center gap-2 px-2 text-xs text-[color:var(--color-ivory-dim)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-good)]" />
            4 moteurs connectés
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 border-b border-[color:var(--color-line)] flex items-center justify-between px-8">
          <div />
          <button className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-[color:var(--color-surface)] transition-colors">
            <Bell size={18} strokeWidth={1.75} className="text-[color:var(--color-ivory-dim)]" />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[color:var(--color-gold)] text-[10px] font-semibold text-[color:var(--color-void)] flex items-center justify-center">
                {notifCount}
              </span>
            )}
          </button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
