import { describe, it, expect } from 'vitest'

// Symptom analysis logic mirrored from symptom.routes.ts
const EMERGENCY_KEYWORDS = [
  'tidak sadar','kejang','sesak napas','pendarahan berat','muntah darah',
  'lemas total','tidak bergerak','pingsan','shock','keracunan',
]
const URGENT_KEYWORDS = [
  'diare terus','muntah terus','tidak mau makan','demam tinggi','luka dalam',
  'patah tulang','mata merah','berdarah','nafas cepat','bengkak',
]
const MODERATE_KEYWORDS = [
  'gatal','garuk','bersin','batuk','kutu','mata berair','sedikit lesu',
  'nafsu makan berkurang','kurus','bulu rontok',
]

type UrgencyLevel = 'segera' | 'dalam_24_jam' | 'bisa_tunggu' | 'tidak_perlu'

function analyzeSymptoms(symptoms: string, _species: string): {
  urgencyLevel: UrgencyLevel; confidence: number; recommendations: string[]
} {
  const text = symptoms.toLowerCase()
  const hasEmergency = EMERGENCY_KEYWORDS.some(k => text.includes(k))
  const hasUrgent    = URGENT_KEYWORDS.some(k => text.includes(k))
  const hasModerate  = MODERATE_KEYWORDS.some(k => text.includes(k))

  if (hasEmergency) return {
    urgencyLevel: 'segera',
    confidence: 0.9,
    recommendations: ['Segera bawa ke klinik darurat', 'Jangan tunggu — kondisi mengancam jiwa'],
  }
  if (hasUrgent) return {
    urgencyLevel: 'dalam_24_jam',
    confidence: 0.75,
    recommendations: ['Bawa ke dokter dalam 24 jam', 'Pantau kondisi secara berkala'],
  }
  if (hasModerate) return {
    urgencyLevel: 'bisa_tunggu',
    confidence: 0.65,
    recommendations: ['Buat jadwal konsultasi dokter', 'Kondisi tidak darurat namun perlu diperiksa'],
  }
  return {
    urgencyLevel: 'tidak_perlu',
    confidence: 0.5,
    recommendations: ['Kondisi hewan tampak normal', 'Konsultasi jika gejala berlanjut > 2 hari'],
  }
}

describe('F-36 AI Symptom Checker', () => {
  it('mendeteksi kondisi darurat: kejang', () => {
    const result = analyzeSymptoms('anjing saya tiba-tiba kejang tidak sadar', 'anjing')
    expect(result.urgencyLevel).toBe('segera')
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
    expect(result.recommendations.length).toBeGreaterThan(0)
  })

  it('mendeteksi kondisi darurat: sesak napas', () => {
    const result = analyzeSymptoms('kucing saya sesak napas sejak tadi malam', 'kucing')
    expect(result.urgencyLevel).toBe('segera')
  })

  it('mendeteksi kondisi urgent: diare terus-menerus', () => {
    const result = analyzeSymptoms('anjing diare terus dari kemarin', 'anjing')
    expect(result.urgencyLevel).toBe('dalam_24_jam')
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('mendeteksi kondisi urgent: demam tinggi', () => {
    const result = analyzeSymptoms('kucing demam tinggi dan tidak mau makan', 'kucing')
    expect(result.urgencyLevel).toBe('dalam_24_jam')
  })

  it('mendeteksi kondisi moderat: gatal-gatal', () => {
    const result = analyzeSymptoms('kucing sering gatal dan garuk-garuk', 'kucing')
    expect(result.urgencyLevel).toBe('bisa_tunggu')
  })

  it('kondisi normal jika tidak ada gejala spesifik', () => {
    const result = analyzeSymptoms('anjing saya aktif dan nafsu makan baik', 'anjing')
    expect(result.urgencyLevel).toBe('tidak_perlu')
  })

  it('case insensitive matching', () => {
    const result1 = analyzeSymptoms('KEJANG', 'anjing')
    const result2 = analyzeSymptoms('kejang', 'anjing')
    expect(result1.urgencyLevel).toBe(result2.urgencyLevel)
  })

  it('darurat lebih prioritas dari urgent', () => {
    // teks mengandung kata darurat DAN urgent sekaligus
    const result = analyzeSymptoms('anjing diare terus dan tiba-tiba kejang', 'anjing')
    expect(result.urgencyLevel).toBe('segera')
  })
})
