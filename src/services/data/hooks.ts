import { useEffect, useState } from 'react'
import { fabrics as seedFabrics } from '@/data/fabrics'
import { suppliers as seedSuppliers } from '@/data/suppliers'
import { courses as seedCourses } from '@/data/courses'
import { isSupabaseEnabled } from '../supabase'
import { repository } from './repository'

/**
 * Render immediately with seed data, then swap in remote rows when Supabase is configured.
 */
function useRemote<T>(seed: T[], load: () => Promise<T[]>) {
  const [data, setData] = useState<T[]>(seed)
  useEffect(() => {
    if (!isSupabaseEnabled) return
    let alive = true
    load().then((rows) => alive && setData(rows))
    return () => { alive = false }
  }, [load])
  return data
}

export const useFabrics = () => useRemote(seedFabrics, repository.fabrics)
export const useSuppliers = () => useRemote(seedSuppliers, repository.suppliers)
export const useCourses = () => useRemote(seedCourses, repository.courses)
