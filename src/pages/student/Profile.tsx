import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Camera, CalendarDays, LogOut, MapPin, MessageCircle, Pencil, Wallet } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase, errorMessage } from '../../lib/supabase'
import { SEDES, WHATSAPP_DISPLAY, whatsappLink } from '../../lib/data'
import type { UserPass } from '../../lib/types'
import { formatDate, levelLabel } from '../../lib/format'
import { Badge, PageLoader, PageTitle, Spinner } from '../../components/ui'
import InstallApp from '../../components/InstallApp'
import Avatar, { squareJpeg } from '../../components/Avatar'

function passState(p: UserPass): { label: string; tone: 'green' | 'red' | 'neutral' } {
  const expired = new Date(p.expires_at).getTime() < Date.now()
  if (p.status === 'active' && !expired && p.remaining_credits > 0) return { label: 'Vigente', tone: 'green' }
  if (expired || p.status === 'expired') return { label: 'Vencido', tone: 'red' }
  if (p.remaining_credits === 0 || p.status === 'exhausted') return { label: 'Agotado', tone: 'neutral' }
  return { label: p.status, tone: 'neutral' }
}

export default function Profile() {
  const { session, profile, refreshProfile, signOut } = useAuth()
  const toast = useToast()
  const [passes, setPasses] = useState<UserPass[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase
      .from('user_passes')
      .select('*, packs(name)')
      .eq('user_id', session!.user.id)
      .order('activated_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setPasses((data ?? []) as UserPass[])
        setLoading(false)
      })
  }, [session])

  useEffect(() => {
    setName(profile?.full_name ?? '')
    setPhone(profile?.phone ?? '')
  }, [profile])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), phone: phone.trim() }).eq('id', session!.user.id)
    setBusy(false)
    if (error) return toast(errorMessage(error), 'error')
    await refreshProfile()
    setEditing(false)
    toast('Datos actualizados')
  }

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return toast('Elegí una imagen', 'error')
    setUploading(true)
    try {
      const blob = await squareJpeg(file)
      const uid = session!.user.id
      const path = `${uid}/avatar-${Date.now()}.jpg`
      const up = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (up.error) throw up.error
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', uid)
      if (error) throw error
      // Borra fotos anteriores
      const old = profile?.avatar_url?.split('/avatars/')[1]
      if (old && old !== path) await supabase.storage.from('avatars').remove([old])
      await refreshProfile()
      toast('Foto actualizada')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Mi perfil" />

      <section className="card p-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="relative shrink-0 rounded-full"
            aria-label="Cambiar foto de perfil"
          >
            <Avatar profile={profile} email={session?.user.email} className="h-20 w-20 font-serif text-2xl" />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-cocoa text-cream ring-2 ring-white">
              {uploading ? <Spinner className="h-3.5 w-3.5 text-cream" /> : <Camera className="h-3.5 w-3.5" />}
            </span>
          </button>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-xl font-semibold">{profile?.full_name || 'Sin nombre'}</p>
            <p className="truncate text-sm text-cocoa-400">{session?.user.email}</p>
            {profile?.phone && <p className="text-sm text-cocoa-400">{profile.phone}</p>}
          </div>
          {!editing && (
            <button className="rounded-full p-2 hover:bg-cream-100" onClick={() => setEditing(true)} aria-label="Editar datos">
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
        {editing && (
          <form onSubmit={save} className="mt-4 space-y-3 border-t border-cream-200 pt-4">
            <div>
              <label className="label">Nombre completo</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Teléfono / WhatsApp</label>
              <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
              <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4 text-cream" />} Guardar</button>
            </div>
          </form>
        )}
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold"><Wallet className="h-5 w-5" /> Mis membresías</h2>
        {loading ? (
          <PageLoader />
        ) : passes.length === 0 ? (
          <p className="card p-4 text-sm text-cocoa-400">Todavía no tenés packs. Compralos desde la pestaña Pases.</p>
        ) : (
          <div className="space-y-3">
            {passes.map((p) => {
              const st = passState(p)
              const used = p.total_credits - p.remaining_credits
              return (
                <article key={p.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug">{p.packs?.name ?? 'Pack'}</p>
                      <p className="text-xs text-cocoa-400">{levelLabel(p.allowed_level)}</p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-cream-100 p-2.5">
                      <p className="font-semibold uppercase tracking-wide text-cocoa-400">Desde</p>
                      <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(p.activated_at)}</p>
                    </div>
                    <div className="rounded-xl bg-cream-100 p-2.5">
                      <p className="font-semibold uppercase tracking-wide text-cocoa-400">Vence</p>
                      <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(p.expires_at)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-cocoa-600">Clases usadas</span>
                    <b>{used}/{p.total_credits}</b>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cream-200">
                    <div className="h-full rounded-full bg-cocoa" style={{ width: `${(used / p.total_credits) * 100}%` }} />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Sedes</h2>
        <div className="card divide-y divide-cream-200">
          {SEDES.map((s) => (
            <a key={s.name} href={s.maps} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 hover:bg-cream-100/60">
              <span className="rounded-full bg-gold/60 p-2"><MapPin className="h-4 w-4" /></span>
              <span>
                <b className="block text-sm font-semibold">{s.name}</b>
                <span className="text-xs text-cocoa-400">{s.days}</span>
              </span>
            </a>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Contacto</h2>
        <a href={whatsappLink()} target="_blank" rel="noreferrer" className="card flex items-center gap-3 p-4 hover:bg-white">
          <span className="rounded-full bg-[#25D366]/15 p-2 text-[#1a9e4b]"><MessageCircle className="h-4 w-4" /></span>
          <span>
            <b className="block text-sm font-semibold">WhatsApp</b>
            <span className="text-xs text-cocoa-400">{WHATSAPP_DISPLAY} · Reservá tu lugar, cupos limitados</span>
          </span>
        </a>
      </section>

      <InstallApp />

      <button className="btn-danger w-full" onClick={signOut}>
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </button>
    </div>
  )
}
