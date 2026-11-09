import type { Course, Fabric, Supplier } from '@/types'
import { fabrics as seedFabrics } from '@/data/fabrics'
import { suppliers as seedSuppliers } from '@/data/suppliers'
import { courses as seedCourses } from '@/data/courses'
import { supabase } from '../supabase'

/**
 * Read-side data access. Each call tries Supabase first and falls back to seed data,
 * so UI code never needs to know which backend is active.
 * Rows keep the camelCase domain object in a `data` jsonb column next to indexed
 * scalar columns (see supabase/migrations/0001_init.sql).
 */
async function fromTable<T>(table: string, fallback: T[]): Promise<T[]> {
  if (!supabase) return fallback
  const { data, error } = await supabase.from(table).select('data')
  if (error || !data?.length) {
    if (error) console.warn(`[repository] ${table}:`, error.message)
    return fallback
  }
  return data.map((r: { data: T }) => r.data)
}

export const repository = {
  fabrics: () => fromTable<Fabric>('fabrics', seedFabrics),
  suppliers: () => fromTable<Supplier>('suppliers', seedSuppliers),
  courses: () => fromTable<Course>('courses', seedCourses),
}
