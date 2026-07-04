import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TenantInfo {
  id: string; name: string; slug: string; status: string; trialEndsAt?: string
  subscription?: { status: string; expiresAt?: string; plan: { code: string; name: string } } | null
}

interface AuthUser {
  userId: string
  username: string
  fullname: string
  email?: string | null
  role: string
  imageProfile?: string | null
  branchId: string
  branchName: string
  tenantId?: string | null
  tenant?: TenantInfo | null
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (data: AuthUser & { accessToken: string; refreshToken: string }) => void
  logout: () => void
  setAccessToken: (token: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: ({ accessToken, refreshToken, ...user }) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),

      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),

      setAccessToken: (accessToken) => set({ accessToken }),
    }),
    {
      name: 'vet-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
