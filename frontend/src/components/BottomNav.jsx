import { useLocation, Link } from 'react-router-dom'

const navItems = [
  { path: '/', label: 'Home', icon: 'dashboard' },
  { path: '/map', label: 'Map', icon: 'map' },
  { path: '/family', label: 'Family', icon: 'group' },
  { path: '/profile', label: 'Settings', icon: 'settings' },
]

export default function BottomNav() {
  const location = useLocation()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl shadow-[0_-8px_30px_rgb(0,0,0,0.04)] px-4 sm:px-6 pt-3 flex justify-between items-center z-50" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      {navItems.slice(0, 2).map(item => {
        const isActive = location.pathname === item.path
        return (
          <Link key={item.path} to={item.path} className={`flex flex-col items-center gap-1 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>{item.icon}</span>
            <span className="text-[10px] font-bold uppercase">{item.label}</span>
          </Link>
        )
      })}
      {/* Center SOS button */}
      <div className="relative -mt-10">
        <Link to="/emergency" className="w-14 h-14 bg-error rounded-full shadow-lg flex items-center justify-center text-white active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-3xl">emergency</span>
        </Link>
      </div>
      {navItems.slice(2).map(item => {
        const isActive = location.pathname === item.path
        return (
          <Link key={item.path} to={item.path} className={`flex flex-col items-center gap-1 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>{item.icon}</span>
            <span className="text-[10px] font-bold uppercase">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
