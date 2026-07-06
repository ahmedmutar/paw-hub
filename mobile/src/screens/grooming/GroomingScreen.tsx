import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/auth.store'
import { colors } from '../../theme'
import { Badge, BadgeVariant } from '../../components/Badge'
import { SearchBar } from '../../components/SearchBar'
import type { RootStackParamList } from '../../navigation/RootNavigator'

interface Session {
  id: string
  queueNumber: number
  status: 'waiting' | 'in_progress' | 'done' | 'cancelled'
  totalPrice: string
  discount: string
  isPaid: boolean
  notes?: string
  createdAt: string
  patient: { petName: string; petCategory: string; owner: { ownerName: string; phoneNumber?: string } }
  groomer: { fullname: string }
  package: { packageName: string; durationMin: number }
}

interface Stats {
  waiting: number
  inProgress: number
  doneToday: number
  revenueToday: number
}

interface PackageItem {
  id: string
  packageName: string
  description?: string
  price: string
  durationMin: number
  isActive: boolean
  branch: { branchName: string }
}

interface PatientOption {
  id: string
  petName: string
  petCategory: string
  owner: { ownerName: string }
}

interface GroomerOption {
  id: string
  fullname: string
  role: string
}

const statusView: Record<string, { label: string; variant: BadgeVariant }> = {
  waiting: { label: 'Menunggu', variant: 'yellow' },
  in_progress: { label: 'Sedang Grooming', variant: 'teal' },
  done: { label: 'Selesai', variant: 'green' },
  cancelled: { label: 'Dibatalkan', variant: 'red' },
}
const SESI_FILTERS = ['semua', 'waiting', 'in_progress', 'done', 'cancelled']

const fmtMoney = (n: string | number) =>
  Number(n).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

export default function GroomingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const canCreate = isAdmin || user?.role === 'karyawan' || user?.role === 'resepsionis'
  const canChangeStatus = isAdmin || user?.role === 'karyawan'

  const [tab, setTab] = useState<'antrian' | 'riwayat' | 'paket'>('antrian')
  const [stats, setStats] = useState<Stats | null>(null)

  const fetchStats = useCallback(() => api.get('/grooming/stats').then((res) => setStats(res.data.data)), [])
  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Antrian tab
  const [queue, setQueue] = useState<Session[]>([])
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [bookVisible, setBookVisible] = useState(false)

  const fetchQueue = useCallback(() => api.get('/grooming/antrian').then((res) => setQueue(res.data.data)), [])

  useEffect(() => {
    if (tab !== 'antrian') return
    setLoadingQueue(true)
    fetchQueue().finally(() => setLoadingQueue(false))
  }, [tab, fetchQueue])

  const onRefreshQueue = async () => {
    setRefreshing(true)
    await Promise.all([fetchQueue(), fetchStats()])
    setRefreshing(false)
  }

  const doAction = async (id: string, action: 'mulai' | 'selesai' | 'bayar' | 'cancel') => {
    try {
      await api.put(`/grooming/sesi/${id}/status`, { action })
      fetchQueue()
      fetchStats()
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    }
  }

  const confirmCancel = (id: string) => {
    Alert.alert('Batalkan sesi?', 'Tindakan ini tidak bisa dibatalkan.', [
      { text: 'Tidak', style: 'cancel' },
      { text: 'Ya, batalkan', style: 'destructive', onPress: () => doAction(id, 'cancel') },
    ])
  }

  // Riwayat tab
  const [sesiFilter, setSesiFilter] = useState('semua')
  const [search, setSearch] = useState('')
  const [sesiList, setSesiList] = useState<Session[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loadingSesi, setLoadingSesi] = useState(true)

  const fetchSesi = useCallback(
    async (pageNum = 1, append = false) => {
      const res = await api.get('/grooming/sesi', {
        params: { page: pageNum, limit: 20, status: sesiFilter === 'semua' ? undefined : sesiFilter, search: search || undefined },
      })
      const { data, totalPages: tp, page: p } = res.data
      setSesiList((prev) => (append ? [...prev, ...data] : data))
      setTotalPages(tp)
      setPage(p)
    },
    [sesiFilter, search]
  )

  useEffect(() => {
    if (tab !== 'riwayat') return
    setLoadingSesi(true)
    fetchSesi(1).finally(() => setLoadingSesi(false))
  }, [tab, fetchSesi])

  // Paket tab
  const [packages, setPackages] = useState<PackageItem[]>([])
  const [loadingPaket, setLoadingPaket] = useState(true)
  const [addPaketVisible, setAddPaketVisible] = useState(false)

  const fetchPackages = useCallback(() => api.get('/grooming/paket').then((res) => setPackages(res.data.data)), [])

  useEffect(() => {
    if (tab !== 'paket') return
    setLoadingPaket(true)
    fetchPackages().finally(() => setLoadingPaket(false))
  }, [tab, fetchPackages])

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Grooming</Text>
        <View style={styles.tabRow}>
          {(['antrian', 'riwayat', 'paket'] as const).map((t) => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'antrian' ? 'Antrian' : t === 'riwayat' ? 'Riwayat' : 'Paket'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.waiting}</Text>
            <Text style={styles.statLabel}>Menunggu</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.inProgress}</Text>
            <Text style={styles.statLabel}>Diproses</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.doneToday}</Text>
            <Text style={styles.statLabel}>Selesai Hari Ini</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { fontSize: 12 }]}>{fmtMoney(stats.revenueToday)}</Text>
            <Text style={styles.statLabel}>Omzet Hari Ini</Text>
          </View>
        </View>
      )}

      {tab === 'antrian' &&
        (loadingQueue ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.orange} size="large" />
          </View>
        ) : (
          <FlatList
            data={queue}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshQueue} tintColor={colors.orange} />}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={{ fontSize: 32 }}>✂️</Text>
                <Text style={styles.emptyText}>Belum ada antrian grooming</Text>
              </View>
            }
            renderItem={({ item }) => {
              const view = statusView[item.status]
              return (
                <View style={styles.sessionCard}>
                  <View style={styles.sessionHeaderRow}>
                    <View style={styles.queueBadge}>
                      <Text style={styles.queueNumber}>{item.queueNumber}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.petName}>{item.patient.petName} · {item.patient.petCategory}</Text>
                      <Text style={styles.rowMeta}>{item.patient.owner.ownerName}</Text>
                    </View>
                    <Badge variant={view.variant}>{view.label}</Badge>
                  </View>
                  <Text style={styles.rowMeta}>{item.package.packageName} ({item.package.durationMin} menit) · {item.groomer.fullname}</Text>
                  <Text style={styles.priceText}>{fmtMoney(item.totalPrice)}</Text>

                  {canChangeStatus && item.status === 'waiting' && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.teal }]} onPress={() => doAction(item.id, 'mulai')}>
                        <Text style={styles.actionBtnText}>Mulai</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.red }]} onPress={() => confirmCancel(item.id)}>
                        <Text style={styles.actionBtnText}>Batalkan</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {canChangeStatus && item.status === 'in_progress' && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.green }]} onPress={() => doAction(item.id, 'selesai')}>
                        <Text style={styles.actionBtnText}>Selesai</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.red }]} onPress={() => confirmCancel(item.id)}>
                        <Text style={styles.actionBtnText}>Batalkan</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {canChangeStatus && item.status === 'done' && !item.isPaid && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.green, flex: 1 }]} onPress={() => doAction(item.id, 'bayar')}>
                        <Text style={styles.actionBtnText}>Tandai Lunas</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )
            }}
          />
        ))}

      {tab === 'riwayat' && (
        <>
          <View style={styles.searchWrap}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Cari nama hewan/pemilik/groomer..." />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterRow}
            contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}
          >
            {SESI_FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setSesiFilter(f)}
                style={[styles.filterChip, sesiFilter === f && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, sesiFilter === f && styles.filterChipTextActive]}>
                  {f === 'semua' ? 'Semua' : statusView[f].label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {loadingSesi ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.orange} size="large" />
            </View>
          ) : (
            <FlatList
              data={sesiList}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              onEndReached={() => page < totalPages && fetchSesi(page + 1, true)}
              onEndReachedThreshold={0.4}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={{ fontSize: 32 }}>📖</Text>
                  <Text style={styles.emptyText}>Belum ada riwayat untuk filter ini</Text>
                </View>
              }
              renderItem={({ item }) => {
                const view = statusView[item.status]
                return (
                  <View style={styles.sessionCard}>
                    <View style={styles.bookingHeaderRow}>
                      <Text style={styles.petName}>{item.patient.petName} · {item.patient.petCategory}</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {item.isPaid && <Badge variant="green">Lunas</Badge>}
                        <Badge variant={view.variant}>{view.label}</Badge>
                      </View>
                    </View>
                    <Text style={styles.rowMeta}>{item.patient.owner.ownerName}</Text>
                    <Text style={styles.rowMeta}>{item.package.packageName} · {item.groomer.fullname}</Text>
                    <Text style={styles.rowMeta}>{format(new Date(item.createdAt), 'd MMM yyyy, HH:mm', { locale: localeId })}</Text>
                    <Text style={styles.priceText}>{fmtMoney(item.totalPrice)}</Text>
                  </View>
                )
              }}
            />
          )}
        </>
      )}

      {tab === 'paket' &&
        (loadingPaket ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.orange} size="large" />
          </View>
        ) : (
          <FlatList
            data={packages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={{ fontSize: 32 }}>📦</Text>
                <Text style={styles.emptyText}>Belum ada paket grooming</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.sessionCard}>
                <View style={styles.bookingHeaderRow}>
                  <Text style={styles.petName}>{item.packageName}</Text>
                  {!item.isActive && <Badge variant="gray">Nonaktif</Badge>}
                </View>
                {item.description && <Text style={styles.rowMeta}>{item.description}</Text>}
                <Text style={styles.rowMeta}>{item.durationMin} menit · {item.branch.branchName}</Text>
                <Text style={styles.priceText}>{fmtMoney(item.price)}</Text>
              </View>
            )}
          />
        ))}

      {tab === 'antrian' && canCreate && (
        <TouchableOpacity style={styles.fab} onPress={() => setBookVisible(true)}>
          <Text style={styles.fabText}>+ Daftar</Text>
        </TouchableOpacity>
      )}
      {tab === 'paket' && isAdmin && (
        <TouchableOpacity style={styles.fab} onPress={() => setAddPaketVisible(true)}>
          <Text style={styles.fabText}>+ Paket</Text>
        </TouchableOpacity>
      )}

      <BookSessionModal
        visible={bookVisible}
        onClose={() => setBookVisible(false)}
        onSuccess={() => {
          setBookVisible(false)
          fetchQueue()
          fetchStats()
        }}
      />
      <AddPackageModal
        visible={addPaketVisible}
        onClose={() => setAddPaketVisible(false)}
        onSuccess={() => {
          setAddPaketVisible(false)
          fetchPackages()
        }}
      />
    </View>
  )
}

function BookSessionModal({ visible, onClose, onSuccess }: { visible: boolean; onClose: () => void; onSuccess: () => void }) {
  const [patientQuery, setPatientQuery] = useState('')
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)
  const [packages, setPackages] = useState<PackageItem[]>([])
  const [selectedPackage, setSelectedPackage] = useState<PackageItem | null>(null)
  const [groomers, setGroomers] = useState<GroomerOption[]>([])
  const [selectedGroomer, setSelectedGroomer] = useState<GroomerOption | null>(null)
  const [discount, setDiscount] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible) return
    setPatientQuery('')
    setPatientOptions([])
    setSelectedPatient(null)
    setSelectedPackage(null)
    setSelectedGroomer(null)
    setDiscount('')
    setNotes('')
    api.get('/grooming/paket', { params: { isActive: 'true' } }).then((res) => setPackages(res.data.data))
    api.get('/grooming/groomer').then((res) => setGroomers(res.data.data))
  }, [visible])

  useEffect(() => {
    if (!visible || selectedPatient) return
    const t = setTimeout(() => {
      if (patientQuery.trim().length < 2) {
        setPatientOptions([])
        return
      }
      api.get('/pasien', { params: { search: patientQuery, limit: 10 } }).then((res) => setPatientOptions(res.data.data))
    }, 300)
    return () => clearTimeout(t)
  }, [patientQuery, visible, selectedPatient])

  const total = selectedPackage ? Math.max(0, Number(selectedPackage.price) - (Number(discount) || 0)) : 0
  const canSubmit = selectedPatient && selectedPackage && selectedGroomer

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await api.post('/grooming/sesi', {
        patientId: selectedPatient!.id,
        groomerId: selectedGroomer!.id,
        packageId: selectedPackage!.id,
        discount: discount ? Number(discount) : 0,
        notes: notes || undefined,
      })
      onSuccess()
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.backText}>✕ Batal</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Daftar Grooming</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.label}>Pasien</Text>
          {selectedPatient ? (
            <View style={styles.selectedBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedName}>{selectedPatient.petName} · {selectedPatient.petCategory}</Text>
                <Text style={styles.selectedSub}>{selectedPatient.owner.ownerName}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedPatient(null)}>
                <Text style={styles.changeText}>Ganti</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={patientQuery}
                onChangeText={setPatientQuery}
                placeholder="Ketik nama hewan (min 2 huruf)..."
                placeholderTextColor={colors.textSoft}
              />
              {patientOptions.map((p) => (
                <TouchableOpacity key={p.id} style={styles.optionRow} onPress={() => setSelectedPatient(p)}>
                  <Text style={styles.optionName}>{p.petName} · {p.petCategory}</Text>
                  <Text style={styles.optionSub}>{p.owner.ownerName}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          <Text style={[styles.label, { marginTop: 16 }]}>Paket</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            {packages.map((p) => {
              const active = selectedPackage?.id === p.id
              return (
                <TouchableOpacity key={p.id} style={[styles.doctorChip, active && styles.doctorChipActive]} onPress={() => setSelectedPackage(p)}>
                  <Text style={[styles.doctorChipText, active && styles.doctorChipTextActive]}>{p.packageName}</Text>
                  <Text style={[styles.doctorChipLoad, active && styles.doctorChipTextActive]}>{fmtMoney(p.price)} · {p.durationMin}mnt</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          <Text style={[styles.label, { marginTop: 16 }]}>Groomer</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            {groomers.map((g) => {
              const active = selectedGroomer?.id === g.id
              return (
                <TouchableOpacity key={g.id} style={[styles.doctorChip, active && styles.doctorChipActive]} onPress={() => setSelectedGroomer(g)}>
                  <Text style={[styles.doctorChipText, active && styles.doctorChipTextActive]}>{g.fullname}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          <Text style={[styles.label, { marginTop: 12 }]}>Diskon (Rp, opsional)</Text>
          <TextInput style={styles.input} value={discount} onChangeText={setDiscount} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textSoft} />

          {selectedPackage && (
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{fmtMoney(total)}</Text>
            </View>
          )}

          <Text style={[styles.label, { marginTop: 12 }]}>Catatan (opsional)</Text>
          <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline placeholderTextColor={colors.textSoft} />

          <TouchableOpacity
            style={[styles.submitBtn, (!canSubmit || submitting) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Daftarkan</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  )
}

function AddPackageModal({ visible, onClose, onSuccess }: { visible: boolean; onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuthStore()
  const [packageName, setPackageName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [durationMin, setDurationMin] = useState('60')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible) return
    setPackageName('')
    setDescription('')
    setPrice('')
    setDurationMin('60')
  }, [visible])

  const canSubmit = packageName.trim() && price

  const handleSubmit = async () => {
    if (!canSubmit || !user) return
    setSubmitting(true)
    try {
      await api.post('/grooming/paket', {
        packageName: packageName.trim(),
        description: description || undefined,
        price: Number(price),
        durationMin: Number(durationMin) || 60,
        branchId: user.branchId,
      })
      onSuccess()
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message ?? 'Terjadi kesalahan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.backText}>✕ Batal</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Tambah Paket Grooming</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.label}>Nama Paket</Text>
          <TextInput style={styles.input} value={packageName} onChangeText={setPackageName} placeholder="Contoh: Mandi + Potong Bulu" placeholderTextColor={colors.textSoft} />

          <Text style={[styles.label, { marginTop: 12 }]}>Deskripsi (opsional)</Text>
          <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} multiline placeholderTextColor={colors.textSoft} />

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Harga</Text>
              <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="100000" placeholderTextColor={colors.textSoft} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Durasi (menit)</Text>
              <TextInput style={styles.input} value={durationMin} onChangeText={setDurationMin} keyboardType="number-pad" placeholderTextColor={colors.textSoft} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, (!canSubmit || submitting) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Simpan</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmBg },
  header: { paddingTop: 60, paddingHorizontal: 18, paddingBottom: 8 },
  backBtn: { marginBottom: 10 },
  backText: { fontSize: 14, fontWeight: '700', color: colors.orangeDk },
  title: { fontSize: 22, fontWeight: '800', color: colors.textDark, marginBottom: 12 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  tabBtnActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  tabTextActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginTop: 8, marginBottom: 4 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.textDark },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textSoft, marginTop: 2, textAlign: 'center' },
  searchWrap: { paddingHorizontal: 18, marginTop: 12, marginBottom: -4 },
  filterRow: { flexGrow: 0, marginVertical: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  filterChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  filterChipText: { fontSize: 12, fontWeight: '700', color: colors.textMid },
  filterChipTextActive: { color: '#fff' },
  listContent: { padding: 18, paddingTop: 4, paddingBottom: 90 },
  sessionCard: { backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: colors.border, marginBottom: 10 },
  sessionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bookingHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  queueBadge: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.orangeLt, alignItems: 'center', justifyContent: 'center' },
  queueNumber: { fontSize: 14, fontWeight: '800', color: colors.orangeDk },
  petName: { fontSize: 14, fontWeight: '800', color: colors.textDark, flexShrink: 1 },
  rowMeta: { fontSize: 12, fontWeight: '600', color: colors.textSoft, marginTop: 4 },
  priceText: { fontSize: 14, fontWeight: '800', color: colors.textDark, marginTop: 6 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: '600', color: colors.textSoft, textAlign: 'center' },
  fab: { position: 'absolute', bottom: 24, right: 18, backgroundColor: colors.orange, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 999, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  modalScreen: { flex: 1, backgroundColor: colors.warmBg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 18, paddingBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.textDark },
  modalContent: { padding: 18, paddingTop: 4, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMid, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
  },
  row2: { flexDirection: 'row', gap: 12, marginTop: 12 },
  optionRow: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, padding: 12, marginTop: 8 },
  optionName: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  optionSub: { fontSize: 11, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  selectedBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.orangeLt, borderRadius: 12, borderWidth: 1.5, borderColor: colors.orange, padding: 12 },
  selectedName: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  selectedSub: { fontSize: 11, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  changeText: { fontSize: 12, fontWeight: '700', color: colors.orangeDk },
  doctorChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, marginRight: 8 },
  doctorChipActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  doctorChipText: { fontSize: 12, fontWeight: '700', color: colors.textDark },
  doctorChipLoad: { fontSize: 10, fontWeight: '600', color: colors.textSoft, marginTop: 2 },
  doctorChipTextActive: { color: '#fff' },
  totalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.tealLt, borderRadius: 12, padding: 14, marginTop: 14 },
  totalLabel: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  totalValue: { fontSize: 16, fontWeight: '800', color: colors.teal },
  submitBtn: { backgroundColor: colors.orange, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
