import { useLocation, Link } from 'react-router-dom'

const navItems = [
  { path: '/', label: 'Home', icon: 'dashboard' },
  { path: '/map', label: 'Safety Map', icon: 'map' },
  { path: '/family', label: 'Safety Circles', icon: 'group' },
  { path: '/emergency', label: 'Guardian Mode', icon: 'shield_with_heart' },
  {
    path: '/rewards', label: 'Rewards', icon: 'military_tech',
    children: [
      { path: '/leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
      { path: '/bounties', label: 'Bounties', icon: 'explore' },
      { path: '/zones', label: 'My Zones', icon: 'location_on' },
      { path: '/plans', label: 'Plans', icon: 'workspace_premium' },
    ]
  },
  { path: '/profile', label: 'Settings', icon: 'settings' },
]

const rewardPaths = ['/rewards', '/leaderboard', '/bounties', '/zones', '/plans']

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
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const isActive = location.pathname === item.path ||
            (item.path === '/map' && location.pathname === '/report') ||
            (item.path === '/rewards' && rewardPaths.includes(location.pathname))

          const showChildren = item.children && rewardPaths.includes(location.pathname)

          return (
            <div key={item.path}>
              <Link
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
                {item.children && (
                  <span className={`material-symbols-outlined text-sm ml-auto transition-transform ${showChildren ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                )}
              </Link>

              {/* Sub-navigation */}
              {showChildren && (
                <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-emerald-100 pl-3">
                  {item.children.map(child => {
                    const isChildActive = location.pathname === child.path
                    return (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-200 ${
                          isChildActive
                            ? 'text-emerald-700 font-semibold bg-emerald-50/70'
                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-[18px]"
                          style={isChildActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                        >
                          {child.icon}
                        </span>
                        <span className="font-body text-[13px]">{child.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
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
