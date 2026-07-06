import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface PortalOwner {
  id: string
  ownerName: string
  phoneNumber?: string
  address?: string
  branch?: { branchName: string; address?: string; phoneNumber?: string } | null
}

interface PortalAuthState {
  owner: PortalOwner | null
  token: string | null
  isAuthenticated: boolean
  login: (data: { token: string; owner: PortalOwner }) => void
  logout: () => void
}

export const usePortalAuthStore = create<PortalAuthState>()(
  persist(
    (set) => ({
      owner: null,
      token: null,
      isAuthenticated: false,

      login: ({ token, owner }) => set({ token, owner, isAuthenticated: true }),

      logout: () => set({ token: null, owner: null, isAuthenticated: false }),
    }),
    {
      name: 'pawcare-mobile-portal-auth',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
