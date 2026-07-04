import type { BadgeVariant } from '../../components/Badge'

interface CheckUpResult {
  statusFinish: boolean
  statusPaidOff: boolean
}

export function registrationStatusView(
  acceptanceStatus: string,
  checkUpResult?: CheckUpResult
): { label: string; variant: BadgeVariant } {
  if (acceptanceStatus === 'cancelled') return { label: 'Dibatalkan', variant: 'red' }
  if (acceptanceStatus === 'declined') return { label: 'Ditolak', variant: 'red' }
  if (acceptanceStatus === 'pending') return { label: 'Menunggu', variant: 'yellow' }

  if (acceptanceStatus === 'accepted') {
    if (!checkUpResult) return { label: 'Diterima', variant: 'blue' }
    if (checkUpResult.statusPaidOff) return { label: 'Lunas', variant: 'green' }
    if (checkUpResult.statusFinish) return { label: 'Menunggu Bayar', variant: 'teal' }
    return { label: 'Dalam Pemeriksaan', variant: 'blue' }
  }

  return { label: acceptanceStatus, variant: 'gray' }
}
