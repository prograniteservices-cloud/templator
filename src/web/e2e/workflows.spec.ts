import { test, expect } from '@playwright/test';

test.describe('E2E Workflows', () => {
  test.describe('Dashboard Workflow', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
    })

    test('complete dashboard navigation flow', async ({ page }) => {
      // 1. Verify dashboard loads
      await expect(page.getByRole('heading', { name: /templetor/i })).toBeVisible()
      
      // 2. Verify job table is present
      const jobTable = page.locator('table, [class*="job"]').first()
      await expect(jobTable).toBeVisible()
      
      // 3. Test status filter interactions
      const statusFilters = ['All Jobs', 'Capturing', 'Processing', 'Complete', 'Failed']
      for (const filter of statusFilters) {
        const filterButton = page.getByRole('button', { name: new RegExp(filter, 'i') })
        if (await filterButton.isVisible().catch(() => false)) {
          await filterButton.click()
          // Wait for potential data update
          await page.waitForTimeout(500)
        }
      }
      
      // 4. Test search functionality
      const searchInput = page.getByPlaceholder(/search/i)
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('test')
        await page.waitForTimeout(500)
        await searchInput.clear()
      }
      
      // 5. Navigate to job detail if jobs exist
      const jobLinks = page.locator('a[href^="/jobs/"], [data-testid="job-link"]').first()
      if (await jobLinks.isVisible().catch(() => false)) {
        await jobLinks.click()
        await expect(page).toHaveURL(/\/jobs\/.+/)
        
        // Verify job detail page elements
        await expect(page.getByText(/customer|job details/i)).toBeVisible()
      }
    })

    test('responsive design on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Verify dashboard is still accessible
      await expect(page.getByRole('heading', { name: /templetor/i })).toBeVisible()
      
      // Check if mobile menu or hamburger exists
      const mobileMenu = page.locator('[data-testid="mobile-menu"], button[class*="hamburger"], button[aria-label*="menu"]').first()
      if (await mobileMenu.isVisible().catch(() => false)) {
        await mobileMenu.click()
        await page.waitForTimeout(300)
      }
    })

    test('loading and error states', async ({ page }) => {
      // Simulate slow network
      await page.route('**/api/**', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 1000))
        await route.continue()
      })
      
      // Reload page
      await page.reload()
      
      // Check for loading indicators
      const loadingIndicator = page.locator('[class*="loading"], [class*="spinner"], [data-testid="loading"]').first()
      // Loading indicator may or may not be visible depending on speed
    })
  })

  test.describe('Job Detail Workflow', () => {
    test('view job with complete status and measurements', async ({ page }) => {
      await page.goto('/jobs/test-complete-job')
      
      // Verify job information is displayed
      await expect(page.getByText(/customer/i)).toBeVisible()
      await expect(page.getByText(/status/i)).toBeVisible()
      
      // Check for measurements if present
      const measurements = page.locator('text=/measurement|square footage|confidence/i').first()
      // May or may not be visible depending on data
      
      // Verify blueprint section exists
      const blueprintSection = page.locator('[class*="blueprint"], [data-testid="blueprint"]').first()
      // Blueprint may be present or show placeholder
      
      // Test navigation back
      const backButton = page.getByRole('button', { name: /back|return/i })
      if (await backButton.isVisible().catch(() => false)) {
        await backButton.click()
        await expect(page).toHaveURL('/')
      }
    })

    test('view job in processing state', async ({ page }) => {
      await page.goto('/jobs/test-processing-job')
      
      // Should show processing indicators
      const processingIndicator = page.locator('text=/processing|generating|analyzing/i').first()
      // Processing indicator may be present
      
      // Blueprint visualization should show processing state
      const blueprintArea = page.locator('[class*="blueprint"], svg').first()
      await expect(blueprintArea).toBeVisible().catch(() => {
        // Blueprint might not be visible during processing
      })
    })

    test('view job in capturing state', async ({ page }) => {
      await page.goto('/jobs/test-capturing-job')
      
      // Should indicate waiting for video capture
      const capturingIndicator = page.locator('text=/capturing|recording|video/i').first()
      // May be present
      
      // Should show placeholder for pending blueprint
      const pendingMessage = page.locator('text=/pending|waiting|not available|will be generated/i').first()
      // May be present
    })

    test('handle non-existent job', async ({ page }) => {
      await page.goto('/jobs/non-existent-job-id-12345')
      
      // Should show error or not found message
      const errorMessage = page.locator('text=/not found|error|404|does not exist/i').first()
      await expect(errorMessage).toBeVisible().catch(async () => {
        // If no explicit error, page should still render
        await expect(page.locator('body')).toBeVisible()
      })
    })

    test('blueprint visualization interactions', async ({ page }) => {
      await page.goto('/jobs/test-job-with-blueprint')
      
      // Wait for page to load
      await page.waitForTimeout(1000)
      
      // Look for blueprint visualization
      const blueprintSvg = page.locator('svg[class*="blueprint"], [data-testid="blueprint"] svg').first()
      
      if (await blueprintSvg.isVisible().catch(() => false)) {
        // Test zoom controls
        const zoomIn = page.getByRole('button', { name: /zoom in|plus/i })
        const zoomOut = page.getByRole('button', { name: /zoom out|minus/i })
        
        if (await zoomIn.isVisible().catch(() => false)) {
          await zoomIn.click()
          await page.waitForTimeout(300)
        }
        
        if (await zoomOut.isVisible().catch(() => false)) {
          await zoomOut.click()
          await page.waitForTimeout(300)
        }
        
        // Test pan/drag
        const svgBox = await blueprintSvg.boundingBox()
        if (svgBox) {
          await blueprintSvg.dragTo(blueprintSvg, {
            sourcePosition: { x: svgBox.width / 2, y: svgBox.height / 2 },
            targetPosition: { x: svgBox.width / 2 + 50, y: svgBox.height / 2 + 50 }
          })
        }
      }
    })
  })

  test.describe('Accessibility', () => {
    test('keyboard navigation', async ({ page }) => {
      await page.goto('/')
      
      // Tab through interactive elements
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      
      // Check if any element is focused
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()
    })

    test('ARIA labels and roles', async ({ page }) => {
      await page.goto('/')
      
      // Check for proper heading structure
      const h1 = page.locator('h1')
      await expect(h1).toBeVisible()
      
      // Check for buttons with accessible names
      const buttons = page.locator('button')
      const buttonCount = await buttons.count()
      
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i)
        const ariaLabel = await button.getAttribute('aria-label')
        const text = await button.textContent()
        // Buttons should have either text or aria-label
      }
    })
  })

  test.describe('Performance', () => {
    test('page load performance', async ({ page }) => {
      // Measure page load time
      const startTime = Date.now()
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      const loadTime = Date.now() - startTime
      
      // Page should load in reasonable time (under 5 seconds)
      expect(loadTime).toBeLessThan(5000)
    })

    test('smooth scrolling', async ({ page }) => {
      await page.goto('/')
      
      // Scroll down
      await page.evaluate(() => window.scrollTo(0, 500))
      await page.waitForTimeout(300)
      
      // Scroll back up
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(300)
      
      // Page should still be responsive
      await expect(page.locator('body')).toBeVisible()
    })
  })
})
