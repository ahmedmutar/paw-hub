import { test, expect } from '@playwright/test'

// Selectors based on the actual LoginPage component
const SEL = {
  username: 'input[placeholder="Masukkan username"]',
  password: 'input[type="password"]',
  submit:   'button[type="submit"]',
  error:    'div.text-red-600, .bg-red-50, [class*="text-red"]',
}

async function clearAuth(page: any) {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

test.describe('Auth — Login & Logout', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')
    await clearAuth(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('halaman login ditampilkan dengan form username dan password', async ({ page }) => {
    await expect(page).toHaveURL(/login/)
    await expect(page.locator(SEL.username)).toBeVisible()
    await expect(page.locator(SEL.password)).toBeVisible()
    await expect(page.locator(SEL.submit)).toBeVisible()
  })

  test('login berhasil → redirect ke /dashboard', async ({ page }) => {
    await page.locator(SEL.username).fill('admin')
    await page.locator(SEL.password).fill('admin123')
    await page.locator(SEL.submit).click()
    await page.waitForURL(/dashboard/, { timeout: 10_000 })
    await expect(page).toHaveURL(/dashboard/)
  })

  test('login gagal password salah → error message ditampilkan', async ({ page }) => {
    await page.locator(SEL.username).fill('admin')
    await page.locator(SEL.password).fill('salahpassword999')
    await page.locator(SEL.submit).click()
    await page.waitForLoadState('networkidle')

    // Tetap di halaman login
    await expect(page).toHaveURL(/login/)
    // Error message muncul
    await expect(page.locator(SEL.error).first()).toBeVisible({ timeout: 5_000 })
  })

  test('login gagal username tidak ada → error message ditampilkan', async ({ page }) => {
    await page.locator(SEL.username).fill('akun_tidak_ada_xyz123')
    await page.locator(SEL.password).fill('admin123')
    await page.locator(SEL.submit).click()
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/login/)
    await expect(page.locator(SEL.error).first()).toBeVisible({ timeout: 5_000 })
  })

  test('halaman root menampilkan landing page jika belum authenticated', async ({ page, context }) => {
    await context.clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/$/)
    const content = await page.locator('body').innerText()
    expect(content.toLowerCase()).toMatch(/bintang vet|coba gratis|fitur/i)
  })

  test('setelah login → konten dashboard ditampilkan', async ({ page }) => {
    await page.locator(SEL.username).fill('admin')
    await page.locator(SEL.password).fill('admin123')
    await page.locator(SEL.submit).click()
    await page.waitForURL(/dashboard/, { timeout: 10_000 })

    const content = await page.locator('body').innerText()
    expect(content.toLowerCase()).toMatch(/dashboard|klinik|pasien|bintang/i)
  })

  test('dokter dapat login → redirect ke dashboard', async ({ page }) => {
    await page.locator(SEL.username).fill('drg.budi')
    await page.locator(SEL.password).fill('dokter123')
    await page.locator(SEL.submit).click()
    await page.waitForURL(/dashboard/, { timeout: 10_000 })
    await expect(page).toHaveURL(/dashboard/)
  })
})
