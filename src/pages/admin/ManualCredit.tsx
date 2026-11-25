import { useEffect, useState } from 'react'
import { Search, UserPlus, Wallet } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { supabase, errorMessage } from '../../lib/supabase'
import { fetchActivePasses } from '../../lib/data'
import type { Pack, Profile, UserPass } from '../../lib/types'
import { formatARS, formatDate } from '../../lib/format'
import { Badge, Spinner } from '../../components/ui'

export default function ManualCredit() {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Profile | null>(null)
  const [passes, setPasses] = useState<UserPass[]>([])
  const [packs, setPacks] = useState<Pack[]>([])
  const [packId, setPackId] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('packs').select('*').eq('active', true).order('sort_order').then(({ data }) => {
      setPacks((data ?? []) as Pack[])
      if (data?.[0]) setPackId(data[0].id)
    })
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      const safe = q.replace(/[%,()]/g, ' ')
      const { data } = await supabase.from('profiles').select('*').or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`).order('full_name').limit(15)
      setResults((data ?? []) as Profile[])
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  async function select(p: Profile) {
    setSelected(p)
    setPasses(await fetchActivePasses(p.id).catch(() => []))
  }

  async function grant() {
    if (!selected || !packId) return
    setBusy(true)
    const { error } = await supabase.rpc('admin_grant_pass', { p_user_id: selected.id, p_pack_id: packId })
    setBusy(false)
    if (error) return toast(errorMessage(error), 'error')
    toast(`Pases acreditados a ${selected.full_name}`)
    setPasses(await fetchActivePasses(selected.id).catch(() => []))
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-cocoa-400">Para pagos en efectivo en recepción: buscá al alumno y asignale un pack.</p>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa-400" />
        <input className="input pl-10" placeholder="Buscar por nombre o teléfono" value={query} onChange={(e) => setQuery(e.target.value)} />
        {searching && <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />}
      </div>

      {results.length > 0 && !selected && (
        <div className="card divide-y divide-cream-200">
          {results.map((p) => (
            <button key={p.id} onClick={() => select(p)} className="flex w-full items-center justify-between gap-3 p-3.5 text-left text-sm hover:bg-cream-100">
              <span>
                <b className="font-semibold">{p.full_name || 'Sin nombre'}</b>
                <span className="block text-xs text-cocoa-400">{p.phone}</span>
              </span>
              {p.role === 'admin' && <Badge tone="dark">Admin</Badge>}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="card space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-serif text-lg font-semibold">{selected.full_name}</p>
              <p className="text-xs text-cocoa-400">{selected.phone}</p>
            </div>
            <button className="text-xs font-semibold underline" onClick={() => setSelected(null)}>Cambiar</button>
          </div>

          <div>
            <p className="label">Pases vigentes</p>
            {passes.length === 0 ? (
              <p className="text-sm text-cocoa-400">No tiene pases activos.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {passes.map((p) => (
                  <li key={p.id} className="flex items-center gap-2"><Wallet className="h-4 w-4" /> {p.remaining_credits} de {p.total_credits} · {p.packs?.name} · vence {formatDate(p.expires_at)}</li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="label" htmlFor="pack">Pack a acreditar</label>
            <select id="pack" className="input" value={packId} onChange={(e) => setPackId(e.target.value)}>
              {packs.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.credits} pases · {formatARS(p.price_ars)}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary w-full" onClick={grant} disabled={busy || !packId}>
            {busy ? <Spinner className="h-4 w-4 text-cream" /> : <UserPlus className="h-4 w-4" />} Acreditar pases (vencen en 30 días)
          </button>
        </div>
      )}
    </div>
  )
}
