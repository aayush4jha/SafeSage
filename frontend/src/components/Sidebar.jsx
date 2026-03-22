import { useLocation, Link } from 'react-router-dom'

const navItems = [
  { path: '/', label: 'Home', icon: 'dashboard' },
  { path: '/map', label: 'Safety Map', icon: 'map' },
  { path: '/family', label: 'Safety Circles', icon: 'group' },
  { path: '/emergency', label: 'Guardian Mode', icon: 'shield_with_heart' },
  { path: '/profile', label: 'Settings', icon: 'settings' },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="fixed left-0 top-0 h-full flex-col p-4 bg-slate-50 w-64 z-50 hidden md:flex">
      {/* Logo */}
      <div className="mb-8 px-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>shield_with_heart</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-headline tracking-tight">SafeSage</h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">The Digital Guardian</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map(item => {
          const isActive = location.pathname === item.path ||
            (item.path === '/map' && location.pathname === '/report')
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 transition-colors duration-200 rounded-xl ${
                isActive
                  ? 'text-emerald-700 font-semibold bg-emerald-50'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <span
                className="material-symbols-outlined"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span className="font-body text-sm">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom CTA */}
      <div className="mt-auto p-4 bg-slate-100 rounded-2xl">
        <Link
          to="/report"
          className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-sm">add_circle</span>
          Report Concern
        </Link>
      </div>
    </aside>
  )
}
