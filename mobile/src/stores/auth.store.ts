import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface AuthUser {
  userId: string
  username: string
  fullname: string
  email?: string | null
  role: string
  imageProfile?: string | null
  branchId: string
  branchName: string
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
      name: 'pawcare-mobile-auth',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
