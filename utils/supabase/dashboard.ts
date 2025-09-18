'use server'

import type { PostgrestError } from '@supabase/supabase-js'

import { createClient } from '@/utils/supabase/server'

export type SectionRow = {
  id: number
  header: string
  type: string
  status: string
  target: string
  limit: string
  reviewer: string | null
}

type RawSectionRow = {
  id: number | null
  header: string | null
  type: string | null
  status: string | null
  target: string | number | null
  limit: string | number | null
  reviewer: string | null
}

const TABLE_NAME = 'sections'

export async function fetchDashboardSections(): Promise<{
  data: SectionRow[]
  error: PostgrestError | null
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from<RawSectionRow>(TABLE_NAME)
    .select('id, header, type, status, target, limit, reviewer')
    .order('id', { ascending: true })

  if (error) {
    return { data: [], error }
  }

  const rows: SectionRow[] = (data ?? []).map((row) => ({
    id: row.id ?? 0,
    header: row.header ?? '',
    type: row.type ?? '',
    status: row.status ?? '',
    target: row.target !== null && row.target !== undefined ? String(row.target) : '',
    limit: row.limit !== null && row.limit !== undefined ? String(row.limit) : '',
    reviewer: row.reviewer,
  }))

  return { data: rows, error: null }
}
