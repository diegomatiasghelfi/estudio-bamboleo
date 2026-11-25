import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Megaphone, Trash2 } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { supabase, errorMessage } from '../../lib/supabase'
import type { NewsItem } from '../../lib/types'
import { Badge, EmptyState, PageLoader, Spinner } from '../../components/ui'

export default function NewsAdmin() {
  const toast = useToast()
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('news').select('*').order('sort_order').order('created_at', { ascending: false })
    if (error) toast(errorMessage(error), 'error')
    setItems((data ?? []) as NewsItem[])
    setLoading(false)
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!file) return toast('Elegí una imagen', 'error')
    setBusy(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const up = await supabase.storage.from('flyers').upload(path, file, { contentType: file.type, upsert: false })
    if (up.error) {
      setBusy(false)
      return toast(errorMessage(up.error), 'error')
    }
    const url = supabase.storage.from('flyers').getPublicUrl(path).data.publicUrl
    const nextOrder = items.reduce((m, n) => Math.max(m, n.sort_order), 0) + 1
    const { error } = await supabase.from('news').insert({ title: title.trim(), image_url: url, link: link.trim() || null, sort_order: nextOrder })
    setBusy(false)
    if (error) return toast(errorMessage(error), 'error')
    toast('Flyer publicado')
    setFile(null)
    setTitle('')
    setLink('')
    ;(e.target as HTMLFormElement).reset()
    void load()
  }

  async function toggle(n: NewsItem) {
    const { error } = await supabase.from('news').update({ active: !n.active }).eq('id', n.id)
    if (error) return toast(errorMessage(error), 'error')
    void load()
  }

  async function move(i: number, dir: -1 | 1) {
    const a = items[i]
    const b = items[i + dir]
    if (!a || !b) return
    const same = a.sort_order === b.sort_order
    const ao = same ? a.sort_order + dir : b.sort_order
    const bo = a.sort_order
    const r = await Promise.all([
      supabase.from('news').update({ sort_order: ao }).eq('id', a.id),
      supabase.from('news').update({ sort_order: bo }).eq('id', b.id),
    ])
    const err = r.find((x) => x.error)?.error
    if (err) toast(errorMessage(err), 'error')
    void load()
  }

  async function remove(n: NewsItem) {
    if (!window.confirm('¿Eliminar este flyer?')) return
    const { error } = await supabase.from('news').delete().eq('id', n.id)
    if (error) return toast(errorMessage(error), 'error')
    const marker = '/storage/v1/object/public/flyers/'
    const at = n.image_url.indexOf(marker)
    if (at >= 0) await supabase.storage.from('flyers').remove([n.image_url.slice(at + marker.length)])
    toast('Flyer eliminado')
    void load()
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <form onSubmit={add} className="card space-y-3 p-4">
        <p className="flex items-center gap-2 font-semibold"><ImagePlus className="h-4 w-4" /> Nuevo flyer</p>
        <p className="text-xs text-cocoa-400">Se muestra en el carrusel de Inicio. Ideal: imagen horizontal (5:4), por ejemplo 1000 × 800 px.</p>
        <div>
          <label className="label">Imagen</label>
          <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        </div>
        {file && <img src={URL.createObjectURL(file)} alt="" className="aspect-[5/4] w-full rounded-2xl object-cover" />}
        <div>
          <label className="label">Título (opcional)</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Muestra anual + social" />
        </div>
        <div>
          <label className="label">Link (opcional)</label>
          <input className="input" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://instagram.com/..." />
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-cream" />} Publicar flyer</button>
      </form>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Flyers publicados</h2>
        {items.length === 0 && <EmptyState icon={<Megaphone className="h-6 w-6" />} title="Sin novedades" text="Subí tu primer flyer arriba." />}
        {items.map((n, i) => (
          <article key={n.id} className={`card flex items-center gap-3 p-3 ${n.active ? '' : 'opacity-60'}`}>
            <img src={n.image_url} alt="" className="h-16 w-20 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold leading-snug">{n.title || 'Sin título'}</p>
              {!n.active && <Badge tone="red">Oculto</Badge>}
            </div>
            <div className="flex flex-col">
              <button className="rounded-full p-1.5 hover:bg-cream-100 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp className="h-4 w-4" /></button>
              <button className="rounded-full p-1.5 hover:bg-cream-100 disabled:opacity-30" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Bajar"><ArrowDown className="h-4 w-4" /></button>
            </div>
            <button className="rounded-full p-2 hover:bg-cream-100" onClick={() => toggle(n)} aria-label={n.active ? 'Ocultar' : 'Mostrar'}>
              {n.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
            <button className="rounded-full p-2 text-brick hover:bg-red-50" onClick={() => remove(n)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
          </article>
        ))}
      </div>
    </div>
  )
}
