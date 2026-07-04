import { vi } from 'vitest'

/** Call this at the top of each route test file to stub auth middleware */
export function mockAuthMiddleware() {
  vi.mock('../../middleware/auth', () => ({
    authenticate: vi.fn((_req: any, _reply: any, done: any) => done()),
    requireRole: vi.fn(() => (_req: any, _reply: any, done: any) => done()),
  }))
}
