import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, X } from 'lucide-react'

interface Props {
  onScan: (code: string) => void
  onClose?: () => void
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const divId = 'barcode-scanner-div'
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const scanner = new Html5Qrcode(divId)
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        onScan(decodedText)
        scanner.stop().catch(() => {})
      },
      undefined,
    ).then(() => setStarted(true))
      .catch((err: any) => setError(String(err)))

    return () => {
      scanner.stop().catch(() => {})
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-teal-600" />
            <span className="font-semibold text-gray-800 text-sm">Scan QR / Barcode</span>
          </div>
          <button onClick={() => { scannerRef.current?.stop().catch(() => {}); onClose?.() }}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        {error ? (
          <div className="p-6 text-center text-sm text-red-600">
            <p className="mb-2 font-medium">Kamera tidak dapat diakses</p>
            <p className="text-gray-400 text-xs">{error}</p>
            <p className="mt-3 text-gray-500 text-xs">Pastikan Anda mengizinkan akses kamera di browser.</p>
          </div>
        ) : (
          <div className="p-4">
            <div id={divId} className="w-full" />
            {!started && (
              <div className="text-center py-4 text-sm text-gray-400">Memuat kamera...</div>
            )}
            <p className="text-xs text-gray-400 text-center mt-3">Arahkan kamera ke QR code barang</p>
          </div>
        )}
      </div>
    </div>
  )
}
