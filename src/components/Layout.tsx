import Avatar from './Avatar'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CalendarDays, Home, ShieldCheck, ShoppingBag, Ticket } from 'lucide-react'
import WhatsAppButton from './WhatsAppButton'
import { useAuth } from '../context/AuthContext'

const studentNav = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/clases', label: 'Clases', icon: CalendarDays },
  { to: '/reservas', label: 'Reservas', icon: Ticket },
  { to: '/tienda', label: 'Pases', icon: ShoppingBag },
]

export default function Layout() {
  const { profile, isAdmin, session } = useAuth()
  const location = useLocation()
  const nav = isAdmin ? [...studentNav, { to: '/admin', label: 'Admin', icon: ShieldCheck }] : studentNav
  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col">
      <header className="sticky top-0 z-30 border-b border-cream-200/70 bg-cream/90 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center justify-between px-4 py-2.5">
          <NavLink to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Estudio Bamboleo" className="h-11 w-auto" />
          </NavLink>
          <div className="flex items-center gap-2">
            {firstName && <span className="text-sm text-cocoa-600">Hola, <b className="font-semibold">{firstName}</b></span>}
            <NavLink to="/perfil" className="rounded-full ring-2 ring-white" aria-label="Mi perfil" title="Mi perfil">
              <Avatar profile={profile} email={session?.user.email} />
            </NavLink>
          </div>
        </div>
      </header>

      <main key={location.pathname.split('/')[1]} className="flex-1 px-4 pb-28 pt-5">
        <Outlet />
      </main>

      <WhatsAppButton />

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-cream-200 bg-white/95 backdrop-blur pb-safe">
        <div className="mx-auto flex max-w-xl">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 pt-2.5 pb-1 text-[11px] font-semibold transition ${isActive ? 'text-cocoa' : 'text-cocoa-400'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`rounded-full px-4 py-1 transition ${isActive ? 'bg-gold' : ''}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
