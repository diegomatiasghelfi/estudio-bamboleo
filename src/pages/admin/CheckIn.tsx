import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Circle, ClipboardList } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { supabase, errorMessage } from '../../lib/supabase'
import type { Booking } from '../../lib/types'
import { hhmm, toISODate } from '../../lib/format'
import { EmptyState, PageLoader } from '../../components/ui'

export default function CheckIn() {
  const toast = useToast()
  const [date, setDate] = useState(toISODate(new Date()))
  const [rows, setRows] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('*, classes(*), profiles(full_name, phone)')
      .eq('class_date', date)
      .in('status', ['confirmed', 'attended'])
    setRows((data ?? []) as Booking[])
    setLoading(false)
  }, [date])

  useEffect(() => {
    void load()
  }, [load])

  const groups = useMemo(() => {
    const map = new Map<string, Booking[]>()
    for (const b of rows) {
      if (!b.classes) continue
      map.set(b.class_id, [...(map.get(b.class_id) ?? []), b])
    }
    return [...map.values()]
      .map((list) => list.sort((a, b) => (a.profiles?.full_name ?? '').localeCompare(b.profiles?.full_name ?? '')))
      .sort((a, b) => a[0].classes!.start_time.localeCompare(b[0].classes!.start_time))
  }, [rows])

  async function toggle(b: Booking) {
    const status = b.status === 'attended' ? 'confirmed' : 'attended'
    setRows((r) => r.map((x) => (x.id === b.id ? { ...x, status } : x)))
    const { error } = await supabase.from('bookings').update({ status }).eq('id', b.id)
    if (error) {
      toast(errorMessage(error), 'error')
      void load()
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="date">Fecha</label>
        <input id="date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {loading ? (
        <PageLoader />
      ) : groups.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="Sin inscriptos" text="No hay reservas para esta fecha." />
      ) : (
        groups.map((list) => {
          const c = list[0].classes!
          const present = list.filter((b) => b.status === 'attended').length
          return (
            <section key={c.id} className="card overflow-hidden">
              <header className="flex items-center justify-between gap-3 border-b border-cream-200 bg-cream-100/60 px-4 py-3">
                <div>
                  <p className="font-serif text-lg font-semibold leading-tight">{c.title}</p>
                  <p className="text-xs text-cocoa-400">{hhmm(c.start_time)} a {hhmm(c.end_time)}{c.location ? ` · ${c.location}` : ''}</p>
                </div>
                <span className="text-sm font-semibold">{present}/{list.length}</span>
              </header>
              <ul className="divide-y divide-cream-200">
                {list.map((b) => (
                  <li key={b.id}>
                    <button onClick={() => toggle(b)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cream-100/60">
                      {b.status === 'attended' ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <Circle className="h-6 w-6 text-cocoa-400" />}
                      <span className="flex-1">
                        <span className="block text-sm font-semibold">{b.profiles?.full_name || 'Sin nombre'}</span>
                        <span className="block text-xs text-cocoa-400">{b.profiles?.phone}</span>
                      </span>
                      <span className={`text-xs font-semibold ${b.status === 'attended' ? 'text-emerald-700' : 'text-cocoa-400'}`}>
                        {b.status === 'attended' ? 'Presente' : 'Marcar'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}
