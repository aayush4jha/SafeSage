import { NavLink } from 'react-router-dom'
import { Map, Route, AlertTriangle, User, Users } from 'lucide-react'
import { useSafety } from '../context/SafetyContext'

const navItems = [
  { to: '/', icon: Map, label: 'Map' },
  { to: '/family', icon: Users, label: 'Family' },
  { to: '/emergency', icon: AlertTriangle, label: 'SOS', isEmergency: true },
  { to: '/report', icon: Route, label: 'Report' },
  { to: '/profile', icon: User, label: 'Profile' },
]

export default function NavigationBar() {
  const { activeEmergency } = useSafety()

  return (
    <nav className="bottom-nav">
      {navItems.map(({ to, icon: Icon, label, isEmergency }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `bottom-nav-item${isActive ? ' active' : ''}${
              isEmergency ? ' emergency-tab' : ''
            }${isEmergency && activeEmergency ? ' has-emergency' : ''}`
          }
        >
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
