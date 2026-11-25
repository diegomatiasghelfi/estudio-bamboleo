export default function SetupNeeded() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <img src="/logo.png" alt="Estudio Bamboleo" className="mb-6 w-56" />
      <h1 className="text-2xl font-semibold">Falta conectar Supabase</h1>
      <p className="mt-2 max-w-sm text-sm text-cocoa-400">
        Configurá <code className="rounded bg-cream-100 px-1">VITE_SUPABASE_URL</code> y{' '}
        <code className="rounded bg-cream-100 px-1">VITE_SUPABASE_ANON_KEY</code> en el archivo <code>.env</code> (local) o en las
        variables de entorno de Vercel y volvé a desplegar.
      </p>
    </div>
  )
}
