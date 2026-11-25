import { supabase } from './supabase'
import type { UserPass } from './types'

export const DEFAULT_ALIAS = 'ESTUDIO.BAMBOLEO'
export const DEFAULT_PAYMENT_NOTICE = 'Las cuotas se abonan del 1 al 15 de cada mes.'

export async function fetchSettings(): Promise<Record<string, string>> {
  const { data } = await supabase.from('settings').select('key, value')
  const out: Record<string, string> = { transfer_alias: DEFAULT_ALIAS, payment_notice: DEFAULT_PAYMENT_NOTICE }
  for (const row of (data ?? []) as { key: string; value: string }[]) out[row.key] = row.value
  return out
}

/** Pases vigentes: activos, con saldo y sin vencer, ordenados por vencimiento */
export async function fetchActivePasses(userId: string): Promise<UserPass[]> {
  const { data, error } = await supabase
    .from('user_passes')
    .select('*, packs(name)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('remaining_credits', 0)
    .gte('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as UserPass[]
}
