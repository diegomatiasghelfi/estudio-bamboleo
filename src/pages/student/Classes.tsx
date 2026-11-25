import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarX2, Clock, User, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase, errorMessage } from '../../lib/supabase'
import type { ClassItem, Level } from '../../lib/types'
import { classStart, dayLabel, formatDate, hhmm, levelLabel, nextDays, toISODate } from '../../lib/format'
import { Badge, EmptyState, PageLoader, PageTitle, Spinner } from '../../components/ui'

interface Slot {
  cls: ClassItem
  date: string
  booked: number
  mine: boolean
}

export default function Classes() {
  const { session } = useAuth()
  const toast = useToast()
  const days = useMemo(() => nextDays(7), [])
  const [selectedDay, setSelectedDay] = useState<string>('all')
  const [level, setLevel] = useState<'all' | Level>('all')
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [occupancy, setOccupancy] = useState<Record<string, number>>({})
  const [mine, setMine] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const from = toISODate(days[0])
  const to = toISODate(days[days.length - 1])

  const load = useCallback(async () => {
    const [c, o, b] = await Promise.all([
      supabase.from('classes').select('*').eq('active', true).order('start_time'),
      supabase.rpc('get_class_occupancy', { p_from: from, p_to: to }),
      supabase.from('bookings').select('class_id, class_date').eq('user_id', session!.user.id).neq('status', 'cancelled').gte('class_date', from).lte('class_date', to),
    ])
    setClasses((c.data ?? []) as ClassItem[])
    const occ: Record<string, number> = {}
    for (const r of (o.data ?? []) as { class_id: string; class_date: string; booked: number }[]) occ[`${r.class_id}|${r.class_date}`] = r.booked
    setOccupancy(occ)
    setMine(new Set(((b.data ?? []) as { class_id: string; class_date: string }[]).map((r) => `${r.class_id}|${r.class_date}`)))
    setLoading(false)
  }, [from, to, session])

  useEffect(() => {
    void load()
  }, [load])

  const slotsByDay = useMemo(() => {
    const now = new Date()
    return days.map((d) => {
      const iso = toISODate(d)
      const slots: Slot[] = classes
        .filter((c) => c.day_of_week === d.getDay())
        .filter((c) => level === 'all' || c.level === level)
        .filter((c) => classStart(iso, c.start_time) > now)
        .map((c) => ({ cls: c, date: iso, booked: occupancy[`${c.id}|${iso}`] ?? 0, mine: mine.has(`${c.id}|${iso}`) }))
      return { date: d, iso, slots }
    })
  }, [days, classes, level, occupancy, mine])

  async function book(slot: Slot) {
    const key = `${slot.cls.id}|${slot.date}`
    setBusyKey(key)
    const { error } = await supabase.rpc('book_class', { p_class_id: slot.cls.id, p_class_date: slot.date })
    setBusyKey(null)
    if (error) {
      toast(errorMessage(error), 'error')
    } else {
      toast(`¡Reservaste ${slot.cls.title} el ${formatDate(slot.date)} a las ${hhmm(slot.cls.start_time)}!`)
    }
    void load()
  }

  if (loading) return <PageLoader />

  const visible = slotsByDay.filter((d) => selectedDay === 'all' || d.iso === selectedDay)
  const total = visible.reduce((s, d) => s + d.slots.length, 0)

  return (
    <div>
      <PageTitle title="Clases" subtitle="Próximos 7 días. Cada reserva usa 1 pase." />

      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
        <button className={selectedDay === 'all' ? 'chip-on' : 'chip-off'} onClick={() => setSelectedDay('all')}>Todos</button>
        {days.map((d) => {
          const iso = toISODate(d)
          return (
            <button key={iso} className={selectedDay === iso ? 'chip-on' : 'chip-off'} onClick={() => setSelectedDay(iso)}>
              {dayLabel(d)} {d.getDate()}
            </button>
          )
        })}
      </div>
      <div className="mb-5 flex gap-2">
        {(['all', 'inicial', 'general'] as const).map((l) => (
          <button key={l} className={level === l ? 'chip-on' : 'chip-off'} onClick={() => setLevel(l)}>
            {l === 'all' ? 'Todos los niveles' : levelLabel(l)}
          </button>
        ))}
      </div>

      {total === 0 ? (
        <EmptyState icon={<CalendarX2 className="h-6 w-6" />} title="No hay clases para este filtro" text="Probá con otro día o nivel." />
      ) : (
        <div className="space-y-6">
          {visible
            .filter((d) => d.slots.length > 0)
            .map((d) => (
              <section key={d.iso}>
                <h2 className="mb-2 text-base font-semibold">
                  {(() => {
                    const label = dayLabel(d.date)
                    const full = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d.date)
                    const text = label === 'Hoy' || label === 'Mañana' ? `${label}, ${full}` : full
                    return text.charAt(0).toUpperCase() + text.slice(1)
                  })()}
                </h2>
                <div className="space-y-3">
                  {d.slots.map((slot) => {
                    const left = slot.cls.max_capacity - slot.booked
                    const key = `${slot.cls.id}|${slot.date}`
                    return (
                      <article key={key} className="card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              <Badge tone={slot.cls.level === 'inicial' ? 'gold' : 'neutral'}>{levelLabel(slot.cls.level)}</Badge>
                              <Badge>{slot.cls.rhythm}</Badge>
                            </div>
                            <h3 className="font-serif text-lg font-semibold leading-snug">{slot.cls.title}</h3>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-serif text-xl font-semibold">{hhmm(slot.cls.start_time)}</p>
                            <p className="text-xs text-cocoa-400">a {hhmm(slot.cls.end_time)}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex flex-col gap-1 text-xs text-cocoa-600">
                            {slot.cls.instructor && (
                              <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> {slot.cls.instructor}</span>
                            )}
                            <span className={`flex items-center gap-1.5 ${left <= 3 ? 'font-semibold text-brick' : ''}`}>
                              <Users className="h-3.5 w-3.5" /> {left > 0 ? `${left} cupo${left === 1 ? '' : 's'} libre${left === 1 ? '' : 's'}` : 'Sin cupo'}
                            </span>
                          </div>
                          {slot.mine ? (
                            <Badge tone="green">✓ Reservada</Badge>
                          ) : (
                            <button className="btn-primary px-5 py-2.5" disabled={left <= 0 || busyKey !== null} onClick={() => book(slot)}>
                              {busyKey === key ? <Spinner className="h-4 w-4 text-cream" /> : <Clock className="h-4 w-4" />}
                              {left <= 0 ? 'Completa' : 'Reservar'}
                            </button>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  )
}
