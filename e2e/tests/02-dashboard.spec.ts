import { test, expect, Page } from '@playwright/test'

async function login(page: Page) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.evaluate(() => localStorage.clear())
  await page.locator('input[placeholder="Masukkan username"]').first().fill('admin')
  await page.locator('input[type="password"]').first().fill('admin123')
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/dashboard/, { timeout: 10_000 })
}

test.describe('Dashboard — Navigasi & Statistik', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('dashboard dimuat tanpa error', async ({ page }) => {
    await expect(page).toHaveURL(/dashboard/)
    await page.waitForLoadState('networkidle')
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/Internal Server Error|500 Error/)
  })

  test('elemen navigasi tersedia di sidebar atau header', async ({ page }) => {
    // Sidebar atau navigasi harus ada
    const nav = page.locator('nav, aside, [class*="sidebar"], [class*="menu"]').first()
    await expect(nav).toBeVisible({ timeout: 5_000 })
  })

  test('navigasi ke halaman pasien berhasil', async ({ page }) => {
    await page.goto('/pasien')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/pasien/)
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/404|not found/i)
  })

  test('navigasi ke halaman pendaftaran/antrian berhasil', async ({ page }) => {
    await page.goto('/pendaftaran')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/pendaftaran/)
  })

  test('navigasi ke halaman appointment berhasil', async ({ page }) => {
    await page.goto('/appointment')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/appointment/)
  })

  test('navigasi ke halaman gudang berhasil', async ({ page }) => {
    await page.goto('/gudang')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/gudang/)
  })

  test('navigasi ke halaman pembayaran berhasil', async ({ page }) => {
    await page.goto('/pembayaran')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/pembayaran/)
  })
})
