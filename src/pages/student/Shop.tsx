import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Info, Receipt } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { fetchSettings } from '../../lib/data'
import type { Pack, PaymentRequest } from '../../lib/types'
import { formatARS, formatDate } from '../../lib/format'
import { Badge, PageLoader, PageTitle } from '../../components/ui'

export default function Shop() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [packs, setPacks] = useState<Pack[]>([])
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const [p, r, s] = await Promise.all([
        supabase.from('packs').select('*').eq('active', true).order('sort_order').order('price_ars'),
        supabase.from('payment_requests').select('*, packs(name, credits)').eq('user_id', session!.user.id).order('created_at', { ascending: false }).limit(5),
        fetchSettings(),
      ])
      setPacks((p.data ?? []) as Pack[])
      setRequests((r.data ?? []) as PaymentRequest[])
      setNotice(s.payment_notice)
      setLoading(false)
    })()
  }, [session])

  if (loading) return <PageLoader />

  return (
    <div>
      <PageTitle title="Comprar pases" subtitle="Elegí tu pack y pagá por transferencia." />

      <div className="mb-5 flex gap-3 rounded-2xl border border-gold-dark/50 bg-gold/30 p-4 text-sm">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <p>Los pases vencen a los <b>30 días</b> y <b>no son acumulables</b>. {notice}</p>
      </div>

      <div className="space-y-3">
        {packs.map((p) => (
          <button key={p.id} onClick={() => navigate(`/tienda/${p.id}`)} className="card flex w-full items-center gap-4 p-4 text-left transition hover:bg-white active:scale-[0.99]">
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-cream-100">
              <span className="font-serif text-2xl font-semibold leading-none">{p.credits}</span>
              <span className="text-[10px] font-semibold uppercase text-cocoa-400">{p.credits === 1 ? 'pase' : 'pases'}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="font-semibold leading-snug">{p.name}</h3>
                {p.allowed_level === 'inicial' && <Badge tone="gold">Nivel Inicial</Badge>}
              </div>
              {p.description && <p className="mt-0.5 line-clamp-2 text-xs text-cocoa-400">{p.description}</p>}
              <p className="mt-1 font-serif text-xl font-semibold">{formatARS(p.price_ars)}</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-cocoa-400" />
          </button>
        ))}
      </div>

      {requests.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold"><Receipt className="h-5 w-5" /> Mis pagos</h2>
          <div className="card divide-y divide-cream-200">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-3.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.packs?.name}</p>
                  <p className="text-xs text-cocoa-400">{formatDate(r.created_at)} · {formatARS(r.amount_ars)}</p>
                  {r.status === 'rejected' && r.admin_notes && <p className="mt-0.5 text-xs text-brick">{r.admin_notes}</p>}
                </div>
                <Badge tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'gold'}>
                  {r.status === 'approved' ? 'Aprobado' : r.status === 'rejected' ? 'Rechazado' : 'En revisión'}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
