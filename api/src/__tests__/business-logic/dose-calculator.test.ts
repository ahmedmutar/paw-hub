import { describe, it, expect } from 'vitest'

// Dose calculator logic mirrored from clinical.routes.ts
function calcDose(weightKg: number, dosagePerKgMin: number, dosagePerKgMax: number) {
  const minDose = weightKg * dosagePerKgMin
  const maxDose = weightKg * dosagePerKgMax
  return {
    minDose: Math.round(minDose * 100) / 100,
    maxDose: Math.round(maxDose * 100) / 100,
    recommendation: `${Math.round(minDose * 100) / 100}–${Math.round(maxDose * 100) / 100} mg per pemberian`,
  }
}

describe('F-37 Drug Dose Calculator', () => {
  it('menghitung dosis untuk amoxicillin (10-20 mg/kg)', () => {
    const result = calcDose(5, 10, 20) // kucing 5kg
    expect(result.minDose).toBe(50)
    expect(result.maxDose).toBe(100)
    expect(result.recommendation).toBe('50–100 mg per pemberian')
  })

  it('menghitung dosis untuk anjing besar (25kg)', () => {
    const result = calcDose(25, 10, 20)
    expect(result.minDose).toBe(250)
    expect(result.maxDose).toBe(500)
  })

  it('menangani dosis dengan nilai desimal', () => {
    const result = calcDose(3.5, 5, 10)
    expect(result.minDose).toBe(17.5)
    expect(result.maxDose).toBe(35)
  })

  it('berat 0 menghasilkan dosis 0', () => {
    const result = calcDose(0, 10, 20)
    expect(result.minDose).toBe(0)
    expect(result.maxDose).toBe(0)
  })

  it('jika min === max, range tepat sama', () => {
    const result = calcDose(10, 5, 5)
    expect(result.minDose).toBe(result.maxDose)
    expect(result.recommendation).toContain('50–50')
  })

  it('pembulatan ke 2 desimal', () => {
    const result = calcDose(3, 3.333, 6.666)
    expect(result.minDose).toBe(10)
    expect(result.maxDose).toBe(20)
  })
})
