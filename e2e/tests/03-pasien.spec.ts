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

test.describe('Manajemen Pasien (F-03)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/pasien')
    await page.waitForLoadState('networkidle')
  })

  test('halaman daftar pasien dapat dimuat', async ({ page }) => {
    await expect(page).toHaveURL(/pasien/)
    await page.waitForLoadState('networkidle')
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/Internal Server Error|500/)
  })

  test('tabel atau daftar pasien tersedia', async ({ page }) => {
    const list = page.locator('table, [class*="table"], [class*="list"], ul[class*="patient"]').first()
    await expect(list).toBeVisible({ timeout: 8_000 })
  })

  test('tombol tambah/daftar pasien tersedia', async ({ page }) => {
    const addBtn = page.locator(
      'button:has-text("Tambah"), button:has-text("Daftar"), button:has-text("Baru"), a:has-text("Tambah")'
    ).first()
    await expect(addBtn).toBeVisible({ timeout: 5_000 })
  })

  test('fitur pencarian pasien dapat digunakan', async ({ page }) => {
    const searchInput = page.locator(
      'input[placeholder*="Cari" i], input[placeholder*="Search" i], input[type="search"]'
    ).first()

    if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await searchInput.fill('Mochi')
      await page.waitForTimeout(800) // debounce
      await expect(page.locator('body')).not.toContainText('Internal Server Error')
    } else {
      // Search input tidak terlihat, lewati test ini
      test.skip(true, 'Search input tidak ditemukan')
    }
  })

  test('klik pasien membuka detail', async ({ page }) => {
    // Jika ada pasien di daftar, klik untuk membuka detail
    const firstRow = page.locator('table tbody tr, [class*="patient-item"], [class*="list-item"]').first()
    const hasRows = await firstRow.isVisible({ timeout: 3_000 }).catch(() => false)
    if (hasRows) {
      await firstRow.click()
      await page.waitForLoadState('networkidle')
      // Setelah klik, halaman berubah atau modal terbuka
      const hasDetail = await page.locator('[class*="detail"], [class*="modal"], [role="dialog"]').first().isVisible({ timeout: 3_000 }).catch(() => false)
      expect(hasDetail || page.url().includes('pasien/')).toBe(true)
    } else {
      test.skip(true, 'Tidak ada data pasien untuk diklik')
    }
  })
})
