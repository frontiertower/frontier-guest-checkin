/**
 * E2E Tests for Admin Dashboard
 * Tests critical admin workflows: analytics, user management, policy settings
 */

import { test, expect, devices } from '@playwright/test';
import { dataHelpers } from '../test-utils';

test.describe('Admin Dashboard - Desktop', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin dashboard
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // Verify admin page loads
    await expect(page.locator('h1')).toContainText('Frontier Tower');
  });

  test('should display key metrics and analytics', async ({ page }) => {
    // Verify analytics cards are present
    const metricsCards = page.locator('[data-testid="metric-card"]');
    await expect(metricsCards).toHaveCount(4); // Total visits, active guests, capacity, alerts
    
    // Check each metric card has proper structure
    const totalVisitsCard = page.locator('[data-testid="metric-total-visits"]');
    await expect(totalVisitsCard).toBeVisible();
    await expect(totalVisitsCard.locator('.metric-value')).toBeVisible();
    await expect(totalVisitsCard.locator('.metric-label')).toContainText('Total Visits');
    
    const activeGuestsCard = page.locator('[data-testid="metric-active-guests"]');
    await expect(activeGuestsCard).toBeVisible();
    await expect(activeGuestsCard.locator('.metric-value')).toBeVisible();
    
    const capacityCard = page.locator('[data-testid="metric-capacity"]');
    await expect(capacityCard).toBeVisible();
    await expect(capacityCard.locator('.capacity-bar')).toBeVisible();
    
    // Verify charts are rendered
    await expect(page.locator('[data-testid="visits-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="capacity-chart"]')).toBeVisible();
  });

  test('should filter data by location context', async ({ page }) => {
    // Verify location dropdown is present
    const locationDropdown = page.locator('[data-testid="location-selector"]');
    await expect(locationDropdown).toBeVisible();
    
    // Default should show "All Locations"
    await expect(locationDropdown).toContainText('All Locations');
    
    // Capture initial metrics for all locations
    const initialVisits = await page.locator('[data-testid="metric-total-visits"] .metric-value').textContent();
    const initialGuests = await page.locator('[data-testid="metric-active-guests"] .metric-value').textContent();
    
    // Switch to specific location
    await locationDropdown.click();
    await page.locator('[data-testid="location-option-tower-a"]').click();
    
    // Wait for data to refresh
    await page.waitForTimeout(1000);
    
    // Verify location context is applied
    await expect(locationDropdown).toContainText('Tower A');
    
    // Verify metrics changed (location-specific data should differ)
    const towerAVisits = await page.locator('[data-testid="metric-total-visits"] .metric-value').textContent();
    const towerAGuests = await page.locator('[data-testid="metric-active-guests"] .metric-value').textContent();
    
    // Location-specific metrics should be different from all-locations view
    expect(towerAVisits).not.toBe(initialVisits);
    
    // Test switching to another location
    await locationDropdown.click();
    await page.locator('[data-testid="location-option-tower-b"]').click();
    await page.waitForTimeout(1000);
    
    await expect(locationDropdown).toContainText('Tower B');
    
    const towerBVisits = await page.locator('[data-testid="metric-total-visits"] .metric-value').textContent();
    expect(towerBVisits).not.toBe(towerAVisits);
    
    // Switch back to all locations
    await locationDropdown.click();
    await page.locator('[data-testid="location-option-all"]').click();
    await page.waitForTimeout(1000);
    
    await expect(locationDropdown).toContainText('All Locations');
    const finalVisits = await page.locator('[data-testid="metric-total-visits"] .metric-value').textContent();
    expect(finalVisits).toBe(initialVisits);
  });

  test('should maintain location context across tabs', async ({ page }) => {
    // Set specific location context
    const locationDropdown = page.locator('[data-testid="location-selector"]');
    await locationDropdown.click();
    await page.locator('[data-testid="location-option-tower-a"]').click();
    await page.waitForTimeout(500);
    
    await expect(locationDropdown).toContainText('Tower A');
    
    // Navigate to guests tab
    await page.locator('[data-testid="tab-guests"]').click();
    await expect(page.locator('[data-testid="guests-table"]')).toBeVisible();
    
    // Verify location context is maintained
    await expect(locationDropdown).toContainText('Tower A');
    
    // Verify guest data is filtered to location
    const guestRows = page.locator('[data-testid="guest-row"]');
    if (await guestRows.count() > 0) {
      // If guests exist, verify they belong to Tower A
      await expect(guestRows.first()).toContainText('Tower A');
    }
    
    // Navigate to activities tab
    await page.locator('[data-testid="tab-activities"]').click();
    await expect(page.locator('[data-testid="activities-table"]')).toBeVisible();
    
    // Location context should persist
    await expect(locationDropdown).toContainText('Tower A');
    
    // Return to dashboard
    await page.locator('[data-testid="tab-dashboard"]').click();
    await expect(locationDropdown).toContainText('Tower A');
  });

  test('should handle location-filtered API calls correctly', async ({ page }) => {
    let apiCallsMade = [];
    
    // Intercept API calls to verify location parameters
    await page.route('/api/admin/stats*', async (route) => {
      const url = route.request().url();
      apiCallsMade.push(url);
      
      // Mock response based on location parameter
      const hasLocation = url.includes('location=');
      const locationId = hasLocation ? url.split('location=')[1].split('&')[0] : null;
      
      const mockResponse = {
        overview: {
          totalVisits: hasLocation ? 50 : 100,
          activeVisits: hasLocation ? 10 : 25,
          dailyCapacity: hasLocation ? 25 : 50
        },
        locations: [
          { id: 'tower-a', name: 'Tower A', activeVisits: 10 },
          { id: 'tower-b', name: 'Tower B', activeVisits: 15 }
        ],
        currentLocation: hasLocation ? 
          { id: locationId, name: locationId === 'tower-a' ? 'Tower A' : 'Tower B' } : null,
        isLocationFiltered: hasLocation
      };
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse)
      });
    });
    
    // Initial load should call API without location parameter
    await page.reload();
    await page.waitForTimeout(1000);
    
    expect(apiCallsMade.some(url => url.includes('/api/admin/stats') && !url.includes('location='))).toBeTruthy();
    
    // Switch to specific location
    const locationDropdown = page.locator('[data-testid="location-selector"]');
    await locationDropdown.click();
    await page.locator('[data-testid="location-option-tower-a"]').click();
    await page.waitForTimeout(1000);
    
    // Should call API with location parameter
    expect(apiCallsMade.some(url => url.includes('/api/admin/stats?location=tower-a'))).toBeTruthy();
    
    // Verify location-specific data is displayed
    const totalVisits = await page.locator('[data-testid="metric-total-visits"] .metric-value').textContent();
    expect(totalVisits).toBe('50'); // Location-specific value from mock
  });

  test('should prevent cross-location data leakage', async ({ page }) => {
    // Mock different data for different locations
    await page.route('/api/admin/guests*', async (route) => {
      const url = route.request().url();
      const locationParam = url.includes('location=tower-a') ? 'tower-a' : 
                           url.includes('location=tower-b') ? 'tower-b' : null;
      
      let guests;
      if (locationParam === 'tower-a') {
        guests = [{ id: '1', email: 'tower-a-guest@example.com', name: 'Tower A Guest', location: 'Tower A' }];
      } else if (locationParam === 'tower-b') {
        guests = [{ id: '2', email: 'tower-b-guest@example.com', name: 'Tower B Guest', location: 'Tower B' }];
      } else {
        guests = [
          { id: '1', email: 'tower-a-guest@example.com', name: 'Tower A Guest', location: 'Tower A' },
          { id: '2', email: 'tower-b-guest@example.com', name: 'Tower B Guest', location: 'Tower B' }
        ];
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ guests, total: guests.length })
      });
    });
    
    // Go to guests tab
    await page.locator('[data-testid="tab-guests"]').click();
    await page.waitForTimeout(1000);
    
    // Default view should show all guests
    await expect(page.locator('[data-testid="guests-table"]')).toContainText('tower-a-guest@example.com');
    await expect(page.locator('[data-testid="guests-table"]')).toContainText('tower-b-guest@example.com');
    
    // Filter to Tower A only
    const locationDropdown = page.locator('[data-testid="location-selector"]');
    await locationDropdown.click();
    await page.locator('[data-testid="location-option-tower-a"]').click();
    await page.waitForTimeout(1000);
    
    // Should only show Tower A guests
    await expect(page.locator('[data-testid="guests-table"]')).toContainText('tower-a-guest@example.com');
    await expect(page.locator('[data-testid="guests-table"]')).not.toContainText('tower-b-guest@example.com');
    
    // Switch to Tower B
    await locationDropdown.click();
    await page.locator('[data-testid="location-option-tower-b"]').click();
    await page.waitForTimeout(1000);
    
    // Should only show Tower B guests
    await expect(page.locator('[data-testid="guests-table"]')).not.toContainText('tower-a-guest@example.com');
    await expect(page.locator('[data-testid="guests-table"]')).toContainText('tower-b-guest@example.com');
  });

  test('should combine location and search filters effectively', async ({ page }) => {
    // Navigate to guests tab
    await page.locator('[data-testid="tab-guests"]').click();
    await expect(page.locator('[data-testid="guests-table"]')).toBeVisible();
    
    // Set location context first
    const locationDropdown = page.locator('[data-testid="location-selector"]');
    await locationDropdown.click();
    await page.locator('[data-testid="location-option-tower-a"]').click();
    await page.waitForTimeout(500);
    
    // Test search functionality within location context
    const searchInput = page.locator('[data-testid="search-guests"]');
    await searchInput.fill('john@example.com');
    await searchInput.press('Enter');
    
    // Verify search results respect location filter
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    const resultRows = page.locator('[data-testid="guest-row"]');
    if (await resultRows.count() > 0) {
      await expect(resultRows.first()).toContainText('john@example.com');
      await expect(resultRows.first()).toContainText('Tower A'); // Must be from correct location
    }
    
    // Test date range filter with location context
    await page.locator('[data-testid="date-filter-button"]').click();
    await expect(page.locator('[data-testid="date-picker"]')).toBeVisible();
    
    // Select last 30 days
    await page.locator('[data-testid="preset-30-days"]').click();
    await expect(page.locator('[data-testid="results-count"]')).toBeVisible();
    
    // Verify location context is maintained with date filter
    await expect(locationDropdown).toContainText('Tower A');
    
    // Test status filter with location context
    await page.locator('[data-testid="status-filter"]').selectOption('active');
    await page.locator('[data-testid="apply-filters"]').click();
    
    // Verify filtered results maintain location context
    await expect(page.locator('[data-testid="active-guests-only"]')).toBeVisible();
    await expect(locationDropdown).toContainText('Tower A');
    
    // Clear location filter to test broader search
    await locationDropdown.click();
    await page.locator('[data-testid="location-option-all"]').click();
    await page.waitForTimeout(500);
    
    // Search should now span all locations
    await searchInput.clear();
    await searchInput.fill('guest@example.com');
    await searchInput.press('Enter');
    
    // Should see results from multiple locations
    const allLocationResults = page.locator('[data-testid="guest-row"]');
    if (await allLocationResults.count() > 1) {
      // Verify we see guests from different locations
      const locationTexts = await allLocationResults.allTextContents();
      const hasMultipleLocations = locationTexts.some(text => text.includes('Tower A')) && 
                                  locationTexts.some(text => text.includes('Tower B'));
      expect(hasMultipleLocations).toBeTruthy();
    }
  });

  test('should handle user management operations', async ({ page }) => {
    // Navigate to users tab
    await page.locator('[data-testid="tab-users"]').click();
    await expect(page.locator('[data-testid="users-table"]')).toBeVisible();
    
    // Test creating new user
    await page.locator('[data-testid="add-user-button"]').click();
    await expect(page.locator('[data-testid="add-user-modal"]')).toBeVisible();
    
    // Fill user form
    await page.locator('[data-testid="user-email"]').fill(dataHelpers.generateTestEmail('newuser'));
    await page.locator('[data-testid="user-name"]').fill('New Test User');
    await page.locator('[data-testid="user-role"]').selectOption('host');
    
    // Submit form
    await page.locator('[data-testid="submit-user"]').click();
    
    // Verify success message
    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();
    await expect(page.locator('[data-testid="success-toast"]')).toContainText('User created successfully');
    
    // Verify user appears in table
    await expect(page.locator('[data-testid="users-table"]')).toContainText('New Test User');
    
    // Test editing user
    const userRow = page.locator('[data-testid="user-row"]').first();
    await userRow.locator('[data-testid="edit-user"]').click();
    
    await expect(page.locator('[data-testid="edit-user-modal"]')).toBeVisible();
    
    // Update role
    await page.locator('[data-testid="user-role"]').selectOption('admin');
    await page.locator('[data-testid="save-changes"]').click();
    
    // Verify changes
    await expect(page.locator('[data-testid="success-toast"]')).toContainText('User updated');
    await expect(userRow).toContainText('admin');
  });

  test('should manage policy settings', async ({ page }) => {
    // Navigate to policies tab
    await page.locator('[data-testid="tab-policies"]').click();
    await expect(page.locator('[data-testid="policies-form"]')).toBeVisible();
    
    // Test updating guest monthly limit
    const monthlyLimitInput = page.locator('[data-testid="guest-monthly-limit"]');
    await monthlyLimitInput.clear();
    await monthlyLimitInput.fill('5');
    
    // Test updating host concurrent limit
    const concurrentLimitInput = page.locator('[data-testid="host-concurrent-limit"]');
    await concurrentLimitInput.clear();
    await concurrentLimitInput.fill('4');
    
    // Test time cutoff setting
    const timeCutoffInput = page.locator('[data-testid="time-cutoff"]');
    await timeCutoffInput.selectOption('22'); // 10 PM cutoff
    
    // Save changes
    await page.locator('[data-testid="save-policies"]').click();
    
    // Verify success message
    await expect(page.locator('[data-testid="policies-saved"]')).toBeVisible();
    await expect(page.locator('[data-testid="policies-saved"]')).toContainText('Policies updated successfully');
    
    // Verify values are persisted
    await page.reload();
    await page.locator('[data-testid="tab-policies"]').click();
    
    await expect(monthlyLimitInput).toHaveValue('5');
    await expect(concurrentLimitInput).toHaveValue('4');
    await expect(timeCutoffInput).toHaveValue('22');
  });

  test('should handle blacklist management', async ({ page }) => {
    // Navigate to blacklist tab
    await page.locator('[data-testid="tab-blacklist"]').click();
    await expect(page.locator('[data-testid="blacklist-table"]')).toBeVisible();
    
    // Test adding to blacklist
    await page.locator('[data-testid="add-to-blacklist"]').click();
    await expect(page.locator('[data-testid="blacklist-modal"]')).toBeVisible();
    
    const bannedEmail = dataHelpers.generateTestEmail('banned');
    await page.locator('[data-testid="blacklist-email"]').fill(bannedEmail);
    await page.locator('[data-testid="blacklist-reason"]').fill('Security violation - attempted unauthorized access');
    
    // Submit blacklist addition
    await page.locator('[data-testid="add-blacklist-entry"]').click();
    
    // Verify success
    await expect(page.locator('[data-testid="blacklist-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="blacklist-table"]')).toContainText(bannedEmail);
    
    // Test removing from blacklist
    const blacklistRow = page.locator(`[data-testid="blacklist-${bannedEmail}"]`);
    await blacklistRow.locator('[data-testid="remove-blacklist"]').click();
    
    // Confirm removal
    await expect(page.locator('[data-testid="confirm-removal"]')).toBeVisible();
    await page.locator('[data-testid="confirm-remove"]').click();
    
    // Verify removal
    await expect(page.locator('[data-testid="removal-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="blacklist-table"]')).not.toContainText(bannedEmail);
  });

  test('should export data and generate reports', async ({ page }) => {
    // Navigate to reports tab
    await page.locator('[data-testid="tab-reports"]').click();
    await expect(page.locator('[data-testid="reports-section"]')).toBeVisible();
    
    // Test visit report generation
    await page.locator('[data-testid="report-visits"]').click();
    await expect(page.locator('[data-testid="report-options"]')).toBeVisible();
    
    // Select date range
    await page.locator('[data-testid="report-start-date"]').fill('2025-01-01');
    await page.locator('[data-testid="report-end-date"]').fill('2025-12-31');
    
    // Select format
    await page.locator('[data-testid="report-format"]').selectOption('csv');
    
    // Generate report
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-testid="generate-report"]').click();
    
    // Verify download starts
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('visits');
    expect(download.suggestedFilename()).toContain('.csv');
    
    // Test capacity report
    await page.locator('[data-testid="report-capacity"]').click();
    await page.locator('[data-testid="report-format"]').selectOption('pdf');
    
    const capacityDownloadPromise = page.waitForEvent('download');
    await page.locator('[data-testid="generate-report"]').click();
    
    const capacityDownload = await capacityDownloadPromise;
    expect(capacityDownload.suggestedFilename()).toContain('capacity');
    expect(capacityDownload.suggestedFilename()).toContain('.pdf');
  });
});

  test('should handle location switching during concurrent operations', async ({ page }) => {
    let requestCount = 0;
    const requestLog = [];
    
    // Track all API requests with location parameters
    await page.route('/api/admin/**', async (route) => {
      requestCount++;
      const url = route.request().url();
      requestLog.push({ order: requestCount, url, timestamp: Date.now() });
      
      // Add artificial delay to test race conditions
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const mockResponse = { success: true, data: { id: requestCount } };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse)
      });
    });
    
    // Rapidly switch between locations to test race conditions
    const locationDropdown = page.locator('[data-testid="location-selector"]');
    
    await locationDropdown.click();
    await page.locator('[data-testid="location-option-tower-a"]').click();
    
    // Immediately switch to another location before first request completes
    await locationDropdown.click();
    await page.locator('[data-testid="location-option-tower-b"]').click();
    
    // Switch back quickly
    await locationDropdown.click();
    await page.locator('[data-testid="location-option-all"]').click();
    
    // Wait for all requests to complete
    await page.waitForTimeout(1000);
    
    // Final location should be "All Locations"
    await expect(locationDropdown).toContainText('All Locations');
    
    // Verify last API call was for "all" (no location parameter)
    const lastRequest = requestLog[requestLog.length - 1];
    expect(lastRequest.url).not.toContain('location=');
  });

test.describe('Admin Dashboard - Mobile', () => {
  test.use({ ...devices['iPhone 12'] });

  test('should be responsive on mobile devices', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    // Verify mobile layout
    await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
    await expect(page.locator('[data-testid="desktop-nav"]')).not.toBeVisible();
    
    // Test mobile location selector
    const mobileLocationSelector = page.locator('[data-testid="location-selector"]');
    await expect(mobileLocationSelector).toBeVisible();
    
    // Location dropdown should be touch-friendly on mobile
    const selectorBox = await mobileLocationSelector.boundingBox();
    expect(selectorBox!.height).toBeGreaterThanOrEqual(44); // Minimum touch target
    
    // Test mobile navigation
    await page.locator('[data-testid="mobile-menu-toggle"]').click();
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    
    // Navigate to different sections
    await page.locator('[data-testid="mobile-nav-guests"]').click();
    await expect(page.locator('[data-testid="guests-table"]')).toBeVisible();
    
    // Verify table is scrollable on mobile
    const table = page.locator('[data-testid="guests-table"]');
    await expect(table).toHaveCSS('overflow-x', 'auto');
    
    // Test card layout stacking
    await page.locator('[data-testid="mobile-nav-dashboard"]').click();
    const metricsCards = page.locator('[data-testid="metric-card"]');
    
    // Cards should stack vertically on mobile
    const firstCard = metricsCards.first();
    const secondCard = metricsCards.nth(1);
    
    const firstCardBox = await firstCard.boundingBox();
    const secondCardBox = await secondCard.boundingBox();
    
    // Second card should be below the first (higher y position)
    expect(secondCardBox!.y).toBeGreaterThan(firstCardBox!.y + firstCardBox!.height - 50);
  });

  test('should handle touch interactions on mobile', async ({ page }) => {
    await page.goto('/admin');
    
    // Test swipe navigation if implemented
    await page.locator('[data-testid="tab-guests"]').click();
    
    // Test touch-friendly buttons
    const actionButtons = page.locator('[data-testid="action-button"]');
    const firstButton = actionButtons.first();
    
    // Verify button is large enough for touch (minimum 44px)
    const buttonBox = await firstButton.boundingBox();
    expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
    expect(buttonBox!.width).toBeGreaterThanOrEqual(44);
    
    // Test modal interactions on mobile
    await page.locator('[data-testid="add-user-button"]').tap();
    await expect(page.locator('[data-testid="add-user-modal"]')).toBeVisible();
    
    // Modal should take up appropriate space on mobile
    const modal = page.locator('[data-testid="add-user-modal"]');
    const modalBox = await modal.boundingBox();
    
    // Modal should be nearly full width on mobile
    expect(modalBox!.width).toBeGreaterThan(300);
  });
});

test.describe('Admin Dashboard - Performance', () => {
  test('should load within performance budgets', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // Verify critical content is visible
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[data-testid="metric-card"]').first()).toBeVisible();
  });

  test('should handle large datasets efficiently', async ({ page }) => {
    await page.goto('/admin');
    await page.locator('[data-testid="tab-guests"]').click();
    
    // Mock large dataset response
    await page.route('/api/admin/guests*', async (route) => {
      const largeGuestList = Array.from({ length: 1000 }, (_, i) => ({
        id: `guest-${i}`,
        email: `guest${i}@example.com`,
        name: `Guest ${i}`,
        visitCount: Math.floor(Math.random() * 10),
        lastVisit: new Date().toISOString(),
      }));
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          guests: largeGuestList,
          total: 1000,
          page: 1,
          limit: 50,
        }),
      });
    });
    
    const tableLoadStart = Date.now();
    await expect(page.locator('[data-testid="guests-table"]')).toBeVisible();
    const tableLoadTime = Date.now() - tableLoadStart;
    
    // Should render table quickly even with large dataset
    expect(tableLoadTime).toBeLessThan(1000);
    
    // Verify pagination is working
    await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-count"]')).toContainText('1000');
    
    // Test scrolling performance
    const scrollStart = Date.now();
    await page.locator('[data-testid="guests-table"]').evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });
    const scrollTime = Date.now() - scrollStart;
    
    // Scrolling should be smooth (under 100ms)
    expect(scrollTime).toBeLessThan(100);
  });
});

test.describe('Admin Dashboard - Accessibility', () => {
  test('should meet accessibility standards', async ({ page }) => {
    await page.goto('/admin');
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="tab-dashboard"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="tab-guests"]')).toBeFocused();
    
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="guests-table"]')).toBeVisible();
    
    // Test ARIA labels
    await expect(page.locator('[data-testid="main-nav"]')).toHaveAttribute('role', 'navigation');
    await expect(page.locator('[data-testid="guests-table"]')).toHaveAttribute('role', 'table');
    
    // Test screen reader announcements
    await page.locator('[data-testid="add-user-button"]').click();
    
    const modal = page.locator('[data-testid="add-user-modal"]');
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    
    // Test focus management in modals
    await expect(page.locator('[data-testid="user-email"]')).toBeFocused();
    
    // Test high contrast mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('[data-testid="metric-card"]').first()).toBeVisible();
    
    // Verify color contrast is maintained
    const cardElement = page.locator('[data-testid="metric-card"]').first();
    const computedStyles = await cardElement.evaluate(el => {
      const styles = getComputedStyle(el);
      return {
        color: styles.color,
        backgroundColor: styles.backgroundColor,
      };
    });
    
    // Basic check that colors have changed for dark mode
    expect(computedStyles.backgroundColor).not.toBe('rgb(255, 255, 255)');
  });
});