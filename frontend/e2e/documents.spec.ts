import { test, expect } from '@playwright/test';

test.describe('Document Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('navigates to documents page', async ({ page }) => {
    await page.click('text=Documents');
    await expect(page).toHaveURL(/.*documents/);
    await expect(page.locator('h1')).toContainText(/documents/i);
  });

  test('uploads a PDF document', async ({ page }) => {
    await page.goto('/documents');
    
    await page.click('text=Upload Document');
    await expect(page.locator('text=Drag and drop')).toBeVisible();
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%Test PDF content'),
    });
    
    await expect(page.locator('text=Uploading')).toBeVisible();
    await expect(page.locator('text=test.pdf')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Completed')).toBeVisible({ timeout: 30000 });
  });

  test('rejects unsupported file types', async ({ page }) => {
    await page.goto('/documents');
    await page.click('text=Upload Document');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.xyz',
      mimeType: 'application/xyz',
      buffer: Buffer.from('test'),
    });
    
    await expect(page.locator('text=Unsupported file type')).toBeVisible();
  });

  test('shows document list with metadata', async ({ page }) => {
    await page.goto('/documents');
    
    await expect(page.locator('th:has-text("Name")')).toBeVisible();
    await expect(page.locator('th:has-text("Size")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();
    await expect(page.locator('th:has-text("Uploaded")')).toBeVisible();
  });

  test('deletes a document', async ({ page }) => {
    await page.goto('/documents');
    
    const firstRow = page.locator('tbody tr').first();
    await firstRow.hover();
    await firstRow.locator('button[aria-label="Delete"]').click();
    
    await page.click('button:has-text("Delete")');
    await expect(firstRow).not.toBeVisible();
  });
});