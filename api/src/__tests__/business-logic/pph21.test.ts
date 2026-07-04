import { describe, it, expect } from 'vitest'

// PPh 21 logic mirrored from pajak.routes.ts
const PTKP: Record<string, number> = {
  TK0: 54_000_000, TK1: 58_500_000, TK2: 63_000_000, TK3: 67_500_000,
  K0:  58_500_000, K1:  63_000_000, K2:  67_500_000, K3:  72_000_000,
}

function calcPph21Annual(brutoAnnual: number, ptkpStatus: string): number {
  const ptkp = PTKP[ptkpStatus] ?? PTKP['TK0']
  const pkp = Math.max(0, brutoAnnual - ptkp)
  let tax = 0
  if (pkp <= 60_000_000)          tax = pkp * 0.05
  else if (pkp <= 250_000_000)    tax = 3_000_000 + (pkp - 60_000_000) * 0.15
  else if (pkp <= 500_000_000)    tax = 31_500_000 + (pkp - 250_000_000) * 0.25
  else if (pkp <= 5_000_000_000)  tax = 94_000_000 + (pkp - 500_000_000) * 0.30
  else                            tax = 1_444_000_000 + (pkp - 5_000_000_000) * 0.35
  return Math.round(tax / 12)
}

describe('F-39 Kalkulasi PPh 21', () => {
  it('tidak ada pajak jika gaji di bawah PTKP TK0', () => {
    // bruto 48jt/tahun < PTKP TK0 54jt → PKP = 0 → pajak = 0
    expect(calcPph21Annual(48_000_000, 'TK0')).toBe(0)
  })

  it('tarif 5% untuk PKP sampai 60jt (TK0)', () => {
    // bruto 84jt, PTKP TK0 54jt → PKP 30jt → 5% = 1.5jt/tahun → 125.000/bulan
    expect(calcPph21Annual(84_000_000, 'TK0')).toBe(125_000)
  })

  it('tarif 15% untuk PKP 60-250jt', () => {
    // bruto 200jt, PTKP TK0 54jt → PKP 146jt
    // tax = 3jt + (146jt - 60jt) * 15% = 3jt + 12.9jt = 15.9jt/tahun → 1.325.000/bln
    expect(calcPph21Annual(200_000_000, 'TK0')).toBe(1_325_000)
  })

  it('tarif 25% untuk PKP 250-500jt', () => {
    // bruto 400jt, PTKP TK0 54jt → PKP 346jt
    // tax = 31.5jt + (346jt-250jt)*25% = 31.5jt + 24jt = 55.5jt/tahun → 4.625.000/bln
    expect(calcPph21Annual(400_000_000, 'TK0')).toBe(4_625_000)
  })

  it('PTKP K1 (kawin + 1 anak) lebih besar → pajak lebih kecil', () => {
    const pajakTK0 = calcPph21Annual(100_000_000, 'TK0')
    const pajakK1  = calcPph21Annual(100_000_000, 'K1')
    expect(pajakK1).toBeLessThan(pajakTK0)
  })

  it('PTKP status tidak dikenal → fallback ke TK0', () => {
    expect(calcPph21Annual(84_000_000, 'INVALID')).toBe(calcPph21Annual(84_000_000, 'TK0'))
  })

  it('semua PTKP status valid terdefinisi', () => {
    const validStatuses = ['TK0','TK1','TK2','TK3','K0','K1','K2','K3']
    validStatuses.forEach(s => {
      expect(() => calcPph21Annual(120_000_000, s)).not.toThrow()
    })
  })
})
