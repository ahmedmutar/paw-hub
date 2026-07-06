import axios from 'axios'
import { usePortalAuthStore } from '../stores/portalAuth.store'

const baseURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api'

export const portalApi = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

portalApi.interceptors.request.use((config) => {
  const token = usePortalAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Token portal berlaku 24 jam tanpa refresh — kalau kadaluarsa, minta login OTP ulang.
portalApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      usePortalAuthStore.getState().logout()
    }
    return Promise.reject(error)
  }
)
