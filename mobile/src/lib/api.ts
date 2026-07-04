import axios from 'axios'
import { useAuthStore } from '../stores/auth.store'

// Saat pakai Expo Go di HP fisik, "localhost" mengarah ke HP itu sendiri, bukan
// komputer dev. Set EXPO_PUBLIC_API_URL ke IP LAN komputer, contoh:
// EXPO_PUBLIC_API_URL=http://192.168.1.10:3001/api
const baseURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api'

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let isRefreshing = false
let queue: Array<(token: string) => void> = []

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      if (isRefreshing) {
        return new Promise((resolve) => {
          queue.push((token) => {
            original.headers.Authorization = `Bearer ${token}`
            resolve(api(original))
          })
        })
      }

      isRefreshing = true
      try {
        const store = useAuthStore.getState()
        const res = await axios.post(`${baseURL}/refresh`, { refreshToken: store.refreshToken })
        const newToken = res.data.data.accessToken
        store.setAccessToken(newToken)
        queue.forEach((cb) => cb(newToken))
        queue = []
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch {
        useAuthStore.getState().logout()
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)
