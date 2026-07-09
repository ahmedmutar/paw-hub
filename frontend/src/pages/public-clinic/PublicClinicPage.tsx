import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { MapPin, Phone, Mail, Clock, Star, Calendar, Activity } from 'lucide-react'
import { PublicSymptomChecker } from '@/pages/symptom/SymptomPage'

interface ClinicData {
  id: string; branchName: string; address: string; phoneNumber: string
  email: string; operatingHours: string
  doctors: { id: string; fullname: string; imageProfile: string | null }[]
  services: { id: string; serviceName: string; serviceCategory: { serviceCategoryName: string }; price: number }[]
  avgRating: number | null; reviewCount: number
  testimonials: { rating: number; comment: string; repliedAt: string; patient: { petName: string; petCategory: string } }[]
}

function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`shrink-0 ${s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}`} style={{ width: size, height: size }} />
      ))}
    </div>
  )
}

export default function PublicClinicPage() {
  const { branchId } = useParams<{ branchId: string }>()
  const [showSymptomChecker, setShowSymptomChecker] = useState(false)

  const { data, isLoading, isError } = useQuery<ClinicData>({
    queryKey: ['public-clinic', branchId],
    queryFn: () => api.get(`/public/clinic/${branchId}`).then((r: any) => r.data.data),
    enabled: !!branchId,
  })

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-full border-4 border-teal-200 border-t-teal-600 animate-spin mx-auto" />
        <p className="text-gray-500 text-sm">Memuat profil klinik...</p>
      </div>
    </div>
  )

  if (isError || !data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-2">
        <p className="text-gray-500">Klinik tidak ditemukan.</p>
        <p className="text-xs text-gray-400">Pastikan link yang Anda gunakan benar.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Hero */}
      <header className="bg-gradient-to-br from-teal-600 to-teal-800 text-white">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🐾</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">{data.branchName}</h1>
          {data.avgRating && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <StarRow rating={Math.round(data.avgRating)} size={18} />
              <span className="text-white/80 text-sm">{data.avgRating} dari {data.reviewCount} ulasan</span>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-white/80 text-sm">
            {data.address && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{data.address}</span>}
            {data.phoneNumber && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" />{data.phoneNumber}</span>}
            {data.email && <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" />{data.email}</span>}
          </div>
          {data.operatingHours && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-white/70">
              <Clock className="w-4 h-4" /> {data.operatingHours}
            </p>
          )}
          <div className="flex flex-wrap gap-3 justify-center mt-6">
            <a href={`/booking?branchId=${branchId}`}
              className="inline-flex items-center gap-2 bg-white text-teal-700 font-semibold px-6 py-3 rounded-xl hover:bg-teal-50 transition-colors">
              <Calendar className="w-4 h-4" /> Booking Sekarang
            </a>
            <button onClick={() => setShowSymptomChecker(s => !s)}
              className="inline-flex items-center gap-2 bg-white/10 border border-white/30 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/20 transition-colors">
              <Activity className="w-4 h-4" /> Cek Gejala Hewan
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-12">
        {/* Symptom Checker */}
        {showSymptomChecker && (
          <section className="bg-white rounded-2xl border shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-1">🔍 Cek Gejala Hewan</h2>
            <p className="text-sm text-gray-400 mb-5">Dapatkan panduan awal kondisi hewan sebelum ke klinik</p>
            <PublicSymptomChecker branchId={branchId} />
          </section>
        )}

        {/* Dokter */}
        {data.doctors.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Tim Dokter Kami</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {data.doctors.map(doc => (
                <div key={doc.id} className="bg-white rounded-2xl border p-4 text-center shadow-sm">
                  <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-3">
                    {doc.imageProfile
                      ? <img src={doc.imageProfile} className="w-16 h-16 rounded-full object-cover" alt={doc.fullname} />
                      : <span className="text-2xl font-bold text-teal-600">{doc.fullname.charAt(0)}</span>}
                  </div>
                  <p className="text-sm font-semibold text-gray-800">dr. {doc.fullname}</p>
                  <p className="text-xs text-teal-600 mt-0.5">Dokter Hewan</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Layanan */}
        {data.services.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Layanan Klinik</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.services.map(svc => (
                <div key={svc.id} className="bg-white rounded-xl border p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{svc.serviceName}</p>
                    <p className="text-xs text-gray-400">{svc.serviceCategory?.serviceCategoryName}</p>
                  </div>
                  {svc.price > 0 && (
                    <p className="text-teal-600 font-semibold text-sm">Rp{Number(svc.price).toLocaleString('id-ID')}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Ulasan */}
        {data.testimonials.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Ulasan Pelanggan</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.testimonials.map((t, i) => (
                <div key={i} className="bg-white rounded-2xl border p-4 shadow-sm space-y-2">
                  <StarRow rating={t.rating} />
                  {t.comment && <p className="text-sm text-gray-700 italic">"{t.comment}"</p>}
                  <p className="text-xs text-gray-400">{t.patient.petName} ({t.patient.petCategory})</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA Footer */}
        <section className="bg-teal-50 border border-teal-100 rounded-2xl p-6 text-center">
          <h2 className="text-lg font-bold text-teal-800 mb-2">Siap Bawa Hewan Kesayangan ke {data.branchName}?</h2>
          <p className="text-sm text-teal-600 mb-4">Booking online sekarang dan dapatkan pelayanan terbaik dari tim kami</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a href={`/booking?branchId=${branchId}`} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">
              Booking Sekarang
            </a>
            {data.phoneNumber && (
              <a href={`tel:${data.phoneNumber}`} className="bg-white border border-teal-200 text-teal-700 font-semibold px-6 py-2.5 rounded-xl text-sm hover:bg-teal-50 transition-colors">
                Hubungi Kami
              </a>
            )}
          </div>
        </section>
      </main>

      <footer className="text-center py-6 text-xs text-gray-400 border-t">
        <p>Powered by <strong className="text-teal-600">Paw Hub</strong> — Sistem Manajemen Klinik Hewan</p>
      </footer>
    </div>
  )
}

