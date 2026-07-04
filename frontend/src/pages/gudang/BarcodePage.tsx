import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { QrCode, Search, Package, AlertTriangle, Check, Printer, Camera, RefreshCw } from 'lucide-react'
import BarcodeScanner from '@/components/BarcodeScanner'

interface Item {
  id: string; itemName: string; barcodeId: string | null
  hasBarcode: boolean; totalItem: number; unitName: string; categoryName: string
}
interface ScanResult {
  id: string; itemName: string; barcodeId: string
  totalItem: number; limitItem: number | null; unitName: string
  categoryName: string; sellingPrice: number | null; expiredDate: string | null; isLow: boolean
}

function fmtRp(n: number) { return `Rp${n.toLocaleString('id-ID')}` }

function PrintLabelModal({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['barcode-print', itemId],
    queryFn: () => api.get(`/gudang/barcode/print/${itemId}`).then((r: any) => r.data.data),
  })

  const handlePrint = () => {
    if (!data) return
    const w = window.open('', '_blank', 'width=400,height=400')
    if (!w) return
    w.document.write(`
      <html><head><title>Label ${data.itemName}</title>
      <style>
        body { font-family: sans-serif; margin: 0; display: flex; flex-direction: column; align-items: center; padding: 16px; }
        .label { border: 2px dashed #ccc; padding: 16px; border-radius: 8px; text-align: center; width: 250px; }
        .name { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
        .code { font-size: 10px; color: #666; margin-bottom: 8px; font-family: monospace; }
        .price { font-size: 13px; color: #0d9488; font-weight: bold; }
        .stock { font-size: 11px; color: #666; margin-top: 4px; }
        img { width: 150px; height: 150px; }
      </style></head>
      <body>
        <div class="label">
          <img src="${data.qrDataUrl}" />
          <div class="name">${data.itemName}</div>
          <div class="code">${data.barcodeId}</div>
          ${data.sellingPrice ? `<div class="price">${fmtRp(data.sellingPrice)}</div>` : ''}
          <div class="stock">Stok: ${data.stock} ${data.unitName}</div>
        </div>
      </body></html>
    `)
    w.document.close(); w.print()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <span className="font-semibold text-gray-800 text-sm">Label Barcode</span>
          <button onClick={onClose} className="text-gray-400 text-xl hover:text-gray-600">×</button>
        </div>
        <div className="p-5 space-y-4">
          {!data ? <div className="text-center py-6 text-gray-400">Memuat...</div> : (
            <>
              <div className="flex flex-col items-center">
                <img src={data.qrDataUrl} alt="QR" className="w-40 h-40" />
                <p className="font-semibold text-gray-800 mt-2">{data.itemName}</p>
                <p className="text-xs font-mono text-gray-400">{data.barcodeId}</p>
                {data.sellingPrice && <p className="text-teal-600 font-bold mt-1">{fmtRp(data.sellingPrice)}</p>}
                <p className="text-xs text-gray-400">Stok: {data.stock} {data.unitName}</p>
              </div>
              <button onClick={handlePrint}
                className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white py-2.5 rounded-xl text-sm font-medium">
                <Printer className="w-4 h-4" /> Cetak Label
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BarcodePage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'with' | 'without'>('all')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [printItemId, setPrintItemId] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  const { data: items, isLoading, refetch } = useQuery({
    queryKey: ['barcode-items', search, filter],
    queryFn: () => api.get('/gudang/barcode/items', {
      params: {
        search: search || undefined,
        hasBarcode: filter === 'with' ? 'true' : filter === 'without' ? 'false' : undefined,
      },
    }).then((r: any) => r.data.data),
  })

  const generateMutation = useMutation({
    mutationFn: (itemId: string) => api.post(`/gudang/barcode/generate/${itemId}`),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['barcode-items'] })
      setPrintItemId(res.data.data.itemId)
    },
  })

  const handleScan = async (code: string) => {
    setScanning(false)
    setScanError(null)
    try {
      const res = await api.get('/gudang/barcode/scan', { params: { code } })
      setScanResult((res as any).data.data)
    } catch (e: any) {
      setScanError(e?.response?.data?.message ?? 'Kode tidak ditemukan')
    }
  }

  const handleManualSearch = () => {
    if (manualCode.trim()) handleScan(manualCode.trim())
  }

  const itemList: Item[] = items ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <QrCode className="w-6 h-6 text-teal-600" /> Barcode & QR Scanner Gudang
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Kelola dan scan barcode barang gudang menggunakan kamera</p>
      </div>

      {/* Scan area */}
      <div className="bg-white rounded-2xl border p-5 space-y-4">
        <h3 className="font-semibold text-gray-800">Scan Barang</h3>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input value={manualCode} onChange={e => setManualCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
              placeholder="Ketik kode barcode atau scan..." className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <button onClick={handleManualSearch} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900">Cari</button>
          <button onClick={() => { setScanning(true); setScanResult(null); setScanError(null) }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm">
            <Camera className="w-4 h-4" /> Scan
          </button>
        </div>

        {scanError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {scanError}
          </div>
        )}

        {scanResult && (
          <div className={`p-4 rounded-xl border-2 ${scanResult.isLow ? 'border-amber-400 bg-amber-50' : 'border-teal-400 bg-teal-50'}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Check className="w-4 h-4 text-teal-600" />
                  <p className="font-bold text-gray-800">{scanResult.itemName}</p>
                </div>
                <p className="text-xs font-mono text-gray-500 mb-2">{scanResult.barcodeId}</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="text-gray-700">Kategori: <strong>{scanResult.categoryName}</strong></span>
                  <span className={`font-bold ${scanResult.isLow ? 'text-amber-600' : 'text-teal-600'}`}>
                    Stok: {scanResult.totalItem} {scanResult.unitName}
                    {scanResult.isLow && ' ⚠️ HAMPIR HABIS'}
                  </span>
                  {scanResult.sellingPrice && <span className="text-gray-700">Harga: <strong>{fmtRp(scanResult.sellingPrice)}</strong></span>}
                </div>
                {scanResult.expiredDate && (
                  <p className="text-xs text-gray-400 mt-1">Exp: {new Date(scanResult.expiredDate).toLocaleDateString('id-ID')}</p>
                )}
              </div>
              <button onClick={() => setScanResult(null)} className="text-gray-300 hover:text-gray-500">×</button>
            </div>
          </div>
        )}
      </div>

      {/* Items list */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama barang..." className="pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 w-56" />
            </div>
            <div className="flex rounded-lg border overflow-hidden">
              {([['all', 'Semua'], ['with', 'Punya Barcode'], ['without', 'Belum']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setFilter(v as any)}
                  className={`px-3 py-2 text-xs font-medium ${filter === v ? 'bg-teal-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => refetch()} className="p-1.5 border rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Barang</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Kategori</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Stok</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Kode Barcode</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>)
            ) : !itemList.length ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400"><Package className="w-8 h-8 mx-auto mb-2 opacity-20" />Tidak ada barang</td></tr>
            ) : itemList.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{item.itemName}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{item.categoryName}</td>
                <td className="px-4 py-3 text-right text-gray-700">{item.totalItem} {item.unitName}</td>
                <td className="px-4 py-3">
                  {item.barcodeId ? (
                    <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">{item.barcodeId}</span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {!item.barcodeId ? (
                      <button onClick={() => generateMutation.mutate(item.id)}
                        disabled={generateMutation.isPending}
                        className="text-xs px-2 py-1 bg-teal-50 text-teal-600 hover:bg-teal-100 rounded-lg font-medium">
                        Generate QR
                      </button>
                    ) : (
                      <button onClick={() => setPrintItemId(item.id)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-teal-600" title="Print Label">
                        <Printer className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {scanning && <BarcodeScanner onScan={handleScan} onClose={() => setScanning(false)} />}
      {printItemId && <PrintLabelModal itemId={printItemId} onClose={() => setPrintItemId(null)} />}
    </div>
  )
}
