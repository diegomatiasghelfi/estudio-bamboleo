import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarCheck, Clock, MapPin } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase, errorMessage } from '../../lib/supabase'
import type { Booking } from '../../lib/types'
import { DAY_NAMES, classStart, formatDate, fromISODate, hhmm, levelLabel, toISODate } from '../../lib/format'
import { Badge, EmptyState, Modal, PageLoader, PageTitle, Spinner } from '../../components/ui'

export default function MyBookings() {
  const { session } = useAuth()
  const toast = useToast()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [toCancel, setToCancel] = useState<Booking | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('bookings')
      .select('*, classes(*)')
      .eq('user_id', session!.user.id)
      .in('status', ['confirmed', 'attended'])
      .gte('class_date', toISODate(new Date()))
      .order('class_date')
    const list = ((data ?? []) as Booking[])
      .filter((b) => b.classes)
      .sort((a, b) => (a.class_date + a.classes!.start_time).localeCompare(b.class_date + b.classes!.start_time))
    setBookings(list)
    setLoading(false)
  }, [session])

  useEffect(() => {
    void load()
  }, [load])

  const hoursLeft = (b: Booking) => (classStart(b.class_date, b.classes!.start_time).getTime() - Date.now()) / 3600000

  async function confirmCancel() {
    if (!toCancel) return
    setBusy(true)
    const { data, error } = await supabase.rpc('cancel_booking', { p_booking_id: toCancel.id })
    setBusy(false)
    setToCancel(null)
    if (error) return toast(errorMessage(error), 'error')
    toast((data as { refunded: boolean })?.refunded ? 'Reserva cancelada. Te devolvimos el pase.' : 'Reserva cancelada. El pase no se devolvió (menos de 2 h).')
    void load()
  }

  if (loading) return <PageLoader />

  const late = toCancel ? hoursLeft(toCancel) <= 2 : false

  return (
    <div>
      <PageTitle title="Mis reservas" subtitle="Podés cancelar hasta 2 horas antes y recuperar tu pase." />
      {bookings.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="h-6 w-6" />}
          title="No tenés próximas clases"
          text="Reservá tu lugar en la grilla de clases."
          action={<Link to="/clases" className="btn-primary">Ver clases</Link>}
        />
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const d = fromISODate(b.class_date)
            const started = hoursLeft(b) <= 0
            const lateWindow = hoursLeft(b) <= 2
            return (
              <article key={b.id} className="card flex gap-4 p-4">
                <div className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gold">
                  <span className="text-[10px] font-bold uppercase">{DAY_NAMES[d.getDay()].slice(0, 3)}</span>
                  <span className="font-serif text-2xl font-semibold leading-none">{d.getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif text-lg font-semibold leading-snug">{b.classes!.title}</h3>
                    {b.status === 'attended' && <Badge tone="green">Asistió</Badge>}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-cocoa-600">
                    <Clock className="h-3.5 w-3.5" /> {formatDate(b.class_date)} · {hhmm(b.classes!.start_time)} a {hhmm(b.classes!.end_time)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-cocoa-400">
                    <MapPin className="h-3.5 w-3.5" /> {b.classes!.location ?? 'Estudio Bamboleo'} · {levelLabel(b.classes!.level)}
                  </p>
                  {b.status === 'confirmed' && !started && (
                    <div className="mt-3 flex items-center justify-between gap-2">
                      {lateWindow ? <span className="text-xs font-semibold text-brick">Faltan menos de 2 h</span> : <span />}
                      <button className="btn-danger px-4 py-2" onClick={() => setToCancel(b)}>Cancelar</button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <Modal open={!!toCancel} onClose={() => !busy && setToCancel(null)} title="Cancelar reserva">
        {toCancel && (
          <div className="space-y-4">
            <p className="text-sm">
              ¿Querés cancelar <b>{toCancel.classes!.title}</b> del {formatDate(toCancel.class_date)} a las {hhmm(toCancel.classes!.start_time)}?
            </p>
            {late ? (
              <div className="flex gap-3 rounded-xl bg-red-50 p-3 text-sm text-brick">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  <b>Faltan menos de 2 horas</b> para el inicio de la clase. Si cancelás ahora <b>vas a perder el pase</b> (no se devuelve).
                </p>
              </div>
            ) : (
              <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">Como faltan más de 2 horas, te devolvemos el pase a tu pack.</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button className="btn-ghost" onClick={() => setToCancel(null)} disabled={busy}>Volver</button>
              <button className={late ? 'btn bg-brick text-white' : 'btn-primary'} onClick={confirmCancel} disabled={busy}>
                {busy && <Spinner className="h-4 w-4 text-cream" />}
                {late ? 'Cancelar igual' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
