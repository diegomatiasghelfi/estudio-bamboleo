import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase, errorMessage } from '../lib/supabase'
import { Spinner } from '../components/ui'

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else {
        if (fullName.trim().length < 3) throw new Error('Ingresá tu nombre completo')
        if (phone.replace(/\D/g, '').length < 8) throw new Error('Ingresá un teléfono / WhatsApp válido')
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim(), phone: phone.trim() }, emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        if (!data.session) {
          setInfo('¡Listo! Te enviamos un email para confirmar tu cuenta. Después podés ingresar.')
          setMode('login')
        }
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-cream px-5 py-10">
      <div className="w-full max-w-sm">
        <img src="/logo.png" alt="Estudio Bamboleo" className="mx-auto mb-4 w-60" />
        <p className="mb-7 text-center font-serif text-lg italic text-cocoa-600">Academia de ritmos latinos</p>

        <div className="card p-5">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-cream-100 p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null) }}
                className={`rounded-lg py-2 text-sm font-semibold transition ${mode === m ? 'bg-white text-cocoa shadow-soft' : 'text-cocoa-400'}`}
              >
                {m === 'login' ? 'Ingresar' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3.5">
            {mode === 'register' && (
              <>
                <div>
                  <label className="label" htmlFor="name">Nombre completo</label>
                  <input id="name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
                </div>
                <div>
                  <label className="label" htmlFor="phone">Teléfono / WhatsApp</label>
                  <input id="phone" className="input" type="tel" inputMode="tel" placeholder="11 2345 6789" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required />
                </div>
              </>
            )}
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" className="input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div>
              <label className="label" htmlFor="pw">Contraseña</label>
              <div className="relative">
                <input
                  id="pw"
                  className="input pr-11"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={6}
                  required
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute inset-y-0 right-0 px-3 text-cocoa-400" aria-label="Mostrar contraseña">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brick">{error}</p>}
            {info && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</p>}

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy && <Spinner className="h-4 w-4 text-cream" />}
              {mode === 'login' ? 'Ingresar' : 'Crear mi cuenta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
