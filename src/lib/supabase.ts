import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true } })
  : (null as unknown as SupabaseClient)

export function errorMessage(err: unknown): string {
  if (!err) return 'Ocurrió un error inesperado'
  if (typeof err === 'string') return err
  const e = err as { message?: string }
  const msg = e.message ?? 'Ocurrió un error inesperado'
  if (msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos'
  if (msg.includes('User already registered')) return 'Ese email ya está registrado'
  if (msg.includes('Email not confirmed')) return 'Confirmá tu email antes de ingresar'
  if (msg.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres'
  return msg
}
