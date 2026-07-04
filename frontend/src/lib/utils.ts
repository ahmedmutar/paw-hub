import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined, fmt = 'd MMMM yyyy') {
  if (!date) return '-'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt, { locale: id })
}

export function formatDateTime(date: string | Date | null | undefined) {
  return formatDate(date, 'd MMM yyyy, HH:mm')
}

export function formatRupiah(amount: number | string | null | undefined) {
  if (amount == null) return '-'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(amount))
}

export function petAge(yearAge?: number | null, monthAge?: number | null) {
  const parts: string[] = []
  if (yearAge) parts.push(`${yearAge} tahun`)
  if (monthAge) parts.push(`${monthAge} bulan`)
  return parts.join(' ') || '-'
}
