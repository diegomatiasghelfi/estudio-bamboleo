export type Role = 'student' | 'admin'
export type Level = 'inicial' | 'general'
export type PackLevel = 'all' | 'inicial'

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  role: Role
  created_at: string
}

export interface Pack {
  id: string
  name: string
  description: string | null
  credits: number
  price_ars: number
  allowed_level: PackLevel
  duration_days: number
  active: boolean
  sort_order: number
}

export interface UserPass {
  id: string
  user_id: string
  pack_id: string | null
  total_credits: number
  remaining_credits: number
  allowed_level: PackLevel
  activated_at: string
  expires_at: string
  status: 'active' | 'expired' | 'exhausted' | 'cancelled'
  packs?: { name: string } | null
}

export interface ClassItem {
  id: string
  title: string
  rhythm: string
  level: Level
  instructor: string | null
  day_of_week: number
  start_time: string
  end_time: string
  max_capacity: number
  active: boolean
  location: string | null
}

export interface Booking {
  id: string
  user_id: string
  class_id: string
  user_pass_id: string | null
  class_date: string
  status: 'confirmed' | 'cancelled' | 'attended'
  created_at: string
  classes?: ClassItem | null
  profiles?: Pick<Profile, 'full_name' | 'phone'> | null
}

export interface PaymentRequest {
  id: string
  user_id: string
  pack_id: string
  amount_ars: number
  receipt_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  created_at: string
  packs?: Pick<Pack, 'name' | 'credits'> | null
  profiles?: Pick<Profile, 'full_name' | 'phone'> | null
}
