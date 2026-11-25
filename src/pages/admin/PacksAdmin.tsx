import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Landmark, Pencil, Plus } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { supabase, errorMessage } from '../../lib/supabase'
import { fetchSettings } from '../../lib/data'
import type { Pack } from '../../lib/types'
import { formatARS, levelLabel } from '../../lib/format'
import { Badge, Modal, PageLoader, Spinner } from '../../components/ui'

type Draft = Omit<Pack, 'id'> & { id?: string }
const empty: Draft = { name: '', description: '', credits: 4, price_ars: 0, allowed_level: 'all', duration_days: 30, active: true, sort_order: 99 }

export default function PacksAdmin() {
  const toast = useToast()
  const [packs, setPacks] = useState<Pack[]>([])
  const [alias, setAlias] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([supabase.from('packs').select('*').order('sort_order').order('price_ars'), fetchSettings()])
    setPacks((p.data ?? []) as Pack[])
    setAlias(s.transfer_alias)
    setNotice(s.payment_notice)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function saveSettings(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('settings').upsert([
      { key: 'transfer_alias', value: alias.trim() },
      { key: 'payment_notice', value: notice.trim() },
    ])
    if (error) return toast(errorMessage(error), 'error')
    toast('Datos de pago actualizados')
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!draft) return
    setBusy(true)
    const { id, ...fields } = draft
    const { error } = id ? await supabase.from('packs').update(fields).eq('id', id) : await supabase.from('packs').insert(fields)
    setBusy(false)
    if (error) return toast(errorMessage(error), 'error')
    toast(id ? 'Pack actualizado' : 'Pack creado')
    setDraft(null)
    void load()
  }

  if (loading) return <PageLoader />
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))

  return (
    <div className="space-y-5">
      <form onSubmit={saveSettings} className="card space-y-3 p-4">
        <p className="flex items-center gap-2 font-semibold"><Landmark className="h-4 w-4" /> Datos de transferencia</p>
        <div>
          <label className="label">Alias</label>
          <input className="input font-mono" value={alias} onChange={(e) => setAlias(e.target.value)} required />
        </div>
        <div>
          <label className="label">Aviso de pago</label>
          <input className="input" value={notice} onChange={(e) => setNotice(e.target.value)} />
        </div>
        <button className="btn-ghost w-full">Guardar datos de pago</button>
      </form>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Packs y precios</h2>
          <button className="btn-gold px-3 py-2" onClick={() => setDraft({ ...empty })}><Plus className="h-4 w-4" /> Nuevo</button>
        </div>
        {packs.map((p) => (
          <article key={p.id} className={`card flex items-center gap-3 p-4 ${p.active ? '' : 'opacity-60'}`}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug">{p.name}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge>{p.credits} {p.credits === 1 ? "pase" : "pases"}</Badge>
                <Badge tone={p.allowed_level === 'inicial' ? 'gold' : 'neutral'}>{levelLabel(p.allowed_level)}</Badge>
                {!p.active && <Badge tone="red">Oculto</Badge>}
              </div>
            </div>
            <p className="font-serif text-lg font-semibold">{formatARS(p.price_ars)}</p>
            <button className="rounded-full p-2 hover:bg-cream-100" onClick={() => setDraft({ ...p })} aria-label="Editar"><Pencil className="h-4 w-4" /></button>
          </article>
        ))}
      </div>

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Editar pack' : 'Nuevo pack'}>
        {draft && (
          <form onSubmit={save} className="space-y-3">
            <div>
              <label className="label">Nombre</label>
              <input className="input" value={draft.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div>
              <label className="label">Descripción</label>
              <textarea className="input min-h-20" value={draft.description ?? ''} onChange={(e) => set('description', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Precio (ARS)</label>
                <input className="input" type="number" min={0} step={500} value={draft.price_ars} onChange={(e) => set('price_ars', Number(e.target.value))} required />
              </div>
              <div>
                <label className="label">Pases</label>
                <input className="input" type="number" min={1} value={draft.credits} onChange={(e) => set('credits', Number(e.target.value))} required />
              </div>
              <div>
                <label className="label">Nivel permitido</label>
                <select className="input" value={draft.allowed_level} onChange={(e) => set('allowed_level', e.target.value as Draft['allowed_level'])}>
                  <option value="all">Todos los niveles</option>
                  <option value="inicial">Solo Nivel Inicial</option>
                </select>
              </div>
              <div>
                <label className="label">Orden</label>
                <input className="input" type="number" value={draft.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.active} onChange={(e) => set('active', e.target.checked)} /> Visible en la tienda
            </label>
            <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-cream" />} Guardar</button>
          </form>
        )}
      </Modal>
    </div>
  )
}
