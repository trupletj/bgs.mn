'use server'

import type { PostgrestError } from '@supabase/supabase-js'

import { createClient } from '@/utils/supabase/server'

export type UserSummary = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
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
