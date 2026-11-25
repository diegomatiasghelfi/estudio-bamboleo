import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarDays, Clock, Info, ShoppingBag, Sparkles, Ticket } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { fetchActivePasses } from '../../lib/data'
import type { Booking, PaymentRequest, UserPass } from '../../lib/types'
import { DAY_NAMES, formatDate, fromISODate, hhmm, levelLabel, toISODate } from '../../lib/format'
import { Badge, PageLoader } from '../../components/ui'
import InstallApp from '../../components/InstallApp'

export default function Dashboard() {
  const { profile, session } = useAuth()
  const userId = session!.user.id
  const [passes, setPasses] = useState<UserPass[]>([])
  const [nextBooking, setNextBooking] = useState<Booking | null>(null)
  const [pending, setPending] = useState<PaymentRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const [p, b, r] = await Promise.all([
        fetchActivePasses(userId).catch(() => []),
        supabase
          .from('bookings')
          .select('*, classes(*)')
          .eq('user_id', userId)
          .eq('status', 'confirmed')
          .gte('class_date', toISODate(new Date()))
          .order('class_date')
          .limit(5),
        supabase.from('payment_requests').select('*, packs(name, credits)').eq('user_id', userId).eq('status', 'pending'),
      ])
      setPasses(p)
      const upcoming = ((b.data ?? []) as Booking[]).sort((a, c) =>
        (a.class_date + a.classes!.start_time).localeCompare(c.class_date + c.classes!.start_time),
      )
      setNextBooking(upcoming[0] ?? null)
      setPending((r.data ?? []) as PaymentRequest[])
      setLoading(false)
    })()
  }, [userId])

  if (loading) return <PageLoader />

  const main = passes[0]
  const pct = main ? Math.round((main.remaining_credits / main.total_credits) * 100) : 0
  const daysLeft = main ? Math.ceil((new Date(main.expires_at).getTime() - Date.now()) / 86400000) : 0

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-cocoa-400">¡Qué bueno verte!</p>
        <h1 className="text-[1.75rem] font-semibold leading-tight">{profile?.full_name || 'Bienvenida/o'}</h1>
      </div>

      {/* Tarjeta principal de pases */}
      <section className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-cream shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/20" />
        <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-gold/10" />
        {main ? (
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-gold">Mis pases vigentes</span>
              {main.allowed_level === 'inicial' && <Badge tone="gold">Solo Nivel Inicial</Badge>}
            </div>
            <p className="mt-3 font-serif text-5xl font-semibold leading-none">
              {main.remaining_credits}
              <span className="ml-2 font-sans text-lg font-medium text-cream/70">de {main.total_credits} pases</span>
            </p>
            <p className="mt-2 text-sm text-cream/80">{main.packs?.name ?? 'Pack'}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-cream/15">
              <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4 text-gold" />
              <span>
                Vence el <b>{formatDate(main.expires_at)}</b>
              </span>
              <span className="text-cream/60">· {daysLeft <= 0 ? 'hoy' : `${daysLeft} día${daysLeft === 1 ? '' : 's'}`}</span>
            </div>
            {passes.length > 1 && (
              <p className="mt-2 text-xs text-cream/70">
                + {passes.length - 1} pack{passes.length > 2 ? 's' : ''} más ({passes.slice(1).reduce((s, x) => s + x.remaining_credits, 0)} pases)
              </p>
            )}
          </div>
        ) : (
          <div className="relative">
            <span className="text-xs font-semibold uppercase tracking-widest text-gold">Mis pases vigentes</span>
            <p className="mt-3 font-serif text-3xl font-semibold">No tenés pases activos</p>
            <p className="mt-1 text-sm text-cream/75">Comprá un pack para empezar a reservar tus clases.</p>
          </div>
        )}
        <Link to="/tienda" className="btn-gold relative mt-5 w-full">
          <ShoppingBag className="h-4 w-4" /> Comprar / Renovar Pases
        </Link>
      </section>

      <div className="flex gap-3 rounded-2xl border border-gold-dark/50 bg-gold/30 p-4 text-sm">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          <b>Importante:</b> los pases vencen a los <b>30 días</b> de acreditados y <b>no son acumulables</b>. Los pases que no uses dentro de ese
          plazo se pierden.
        </p>
      </div>

      {pending.length > 0 && (
        <div className="card flex gap-3 p-4 text-sm">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-cocoa-400" />
          <p>
            Tenés {pending.length} pago{pending.length > 1 ? 's' : ''} en revisión ({pending.map((p) => p.packs?.name).join(', ')}). Te acreditamos los pases
            apenas lo confirmemos.
          </p>
        </div>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tu próxima clase</h2>
          <Link to="/reservas" className="text-sm font-semibold text-cocoa-600 underline-offset-2 hover:underline">Ver todas</Link>
        </div>
        {nextBooking?.classes ? (
          <div className="card flex items-center gap-4 p-4">
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gold">
              <span className="text-[10px] font-bold uppercase">{DAY_NAMES[fromISODate(nextBooking.class_date).getDay()].slice(0, 3)}</span>
              <span className="font-serif text-xl font-semibold leading-none">{fromISODate(nextBooking.class_date).getDate()}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{nextBooking.classes.title}</p>
              <p className="text-sm text-cocoa-400">
                {hhmm(nextBooking.classes.start_time)} a {hhmm(nextBooking.classes.end_time)} · {levelLabel(nextBooking.classes.level)}
              </p>
            </div>
          </div>
        ) : (
          <Link to="/clases" className="card flex items-center gap-3 p-4 text-sm hover:bg-white">
            <Sparkles className="h-5 w-5 text-cocoa-400" />
            <span>No tenés clases reservadas. <b>Reservá tu lugar</b></span>
          </Link>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/clases" className="card flex flex-col gap-2 p-4 hover:bg-white">
          <CalendarDays className="h-6 w-6" />
          <span className="font-semibold">Grilla de clases</span>
          <span className="text-xs text-cocoa-400">Próximos 7 días</span>
        </Link>
        <Link to="/reservas" className="card flex flex-col gap-2 p-4 hover:bg-white">
          <Ticket className="h-6 w-6" />
          <span className="font-semibold">Mis reservas</span>
          <span className="text-xs text-cocoa-400">Ver o cancelar</span>
        </Link>
      </div>

      {main && daysLeft <= 5 && (
        <div className="flex gap-3 rounded-2xl bg-red-50 p-4 text-sm text-brick">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Tu pack vence pronto. Usá tus pases antes del {formatDate(main.expires_at)}.</p>
        </div>
      )}

      <InstallApp />
    </div>
  )
}
