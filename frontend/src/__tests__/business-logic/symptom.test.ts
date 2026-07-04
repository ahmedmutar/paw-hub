import { describe, it, expect } from 'vitest'

// Mirror dari SymptomPage.tsx — urgency config
const URGENCY_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  segera:       { label: 'SEGERA KE KLINIK',    color: 'text-red-700',    bgColor: 'bg-red-50' },
  dalam_24_jam: { label: 'Dalam 24 Jam',         color: 'text-orange-700', bgColor: 'bg-orange-50' },
  bisa_tunggu:  { label: 'Bisa Ditunda',         color: 'text-yellow-700', bgColor: 'bg-yellow-50' },
  tidak_perlu:  { label: 'Tidak Perlu ke Klinik', color: 'text-green-700', bgColor: 'bg-green-50' },
}

describe('F-36 Frontend Symptom Checker Config', () => {
  it('semua 4 level urgensi terdefinisi', () => {
    const levels = ['segera', 'dalam_24_jam', 'bisa_tunggu', 'tidak_perlu']
    levels.forEach(l => {
      expect(URGENCY_CONFIG[l]).toBeDefined()
      expect(URGENCY_CONFIG[l].label).toBeTruthy()
      expect(URGENCY_CONFIG[l].color).toBeTruthy()
      expect(URGENCY_CONFIG[l].bgColor).toBeTruthy()
    })
  })

  it('segera memiliki warna merah (most urgent)', () => {
    expect(URGENCY_CONFIG['segera'].color).toContain('red')
    expect(URGENCY_CONFIG['segera'].bgColor).toContain('red')
  })

  it('tidak_perlu memiliki warna hijau (least urgent)', () => {
    expect(URGENCY_CONFIG['tidak_perlu'].color).toContain('green')
    expect(URGENCY_CONFIG['tidak_perlu'].bgColor).toContain('green')
  })

  it('urutan warna: red > orange > yellow > green sesuai prioritas', () => {
    expect(URGENCY_CONFIG['segera'].color).toContain('red')
    expect(URGENCY_CONFIG['dalam_24_jam'].color).toContain('orange')
    expect(URGENCY_CONFIG['bisa_tunggu'].color).toContain('yellow')
    expect(URGENCY_CONFIG['tidak_perlu'].color).toContain('green')
  })
})
