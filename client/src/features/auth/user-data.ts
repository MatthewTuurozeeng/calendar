import { createContext, useContext } from 'react'
import type { Tables } from '../../types/database'

export type Profile = Tables<'profiles'>
export type Category = Tables<'categories'>

export type UserData = {
  profile: Profile
  categories: Category[]
}

export const UserDataContext = createContext<UserData | null>(null)

/** Profile and active categories; only valid below <RequireAuth>. */
export function useUserData(): UserData {
  const data = useContext(UserDataContext)
  if (!data) throw new Error('useUserData must be used below <RequireAuth>')
  return data
}
