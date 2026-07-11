import { test, expect } from '@playwright/test';

test.describe('Fillwright Demo', () => {
  test('demo page loads with all forms', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Fillwright/);
    await expect(page.locator('#plain-form')).toBeVisible();
    await expect(page.locator('#wizard-form')).toBeVisible();
    await expect(page.locator('#locale-form')).toBeVisible();
  });

  test('plain form has all fields', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#plain-given')).toBeVisible();
    await expect(page.locator('#plain-family')).toBeVisible();
    await expect(page.locator('#plain-email')).toBeVisible();
    await expect(page.locator('#plain-phone')).toBeVisible();
    await expect(page.locator('#plain-address')).toBeVisible();
  });

  test('wizard navigation works', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#wizard-step-1')).toBeVisible();
    await expect(page.locator('#wizard-step-2')).not.toBeVisible();
    await expect(page.locator('#wizard-step-3')).not.toBeVisible();

    await page.click('text=Next');
    await expect(page.locator('#wizard-step-1')).not.toBeVisible();
    await expect(page.locator('#wizard-step-2')).toBeVisible();

    await page.click('text=Next');
    await expect(page.locator('#wizard-step-2')).not.toBeVisible();
    await expect(page.locator('#wizard-step-3')).toBeVisible();

    await page.click('text=Back');
    await expect(page.locator('#wizard-step-2')).toBeVisible();
  });

  test('locale form has country select and date pattern', async ({ page }) => {
    await page.goto('/');
    const countrySelect = page.locator('#loc-country');
    await expect(countrySelect).toBeVisible();
    const options = await countrySelect.locator('option').count();
    expect(options).toBeGreaterThan(1);

    await expect(page.locator('#loc-date')).toBeVisible();
    await expect(page.locator('#loc-number')).toBeVisible();
  });

  test('plain form validation prevents empty submit', async ({ page }) => {
    await page.goto('/');
    await page.click('#plain-form button[type="submit"]');
    const requiredField = page.locator('#plain-given');
    const isValid = await requiredField.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(isValid).toBe(false);
  });

  test('nav links scroll to sections', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="#wizard"]');
    const wizard = page.locator('#wizard');
    await expect(wizard).toBeVisible();
  });
});
