import midtransClient from 'midtrans-client'
import crypto from 'crypto'

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'

export const snap = new midtransClient.Snap({
  isProduction,
  serverKey: process.env.MIDTRANS_SERVER_KEY ?? '',
  clientKey: process.env.MIDTRANS_CLIENT_KEY ?? '',
})

// Verifikasi signature notifikasi webhook Midtrans:
// sha512(order_id + status_code + gross_amount + server_key)
export function verifyMidtransSignature(body: {
  order_id: string
  status_code: string
  gross_amount: string
  signature_key: string
}) {
  const expected = crypto
    .createHash('sha512')
    .update(body.order_id + body.status_code + body.gross_amount + (process.env.MIDTRANS_SERVER_KEY ?? ''))
    .digest('hex')
  return expected === body.signature_key
}
