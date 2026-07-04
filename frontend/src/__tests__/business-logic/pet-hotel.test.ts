import { describe, it, expect } from 'vitest'

// Mirror dari PetHotelPage.tsx
function calcNights(checkIn: string, checkOut: string): number {
  const d1 = new Date(checkIn)
  const d2 = new Date(checkOut)
  return Math.max(0, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)))
}

function calcTotal(pricePerNight: number, nights: number): number {
  return pricePerNight * nights
}

const BOOKING_STATUS: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Menunggu',    color: 'bg-yellow-100 text-yellow-700' },
  checkedin:   { label: 'Check-In',   color: 'bg-blue-100 text-blue-700' },
  checkedout:  { label: 'Check-Out',  color: 'bg-green-100 text-green-700' },
  cancelled:   { label: 'Dibatalkan', color: 'bg-red-100 text-red-600' },
}

describe('F-32 Frontend Pet Hotel Utils', () => {
  it('calcNights menghitung malam dengan benar', () => {
    expect(calcNights('2026-07-01', '2026-07-03')).toBe(2)
    expect(calcNights('2026-07-01', '2026-07-08')).toBe(7)
    expect(calcNights('2026-07-01', '2026-07-01')).toBe(0)
  })

  it('calcNights tidak menghasilkan angka negatif', () => {
    // checkout sebelum checkin
    expect(calcNights('2026-07-05', '2026-07-01')).toBe(0)
  })

  it('calcTotal menghitung total harga dengan benar', () => {
    expect(calcTotal(150000, 2)).toBe(300000)
    expect(calcTotal(200000, 7)).toBe(1400000)
    expect(calcTotal(100000, 0)).toBe(0)
  })

  it('semua status booking terdefinisi', () => {
    const statuses = ['pending', 'checkedin', 'checkedout', 'cancelled']
    statuses.forEach(s => {
      expect(BOOKING_STATUS[s]).toBeDefined()
      expect(BOOKING_STATUS[s].label).toBeTruthy()
    })
  })

  it('status checkedout berwarna hijau (selesai)', () => {
    expect(BOOKING_STATUS['checkedout'].color).toContain('green')
  })
})
