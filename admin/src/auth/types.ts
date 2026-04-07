export type StaffRole = 'SUPPORT' | 'FINANCE' | 'ADMIN' | 'SUPERADMIN'

export type Me = {
  id: string
  email: string
  role: StaffRole
  isFrozen: boolean
  mfaEnabled: boolean
}

export type AuthStatus = 'loading' | 'anon' | 'authed'
