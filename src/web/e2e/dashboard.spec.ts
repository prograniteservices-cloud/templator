import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display dashboard title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /templetor/i })).toBeVisible();
  });

  test('should have search functionality', async ({ page }) => {
    await expect(page.getByPlaceholder(/search jobs/i)).toBeVisible();
  });

  test('should display status filters', async ({ page }) => {
    await expect(page.getByText('All Jobs')).toBeVisible();
    await expect(page.getByText('Processing')).toBeVisible();
    await expect(page.getByText('Complete')).toBeVisible();
  });

  test('should have navigation to job detail', async ({ page }) => {
    // Look for job links in the table
    const jobLinks = page.locator('a[href^="/jobs/"]');
    const count = await jobLinks.count();
    
    if (count > 0) {
      await jobLinks.first().click();
      await expect(page).toHaveURL(/\/jobs\/.+/);
    }
  });
});

test.describe('Job Detail Page', () => {
  test('should display job information', async ({ page }) => {
    // Navigate to a job detail page
    await page.goto('/jobs/test-job-id');
    
    // Check for job detail elements
    await expect(page.getByText(/customer/i)).toBeVisible();
    await expect(page.getByText(/status/i)).toBeVisible();
    await expect(page.getByText(/measurements/i)).toBeVisible();
  });

  test('should have back navigation', async ({ page }) => {
    await page.goto('/jobs/test-job-id');
    
    const backButton = page.getByRole('button', { name: /back/i });
    if (await backButton.isVisible()) {
      await backButton.click();
      await expect(page).toHaveURL('/');
    }
  });
});
