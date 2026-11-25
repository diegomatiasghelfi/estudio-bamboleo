import { useEffect, useState } from 'react'
import { Download, PlusSquare, Share } from 'lucide-react'
import { Modal } from './ui'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// El evento puede dispararse antes de que el componente se monte: lo guardamos globalmente.
let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((l) => l())
  })
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIOS() {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

export default function InstallApp({ className = '' }: { className?: string }) {
  const [, force] = useState(0)
  const [showHelp, setShowHelp] = useState(false)
  const [installed, setInstalled] = useState(() => isStandalone())

  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])

  if (installed) return null

  async function install() {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      deferredPrompt = null
      if (outcome === 'accepted') setInstalled(true)
      force((n) => n + 1)
    } else {
      setShowHelp(true)
    }
  }

  const ios = isIOS()

  return (
    <>
      <button type="button" onClick={install} className={`btn-gold w-full ${className}`}>
        <Download className="h-4 w-4" /> Instalar app en el celular
      </button>

      <Modal open={showHelp} onClose={() => setShowHelp(false)} title="Instalar Bamboleo">
        {ios ? (
          <ol className="space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold font-bold">1</span>
              <span>Abrí esta página en <b>Safari</b>.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold font-bold">2</span>
              <span>
                Tocá el botón <b>Compartir</b> <Share className="inline h-4 w-4 align-text-bottom" /> (abajo, en el medio).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold font-bold">3</span>
              <span>
                Elegí <b>Agregar a pantalla de inicio</b> <PlusSquare className="inline h-4 w-4 align-text-bottom" /> y tocá <b>Agregar</b>.
              </span>
            </li>
          </ol>
        ) : (
          <ol className="space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold font-bold">1</span>
              <span>Abrí esta página en <b>Chrome</b>.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold font-bold">2</span>
              <span>Tocá los <b>tres puntitos ⋮</b> arriba a la derecha.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold font-bold">3</span>
              <span>Elegí <b>Instalar app</b> o <b>Agregar a pantalla de inicio</b>.</span>
            </li>
          </ol>
        )}
        <p className="mt-5 text-xs text-cocoa-400">Te queda el ícono de Estudio Bamboleo en el celular y se abre como cualquier app.</p>
      </Modal>
    </>
  )
}
