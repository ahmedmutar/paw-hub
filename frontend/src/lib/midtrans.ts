// Muat script Snap.js Midtrans sekali saja, lalu resolve begitu window.snap siap.
let snapPromise: Promise<void> | null = null

export function loadMidtransSnap(): Promise<void> {
  if (window.snap) return Promise.resolve()
  if (snapPromise) return snapPromise

  const isProduction = import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === 'true'
  const src = isProduction
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js'

  snapPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.setAttribute('data-client-key', import.meta.env.VITE_MIDTRANS_CLIENT_KEY ?? '')
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Gagal memuat Midtrans Snap.js'))
    document.body.appendChild(script)
  })
  return snapPromise
}

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options?: {
        onSuccess?: (result: any) => void
        onPending?: (result: any) => void
        onError?: (result: any) => void
        onClose?: () => void
      }) => void
    }
  }
}
