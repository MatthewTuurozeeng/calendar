import { createContext, useContext } from 'react'
import type { Tables, TablesUpdate } from '../../types/database'

export type Profile = Tables<'profiles'>
export type Category = Tables<'categories'>

export type UserData = {
  profile: Profile
  /** Active categories, for pickers. */
  categories: Category[]
  /** Active and archived categories, for colors and settings. */
  allCategories: Category[]
  /** Applies the change immediately and saves it; rolls back if the save fails. */
  updateProfile: (patch: TablesUpdate<'profiles'>) => Promise<void>
  reloadCategories: () => Promise<void>
}

export const UserDataContext = createContext<UserData | null>(null)

/** Profile and categories; only valid below <RequireAuth>. */
export function useUserData(): UserData {
  const data = useContext(UserDataContext)
  if (!data) throw new Error('useUserData must be used below <RequireAuth>')
  return data
}
