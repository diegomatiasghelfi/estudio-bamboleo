import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { CalendarCog, ClipboardCheck, Inbox, Tags, UserPlus } from 'lucide-react'
import { PageTitle } from '../../components/ui'
import Payments from './Payments'
import ManualCredit from './ManualCredit'
import CheckIn from './CheckIn'
import ClassesAdmin from './ClassesAdmin'
import PacksAdmin from './PacksAdmin'

const tabs = [
  { to: 'pagos', label: 'Pagos', icon: Inbox },
  { to: 'acreditar', label: 'Acreditar', icon: UserPlus },
  { to: 'checkin', label: 'Check-in', icon: ClipboardCheck },
  { to: 'clases', label: 'Clases', icon: CalendarCog },
  { to: 'precios', label: 'Precios', icon: Tags },
]

export default function AdminHome() {
  return (
    <div>
      <PageTitle title="Administración" subtitle="Panel del estudio" />
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={`/admin/${to}`} className={({ isActive }) => `${isActive ? 'chip-on' : 'chip-off'} flex items-center gap-1.5`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </NavLink>
        ))}
      </div>
      <Routes>
        <Route index element={<Navigate to="pagos" replace />} />
        <Route path="pagos" element={<Payments />} />
        <Route path="acreditar" element={<ManualCredit />} />
        <Route path="checkin" element={<CheckIn />} />
        <Route path="clases" element={<ClassesAdmin />} />
        <Route path="precios" element={<PacksAdmin />} />
        <Route path="*" element={<Navigate to="pagos" replace />} />
      </Routes>
    </div>
  )
}
