import { describe, it, expect } from 'vitest'

// Mirror dari PajakPage.tsx — PPh21 display logic
function formatRp(n: number) {
  return `Rp${Math.round(n).toLocaleString('id-ID')}`
}

function getPtkpLabel(status: string) {
  const labels: Record<string, string> = {
    TK0: 'TK/0 (Tidak Kawin, 0 anak)',
    TK1: 'TK/1 (Tidak Kawin, 1 anak)',
    TK2: 'TK/2 (Tidak Kawin, 2 anak)',
    TK3: 'TK/3 (Tidak Kawin, 3 anak)',
    K0:  'K/0 (Kawin, 0 anak)',
    K1:  'K/1 (Kawin, 1 anak)',
    K2:  'K/2 (Kawin, 2 anak)',
    K3:  'K/3 (Kawin, 3 anak)',
  }
  return labels[status] ?? status
}

describe('F-39 Frontend PPh21 Utils', () => {
  it('formatRp memformat angka dengan benar', () => {
    expect(formatRp(1500000)).toContain('1.500.000')
    expect(formatRp(0)).toContain('0')
    expect(formatRp(125000)).toContain('125.000')
  })

  it('getPtkpLabel mengembalikan label yang benar untuk semua status', () => {
    expect(getPtkpLabel('TK0')).toContain('Tidak Kawin')
    expect(getPtkpLabel('K1')).toContain('Kawin')
    expect(getPtkpLabel('K3')).toContain('3 anak')
    expect(getPtkpLabel('UNKNOWN')).toBe('UNKNOWN')
  })

  it('semua 8 status PTKP valid memiliki label', () => {
    const valid = ['TK0','TK1','TK2','TK3','K0','K1','K2','K3']
    valid.forEach(s => {
      expect(getPtkpLabel(s)).not.toBe(s)
    })
  })
})
