import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock api module globally
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

// Silence console.error in tests
vi.spyOn(console, 'error').mockImplementation(() => {})
