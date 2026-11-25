import { useEffect, type ReactNode } from 'react'
import { Loader2, X } from 'lucide-react'

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`h-5 w-5 animate-spin text-cocoa-400 ${className}`} />
}

export function PageLoader() {
  return (
    <div className="flex justify-center py-16">
      <Spinner className="h-7 w-7" />
    </div>
  )
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-[1.7rem] font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-cocoa-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 rounded-full bg-gold/50 p-3 text-cocoa">{icon}</div>
      <p className="font-serif text-lg font-semibold">{title}</p>
      {text && <p className="mt-1 text-sm text-cocoa-400">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'green' | 'red' | 'dark' }) {
  const tones = {
    neutral: 'bg-cream-100 text-cocoa-600',
    gold: 'bg-gold text-cocoa',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-brick',
    dark: 'bg-cocoa text-cream',
  }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-cocoa/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-cream p-5 pb-safe sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-cream-100" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
