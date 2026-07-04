import { describe, it, expect } from 'vitest'

// Mirror dari MarketplacePage.tsx
function fmtRp(n: number) { return `Rp${Math.round(n).toLocaleString('id-ID')}` }
function fmtDate(d: string) {
  return d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Menunggu',   color: 'bg-yellow-100 text-yellow-700' },
  processing: { label: 'Diproses',  color: 'bg-blue-100 text-blue-700' },
  shipped:    { label: 'Dikirim',   color: 'bg-purple-100 text-purple-700' },
  done:       { label: 'Selesai',   color: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'Dibatalkan', color: 'bg-red-100 text-red-600' },
}

describe('F-42 Frontend Marketplace Utils', () => {
  it('fmtRp memformat rupiah dengan benar', () => {
    expect(fmtRp(85000)).toBe('Rp85.000')
    expect(fmtRp(1000000)).toBe('Rp1.000.000')
    expect(fmtRp(0)).toBe('Rp0')
  })

  it('fmtDate memformat tanggal', () => {
    const d = fmtDate('2026-07-01')
    expect(d).toBeTruthy()
    expect(d).not.toBe('-')
    expect(d.length).toBeGreaterThan(4)
  })

  it('fmtDate dengan string kosong mengembalikan "-"', () => {
    expect(fmtDate('')).toBe('-')
  })

  it('semua 5 status order terdefinisi', () => {
    const statuses = ['pending', 'processing', 'shipped', 'done', 'cancelled']
    statuses.forEach(s => {
      expect(ORDER_STATUS[s]).toBeDefined()
      expect(ORDER_STATUS[s].label).toBeTruthy()
    })
  })

  it('status pending menampilkan label Menunggu', () => {
    expect(ORDER_STATUS['pending'].label).toBe('Menunggu')
  })

  it('status done memiliki warna hijau', () => {
    expect(ORDER_STATUS['done'].color).toContain('green')
  })

  it('status cancelled memiliki warna merah', () => {
    expect(ORDER_STATUS['cancelled'].color).toContain('red')
  })
})
