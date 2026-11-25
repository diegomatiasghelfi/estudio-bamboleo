export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
export const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function formatARS(n: number): string {
  return '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

/** DD/MM/YYYY en hora local */
export function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? (d.length === 10 ? fromISODate(d) : new Date(d)) : d
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${date.getFullYear()}`
}

/** YYYY-MM-DD en hora local */
export function toISODate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function hhmm(t: string): string {
  return t.slice(0, 5)
}

export function classStart(date: string, startTime: string): Date {
  const d = fromISODate(date)
  const [h, m] = startTime.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d
}

export function nextDays(n: number): Date[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    return d
  })
}

export function dayLabel(d: Date): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  return DAY_SHORT[d.getDay()]
}

export function levelLabel(level: string): string {
  if (level === 'inicial') return 'Nivel Inicial'
  if (level === 'general') return 'General'
  return 'Todos los niveles'
}
