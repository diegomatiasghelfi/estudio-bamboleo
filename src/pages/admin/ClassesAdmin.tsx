import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { supabase, errorMessage } from '../../lib/supabase'
import type { ClassItem } from '../../lib/types'
import { DAY_NAMES, hhmm, levelLabel } from '../../lib/format'
import { Badge, Modal, PageLoader, Spinner } from '../../components/ui'

type Draft = Omit<ClassItem, 'id'> & { id?: string }

const empty: Draft = {
  title: '', rhythm: 'Salsa', level: 'general', instructor: '', day_of_week: 1,
  start_time: '19:00', end_time: '20:00', max_capacity: 20, active: true,
}

export default function ClassesAdmin() {
  const toast = useToast()
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('classes').select('*').order('day_of_week').order('start_time')
    // Lunes primero, domingo al final
    setClasses(((data ?? []) as ClassItem[]).sort((a, b) => ((a.day_of_week + 6) % 7) - ((b.day_of_week + 6) % 7) || a.start_time.localeCompare(b.start_time)))
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!draft) return
    setBusy(true)
    const { id, ...fields } = draft
    const payload = { ...fields, instructor: fields.instructor || null }
    const { error } = id ? await supabase.from('classes').update(payload).eq('id', id) : await supabase.from('classes').insert(payload)
    setBusy(false)
    if (error) return toast(errorMessage(error), 'error')
    toast(id ? 'Clase actualizada' : 'Clase creada')
    setDraft(null)
    void load()
  }

  async function toggleActive(c: ClassItem) {
    const { error } = await supabase.from('classes').update({ active: !c.active }).eq('id', c.id)
    if (error) return toast(errorMessage(error), 'error')
    void load()
  }

  async function remove(c: ClassItem) {
    if (!window.confirm(`¿Eliminar "${c.title}"? Se borran también sus reservas. Si solo querés pausarla, desactivala.`)) return
    const { error } = await supabase.from('classes').delete().eq('id', c.id)
    if (error) return toast(errorMessage(error), 'error')
    toast('Clase eliminada')
    void load()
  }

  if (loading) return <PageLoader />

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))

  return (
    <div className="space-y-3">
      <button className="btn-gold w-full" onClick={() => setDraft({ ...empty })}><Plus className="h-4 w-4" /> Nueva clase semanal</button>
      {classes.map((c) => (
        <article key={c.id} className={`card p-4 ${c.active ? '' : 'opacity-60'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-cocoa-400">{DAY_NAMES[c.day_of_week]} · {hhmm(c.start_time)} a {hhmm(c.end_time)}</p>
              <p className="font-serif text-lg font-semibold leading-snug">{c.title}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge tone={c.level === 'inicial' ? 'gold' : 'neutral'}>{levelLabel(c.level)}</Badge>
                <Badge>{c.rhythm}</Badge>
                <Badge>Cupo {c.max_capacity}</Badge>
                {!c.active && <Badge tone="red">Inactiva</Badge>}
              </div>
              {c.instructor && <p className="mt-1 text-xs text-cocoa-400">Prof.: {c.instructor}</p>}
            </div>
            <div className="flex shrink-0 gap-1">
              <button className="rounded-full p-2 hover:bg-cream-100" onClick={() => setDraft({ ...c, start_time: hhmm(c.start_time), end_time: hhmm(c.end_time) })} aria-label="Editar"><Pencil className="h-4 w-4" /></button>
              <button className="rounded-full p-2 text-brick hover:bg-red-50" onClick={() => remove(c)} aria-label="Eliminar"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
          <button className="mt-3 text-xs font-semibold underline" onClick={() => toggleActive(c)}>{c.active ? 'Desactivar' : 'Activar'}</button>
        </article>
      ))}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Editar clase' : 'Nueva clase'}>
        {draft && (
          <form onSubmit={save} className="space-y-3">
            <div>
              <label className="label">Título</label>
              <input className="input" value={draft.title} onChange={(e) => set('title', e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Ritmo / disciplina</label>
                <input className="input" value={draft.rhythm} onChange={(e) => set('rhythm', e.target.value)} required />
              </div>
              <div>
                <label className="label">Nivel</label>
                <select className="input" value={draft.level} onChange={(e) => set('level', e.target.value as Draft['level'])}>
                  <option value="general">General</option>
                  <option value="inicial">Nivel Inicial</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Profesor/a</label>
              <input className="input" value={draft.instructor ?? ''} onChange={(e) => set('instructor', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Día</label>
                <select className="input" value={draft.day_of_week} onChange={(e) => set('day_of_week', Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{DAY_NAMES[d]}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Cupo máximo</label>
                <input className="input" type="number" min={1} value={draft.max_capacity} onChange={(e) => set('max_capacity', Number(e.target.value))} required />
              </div>
              <div>
                <label className="label">Inicio</label>
                <input className="input" type="time" value={draft.start_time} onChange={(e) => set('start_time', e.target.value)} required />
              </div>
              <div>
                <label className="label">Fin</label>
                <input className="input" type="time" value={draft.end_time} onChange={(e) => set('end_time', e.target.value)} required />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.active} onChange={(e) => set('active', e.target.checked)} /> Activa (visible para alumnos)
            </label>
            <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-cream" />} Guardar</button>
          </form>
        )}
      </Modal>
    </div>
  )
}
