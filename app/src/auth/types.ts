export type ConsumerMe = {
  id: string
  email: string
  phone: string | null
  mfaEnabled: boolean
  isFrozen: boolean
  referralCode?: string | null
  referredById?: string | null
}

export type AuthStatus = 'loading' | 'anon' | 'authed'
