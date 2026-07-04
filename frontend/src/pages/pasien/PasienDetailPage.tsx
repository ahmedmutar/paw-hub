import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, PawPrint, Phone, MapPin, FileText,
  ClipboardList, AlertCircle, CalendarDays,
} from 'lucide-react'
import { api } from '@/lib/api'
import { formatDate, formatDateTime, petAge } from '@/lib/utils'
import { Badge, Button, EmptyState, Spinner } from '@/components/ui'

export default function PasienDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pasien-detail', id],
    queryFn: async () => (await api.get(`/pasien/${id}`)).data.data,
  })

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Spinner className="w-8 h-8" /></div>
  }

  if (isError || !data) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-gray-600">Gagal memuat data pasien.</p>
      </div>
    )
  }

  const p = data
  const medRec = p.medicalRecord

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate(-1)}
          className="mt-1 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h2 className="font-display font-bold text-xl text-gray-900">{p.petName}</h2>
          <p className="text-sm text-gray-500">{p.petCategory} · {p.idMember}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/rekam-medis/${p.id}`)}
          >
            <FileText className="w-3.5 h-3.5" />
            Rekam Medis Lengkap
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/pendaftaran', { state: { patientId: p.id } })}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Daftarkan Berobat
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* ── Kolom kiri ── */}
        <div className="space-y-4">
          {/* Info hewan */}
          <div className="card p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-primary-100 flex items-center justify-center">
                <PawPrint className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="font-display font-bold text-gray-900">{p.petName}</p>
                <p className="text-sm text-gray-500">{p.petCategory}</p>
              </div>
            </div>
            <dl className="space-y-2 text-sm">
              {[
                { label: 'Jenis Kelamin', value: p.petGender },
                { label: 'Umur',          value: petAge(p.petYearAge, p.petMonthAge) },
                { label: 'ID Member',     value: p.idMember },
                { label: 'Terdaftar',     value: formatDate(p.createdAt) },
                { label: 'Total Kunjungan', value: `${p._count?.registrations ?? 0}x` },
              ].map(({ label, value }) => value ? (
                <div key={label} className="flex justify-between">
                  <dt className="text-gray-400">{label}</dt>
                  <dd className="font-medium text-gray-800">{value}</dd>
                </div>
              ) : null)}
            </dl>
          </div>

          {/* Info pemilik */}
          <div className="card p-4">
            <p className="section-title mb-3">Pemilik</p>
            <p className="font-semibold text-gray-800">{p.owner.ownerName}</p>
            {p.owner.phoneNumber && (
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1.5">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                {p.owner.phoneNumber}
              </div>
            )}
            {p.owner.address && (
              <div className="flex items-start gap-2 text-sm text-gray-500 mt-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                {p.owner.address}
              </div>
            )}
          </div>

          {/* Kondisi medis singkat */}
          {medRec && (medRec.allergies || medRec.chronicConditions || medRec.specialNotes) && (
            <div className="card p-4 border-l-4 border-amber-400">
              <p className="section-title mb-3 text-amber-700">Perhatian Medis</p>
              {medRec.allergies && (
                <div className="mb-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Alergi</p>
                  <p className="text-sm text-gray-700">{medRec.allergies}</p>
                </div>
              )}
              {medRec.chronicConditions && (
                <div className="mb-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Kondisi Kronis</p>
                  <p className="text-sm text-gray-700">{medRec.chronicConditions}</p>
                </div>
              )}
              {medRec.specialNotes && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Catatan Dokter</p>
                  <p className="text-sm text-amber-700 bg-amber-50 px-2 py-1.5 rounded-lg mt-1">{medRec.specialNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Riwayat kunjungan ── */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <p className="section-title">Riwayat Kunjungan</p>
              <p className="text-xs text-gray-400 mt-0.5">10 kunjungan terakhir</p>
            </div>
            <Badge variant="gray">{p._count?.registrations ?? 0} total</Badge>
          </div>

          {p.registrations.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="w-10 h-10" />}
              title="Belum ada riwayat kunjungan"
              description="Daftarkan pasien ini untuk berobat."
            />
          ) : (
            <div className="divide-y divide-gray-50">
              {p.registrations.map((r: any) => (
                <div key={r.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono text-gray-400">{r.idNumber}</span>
                        {r.checkUpResult ? (
                          r.checkUpResult.statusPaidOff
                            ? <Badge variant="green">Lunas</Badge>
                            : r.checkUpResult.statusFinish
                              ? <Badge variant="yellow">Menunggu Bayar</Badge>
                              : <Badge variant="blue">Dalam Proses</Badge>
                        ) : (
                          <Badge variant="gray">Belum Diperiksa</Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800 truncate">{r.complaint}</p>
                      {r.checkUpResult?.diagnosa && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Dx: {r.checkUpResult.diagnosa}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-500">{formatDate(r.createdAt)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{r.doctor?.fullname}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
