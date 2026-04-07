export type ConsumerMe = {
  id: string
  email: string
  phone: string | null
  mfaEnabled: boolean
  isFrozen: boolean
}

export type AuthStatus = 'loading' | 'anon' | 'authed'
