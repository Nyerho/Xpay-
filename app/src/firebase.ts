import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'

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
export const storage = getStorage(firebaseApp)
export const auth = getAuth(firebaseApp)

export async function initAnalytics() {
  if (!import.meta.env.PROD) return null
  if (typeof window === 'undefined') return null
  const ok = await isSupported()
  if (!ok) return null
  return getAnalytics(firebaseApp)
}

function makeId() {
  const a = Math.random().toString(16).slice(2)
  const b = Date.now().toString(16)
  return `${b}-${a}`
}

export async function uploadPublicFile(params: { folder: string; file: File }) {
  if (!auth.currentUser) {
    await signInAnonymously(auth)
  }
  const safeName = params.file.name.replaceAll(/[^A-Za-z0-9._-]/g, '_')
  const objectPath = `${params.folder}/${makeId()}-${safeName}`
  const r = ref(storage, objectPath)
  await uploadBytes(r, params.file, { contentType: params.file.type || 'application/octet-stream' })
  return getDownloadURL(r)
}
