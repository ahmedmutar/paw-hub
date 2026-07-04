import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'

describe('Auth Store (F-01)', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false })
  })

  it('initial state tidak terautentikasi', () => {
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
  })

  it('setUser mengisi data user dan mengaktifkan isAuthenticated', () => {
    const mockUser = {
      userId: '1', username: 'admin', fullname: 'Admin Test',
      role: 'admin', branchId: '1', branchName: 'Cabang Test', tenantId: '1',
    }
    useAuthStore.getState().login({ ...mockUser, accessToken: 'at', refreshToken: 'rt' } as any)
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.user?.username).toBe('admin')
    expect(state.user?.role).toBe('admin')
  })

  it('logout menghapus data user', () => {
    const mockUser = { userId: '1', username: 'admin', fullname: 'Admin', role: 'admin', branchId: '1', branchName: 'Test', tenantId: '1' }
    useAuthStore.getState().login({ ...mockUser, accessToken: 'at', refreshToken: 'rt' } as any)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)

    useAuthStore.getState().logout()
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
  })

  it('role admin tersimpan dengan benar', () => {
    const roles = ['admin', 'dokter', 'resepsionis', 'kasir', 'karyawan', 'superadmin']
    roles.forEach(role => {
      useAuthStore.getState().login({ userId: '1', username: 'u', fullname: 'U', role, branchId: '1', branchName: 'B', tenantId: '1', accessToken: 'at', refreshToken: 'rt' } as any)
      expect(useAuthStore.getState().user?.role).toBe(role)
    })
  })
})
