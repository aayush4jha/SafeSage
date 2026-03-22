import { useAuth } from '../context/AuthContext'

export default function TopNavBar({ title, subtitle, statusBadge, children }) {
  const { user } = useAuth()

  return (
    <header className="flex justify-between items-center h-14 md:h-16 px-4 md:px-8 sticky top-0 bg-white/80 backdrop-blur-md z-40 shadow-sm shadow-slate-200/50">
      <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
        {title && (
          <h2 className="text-base md:text-lg font-black tracking-tight text-slate-900 font-headline truncate">{title}</h2>
        )}
        {subtitle && (
          <>
            <span className="material-symbols-outlined text-slate-300 text-xs hidden sm:inline">chevron_right</span>
            <span className="text-xs md:text-sm font-bold text-primary hidden sm:inline">{subtitle}</span>
          </>
        )}
        {statusBadge && <div className="hidden sm:block">{statusBadge}</div>}
      </div>
      <div className="flex items-center gap-3 md:gap-6 shrink-0">
        {children}
        {/* Notifications */}
        <button className="hover:bg-slate-100 rounded-full p-2 transition-all relative">
          <span className="material-symbols-outlined text-slate-600">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full ring-2 ring-white"></span>
        </button>
        {/* User - hidden on mobile */}
        <div className="hidden md:flex items-center gap-3 pl-6 border-l border-slate-200">
          <div className="text-right">
            <p className="text-xs font-bold text-slate-900">{user?.name || 'User'}</p>
            <p className="text-[10px] text-slate-500">Guardian</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
        </div>
      </div>
    </header>
  )
}
