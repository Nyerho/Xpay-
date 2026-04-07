import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDhS6_cFdbjN2OFSXz3bspoDf1yoPX3Jyw',
  authDomain: 'xpay-8c1d2.firebaseapp.com',
  projectId: 'xpay-8c1d2',
  storageBucket: 'xpay-8c1d2.firebasestorage.app',
  messagingSenderId: '719200202874',
  appId: '1:719200202874:web:b88a866396cfb2b9c40bc3',
  measurementId: 'G-DQJ0WMD307',
}

export const firebaseApp = initializeApp(firebaseConfig)
export const firestore = getFirestore(firebaseApp)

export async function initAnalytics() {
  if (!import.meta.env.PROD) return null
  if (typeof window === 'undefined') return null
  const ok = await isSupported()
  if (!ok) return null
  return getAnalytics(firebaseApp)
}
