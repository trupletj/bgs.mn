'use server'

import type { PostgrestError } from '@supabase/supabase-js'

import { createClient } from '@/utils/supabase/server'

export type UserSummary = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
}

export interface UserSearchResult {
  id: string
  bteg_id: string | null
  first_name: string | null
  last_name: string | null
  nice_name: string | null
  position_name: string | null
  department_name: string | null
  heltes_name: string | null
  phone: string | null
  register_number: string | null
}

const SEARCHABLE_FIELDS = [
  'first_name',
  'last_name',
  'nice_name',
  'position_name',
  'phone',
  'register_number',
  'department_name',
  'heltes_name',
] as const

const sanitizeIlike = (s: string) => s.replace(/[%,]/g, '')

/**
 * Multi-field, multi-word user search.
 *
 * - Splits the query on whitespace into "parts".
 * - Server narrows by OR(any field × any part).
 * - Client filters to results where EVERY part matches SOMEWHERE in the user data
 *   (so "Бат Дорж" matches a user with first="Дорж" last="Бат").
 *
 * Searches: овог, нэр, nice_name, албан тушаал, утас, регистр, газар, хэлтэс.
 */
export async function searchUsers(
  query: string,
  limit = 12,
): Promise<UserSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (!parts.length) return []

  const supabase = await createClient()

  const orConditions: string[] = []
  for (const part of parts) {
    const safe = sanitizeIlike(part)
    for (const field of SEARCHABLE_FIELDS) {
      orConditions.push(`${field}.ilike.%${safe}%`)
    }
  }

  const { data, error } = await supabase
    .from('users')
    .select(
      'id, bteg_id, first_name, last_name, nice_name, position_name, department_name, heltes_name, phone, register_number',
    )
    .eq('is_active', true)
    .or(orConditions.join(','))
    .order('last_name', { nullsFirst: false })
    .limit(limit * 4)

  if (error) {
    console.error('[searchUsers] failed:', error.message)
    return []
  }

  const lowercaseParts = parts.map((p) => p.toLowerCase())
  const filtered = (data ?? []).filter((u) => {
    const haystack = [
      u.first_name,
      u.last_name,
      u.nice_name,
      u.position_name,
      u.phone,
      u.register_number,
      u.department_name,
      u.heltes_name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return lowercaseParts.every((p) => haystack.includes(p))
  })

  return filtered.slice(0, limit) as UserSearchResult[]
}

type RawUserSummary = {
  id: string | number | null
  first_name: string | null
  last_name: string | null
  phone: string | null
}

const TABLE_NAME = process.env.NEXT_PUBLIC_SUPABASE_USERS_TABLE ?? 'users'
const TIMESTAMP_COLUMN = process.env.NEXT_PUBLIC_SUPABASE_USERS_ORDER_COLUMN ?? 'created_at'

export async function fetchLatestUsers(): Promise<{
  data: UserSummary[]
  error: PostgrestError | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('id, first_name, last_name, phone')
    .order(TIMESTAMP_COLUMN, { ascending: false, nullsFirst: false })
    .limit(10)

  if (error) {
    console.error(`Unable to read "${TABLE_NAME}" users from Supabase`, error)
    return { data: [], error }
  }

  const users: UserSummary[] = (data ?? []).map((row, index) => ({
    id: row.id !== null && row.id !== undefined ? String(row.id) : String(index),
    first_name: row.first_name ?? '',
    last_name: row.last_name ?? '',
    phone: row.phone ?? null,
  }))

  return { data: users, error: null }
}
