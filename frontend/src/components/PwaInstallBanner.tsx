import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<any>(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwa-dismissed') === '1')

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt || dismissed) return null

  const install = async () => {
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setPrompt(null)
  }

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem('pwa-dismissed', '1')
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 bg-white border border-teal-200 rounded-2xl shadow-xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4">
      <div className="p-2 bg-teal-100 rounded-xl flex-shrink-0">
        <Download className="w-5 h-5 text-teal-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm">Install Paw Hub</p>
        <p className="text-xs text-gray-500 mt-0.5">Akses lebih cepat langsung dari layar utama.</p>
        <div className="flex gap-2 mt-2">
          <button onClick={install}
            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white text-xs py-1.5 rounded-lg font-medium">
            Install
          </button>
          <button onClick={dismiss}
            className="flex-1 border text-gray-500 hover:bg-gray-50 text-xs py-1.5 rounded-lg">
            Nanti
          </button>
        </div>
      </div>
      <button onClick={dismiss} className="text-gray-300 hover:text-gray-500 flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
