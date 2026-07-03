import { test, expect } from '@playwright/test';

test.describe('Chat Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('creates new chat session', async ({ page }) => {
    await page.goto('/chat');
    
    await page.click('text=New Chat');
    await expect(page.locator('text=New Session')).toBeVisible();
    
    await page.fill('input[placeholder="Session title"]', 'Test Chat');
    await page.click('button:has-text("Create")');
    
    await expect(page.locator('h1')).toContainText('Test Chat');
  });

  test('sends and receives messages', async ({ page }) => {
    await page.goto('/chat');
    await page.click('text=New Chat');
    await page.fill('input[placeholder="Session title"]', 'Test Chat');
    await page.click('button:has-text("Create")');
    
    await page.fill('textarea[placeholder="Type a message"]', 'What is DocuMind?');
    await page.click('button[aria-label="Send"]');
    
    await expect(page.locator('text=What is DocuMind?')).toBeVisible();
    await expect(page.locator('text=DocuMind')).toBeVisible({ timeout: 10000 });
  });

  test('shows streaming response', async ({ page }) => {
    await page.goto('/chat');
    await page.click('text=New Chat');
    await page.fill('input[placeholder="Session title"]', 'Test Chat');
    await page.click('button:has-text("Create")');
    
    await page.fill('textarea[placeholder="Type a message"]', 'Hello');
    await page.click('button[aria-label="Send"]');
    
    await expect(page.locator('[data-streaming="true"]')).toBeVisible();
    await expect(page.locator('[data-streaming="true"]')).not.toBeVisible({ timeout: 10000 });
  });

  test('displays citations', async ({ page }) => {
    await page.goto('/chat');
    await page.click('text=New Chat');
    await page.fill('input[placeholder="Session title"]', 'Test Chat');
    await page.click('button:has-text("Create")');
    
    await page.fill('textarea[placeholder="Type a message"]', 'What does the document say?');
    await page.click('button[aria-label="Send"]');
    
    await expect(page.locator('text=Citations')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-citation]')).toBeVisible();
  });

  test('shows chat history', async ({ page }) => {
    await page.goto('/chat');
    
    await expect(page.locator('text=Chat History')).toBeVisible();
    await expect(page.locator('text=Test Chat')).toBeVisible();
  });

  test('deletes chat session', async ({ page }) => {
    await page.goto('/chat');
    
    const sessionItem = page.locator('text=Test Chat').locator('..');
    await sessionItem.hover();
    await sessionItem.locator('button[aria-label="Delete"]').click();
    
    await page.click('button:has-text("Delete")');
    await expect(page.locator('text=Test Chat')).not.toBeVisible();
  });
});