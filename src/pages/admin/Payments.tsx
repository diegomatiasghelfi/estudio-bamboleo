import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, FileText, Inbox, Phone, XCircle } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { supabase, errorMessage } from '../../lib/supabase'
import type { PaymentRequest } from '../../lib/types'
import { formatARS, formatDate } from '../../lib/format'
import { EmptyState, Modal, PageLoader, Spinner } from '../../components/ui'

type Row = PaymentRequest & { signedUrl?: string | null }

export default function Payments() {
  const toast = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<Row | null>(null)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('payment_requests')
      .select('*, packs(name, credits), profiles(full_name, phone)')
      .eq('status', 'pending')
      .order('created_at')
    const list = (data ?? []) as Row[]
    const paths = list.map((r) => r.receipt_url).filter(Boolean) as string[]
    if (paths.length) {
      const { data: signed } = await supabase.storage.from('receipts').createSignedUrls(paths, 60 * 60)
      const map = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
      list.forEach((r) => (r.signedUrl = r.receipt_url ? map.get(r.receipt_url) ?? null : null))
    }
    setRows(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function approve(r: Row) {
    setBusyId(r.id)
    const { error } = await supabase.rpc('approve_payment_request', { p_request_id: r.id })
    setBusyId(null)
    if (error) return toast(errorMessage(error), 'error')
    toast(`Pases acreditados a ${r.profiles?.full_name ?? 'alumno'}`)
    void load()
  }

  async function reject() {
    if (!rejecting) return
    setBusyId(rejecting.id)
    const { error } = await supabase
      .from('payment_requests')
      .update({ status: 'rejected', admin_notes: note.trim() || 'Comprobante rechazado' })
      .eq('id', rejecting.id)
    setBusyId(null)
    setRejecting(null)
    setNote('')
    if (error) return toast(errorMessage(error), 'error')
    toast('Solicitud rechazada')
    void load()
  }

  if (loading) return <PageLoader />
  if (rows.length === 0) return <EmptyState icon={<Inbox className="h-6 w-6" />} title="No hay pagos pendientes" text="Cuando un alumno suba un comprobante, aparece acá." />

  return (
    <div className="space-y-4">
      <p className="text-sm text-cocoa-400">{rows.length} pago{rows.length > 1 ? 's' : ''} pendiente{rows.length > 1 ? 's' : ''}</p>
      {rows.map((r) => {
        const isPdf = r.receipt_url?.toLowerCase().endsWith('.pdf')
        return (
          <article key={r.id} className="card overflow-hidden">
            {r.signedUrl && !isPdf && (
              <button onClick={() => setZoom(r.signedUrl!)} className="block w-full bg-cream-100">
                <img src={r.signedUrl} alt="Comprobante" className="max-h-56 w-full object-contain" loading="lazy" />
              </button>
            )}
            {r.signedUrl && isPdf && (
              <a href={r.signedUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-cream-100 p-4 text-sm font-semibold">
                <FileText className="h-5 w-5" /> Ver comprobante PDF <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{r.profiles?.full_name || 'Sin nombre'}</p>
                  {r.profiles?.phone && (
                    <a href={`https://wa.me/${r.profiles.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-cocoa-400 underline-offset-2 hover:underline">
                      <Phone className="h-3 w-3" /> {r.profiles.phone}
                    </a>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-serif text-xl font-semibold">{formatARS(r.amount_ars)}</p>
                  <p className="text-xs text-cocoa-400">{formatDate(r.created_at)}</p>
                </div>
              </div>
              <p className="mt-2 text-sm">{r.packs?.name} · {r.packs?.credits} pases</p>
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                <button className="btn-primary" disabled={busyId === r.id} onClick={() => approve(r)}>
                  {busyId === r.id ? <Spinner className="h-4 w-4 text-cream" /> : <CheckCircle2 className="h-4 w-4" />} Aprobar y Acreditar Pases
                </button>
                <button className="btn-danger" disabled={busyId === r.id} onClick={() => setRejecting(r)}>
                  <XCircle className="h-4 w-4" /> Rechazar
                </button>
              </div>
            </div>
          </article>
        )
      })}

      <Modal open={!!zoom} onClose={() => setZoom(null)} title="Comprobante">
        {zoom && <img src={zoom} alt="Comprobante ampliado" className="w-full rounded-xl" />}
      </Modal>

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Rechazar pago">
        <div className="space-y-3">
          <p className="text-sm">El alumno verá esta nota en su historial de pagos.</p>
          <textarea className="input min-h-24" placeholder="Ej: el monto no coincide, el comprobante no es legible…" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn w-full bg-brick text-white" onClick={reject} disabled={busyId !== null}>Rechazar solicitud</button>
        </div>
      </Modal>
    </div>
  )
}
