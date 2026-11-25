import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Copy, FileText, ImageUp, Landmark, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase, errorMessage } from '../../lib/supabase'
import { fetchSettings, DEFAULT_ALIAS } from '../../lib/data'
import type { Pack } from '../../lib/types'
import { formatARS, levelLabel } from '../../lib/format'
import { PageLoader, Spinner } from '../../components/ui'

const MAX_MB = 10

export default function Checkout() {
  const { packId } = useParams()
  const { session } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pack, setPack] = useState<Pack | null>(null)
  const [alias, setAlias] = useState(DEFAULT_ALIAS)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      const [p, s] = await Promise.all([supabase.from('packs').select('*').eq('id', packId!).maybeSingle(), fetchSettings()])
      setPack((p.data as Pack) ?? null)
      setAlias(s.transfer_alias)
      setLoading(false)
    })()
  }, [packId])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  async function copyAlias() {
    try {
      await navigator.clipboard.writeText(alias)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = alias
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    toast('Alias copiado al portapapeles')
    setTimeout(() => setCopied(false), 2000)
  }

  function onFile(f: File | undefined) {
    if (!f) return
    if (f.size > MAX_MB * 1024 * 1024) return toast(`El archivo supera los ${MAX_MB} MB`, 'error')
    if (!f.type.startsWith('image/') && f.type !== 'application/pdf') return toast('Subí una foto o un PDF', 'error')
    setFile(f)
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
  }

  async function submit() {
    if (!file || !pack) return
    setBusy(true)
    try {
      const uid = session!.user.id
      const ext = (file.name.split('.').pop() || (file.type === 'application/pdf' ? 'pdf' : 'jpg')).toLowerCase()
      const path = `${uid}/${Date.now()}.${ext}`
      const up = await supabase.storage.from('receipts').upload(path, file, { contentType: file.type, upsert: false })
      if (up.error) throw up.error
      const { error } = await supabase.from('payment_requests').insert({ user_id: uid, pack_id: pack.id, amount_ars: pack.price_ars, receipt_url: path })
      if (error) throw error
      toast('¡Comprobante enviado! Te acreditamos los pases apenas lo verifiquemos.')
      navigate('/tienda')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <PageLoader />
  if (!pack) return <p className="text-center text-sm">Pack no encontrado. <Link className="underline" to="/tienda">Volver</Link></p>

  return (
    <div className="space-y-5">
      <Link to="/tienda" className="inline-flex items-center gap-1 text-sm font-semibold text-cocoa-600"><ArrowLeft className="h-4 w-4" /> Packs</Link>

      <section className="card p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-cocoa-400">Tu pack</p>
        <h1 className="mt-1 text-2xl font-semibold">{pack.name}</h1>
        <p className="mt-1 text-sm text-cocoa-400">{pack.credits} {pack.credits === 1 ? 'pase' : 'pases'} · {levelLabel(pack.allowed_level)} · vence a los 30 días</p>
        <div className="mt-4 flex items-end justify-between border-t border-cream-200 pt-4">
          <span className="text-sm text-cocoa-600">Total a transferir</span>
          <span className="font-serif text-3xl font-semibold">{formatARS(pack.price_ars)}</span>
        </div>
      </section>

      <section className="rounded-3xl bg-cocoa p-5 text-cream">
        <div className="flex items-center gap-2 text-gold"><Landmark className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-widest">Transferí a este alias</span></div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-cream/10 p-3">
          <span className="font-mono text-lg font-semibold tracking-wide">{alias}</span>
          <button onClick={copyAlias} className="btn-gold px-3 py-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <p className="mt-3 text-xs text-cream/70">Transferí exactamente {formatARS(pack.price_ars)} y subí el comprobante abajo.</p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Subí tu comprobante</h2>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        {file ? (
          <div className="card relative overflow-hidden p-3">
            <button onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = '' }} className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 shadow" aria-label="Quitar">
              <X className="h-4 w-4" />
            </button>
            {preview ? (
              <img src={preview} alt="Comprobante" className="max-h-72 w-full rounded-xl object-contain" />
            ) : (
              <div className="flex items-center gap-3 p-3"><FileText className="h-8 w-8" /><span className="truncate text-sm">{file.name}</span></div>
            )}
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-cream-200 bg-white/60 px-4 py-8 text-sm text-cocoa-600 hover:bg-white">
            <ImageUp className="h-8 w-8" />
            <span className="font-semibold">Tocá para elegir foto o PDF</span>
            <span className="text-xs text-cocoa-400">Máximo {MAX_MB} MB</span>
          </button>
        )}
      </section>

      <button className="btn-primary w-full py-4" disabled={!file || busy} onClick={submit}>
        {busy && <Spinner className="h-4 w-4 text-cream" />} Enviar comprobante
      </button>
    </div>
  )
}
