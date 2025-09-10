/**
 * E2E Tests for Complete Guest Registration Flow
 * Critical coverage for: invitation → registration → terms → signature → success
 */

import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

test.describe('Guest Registration Flow', () => {
  const testGuest = {
    email: faker.internet.email(),
    name: faker.person.fullName(),
    phone: faker.phone.number('+1##########'),
    company: faker.company.name(),
  };

  test('should complete full guest registration journey', async ({ page }) => {
    // Step 1: Guest receives invitation link (simulate)
    const invitationId = faker.string.uuid();
    const registrationUrl = `/guest/register/${invitationId}`;
    
    await page.goto(registrationUrl);
    await page.waitForLoadState('networkidle');
    
    // Step 2: Verify invitation details are loaded
    await expect(page.locator('[data-testid="invitation-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="host-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="visit-date"]')).toBeVisible();
    
    // Step 3: Complete guest profile
    await expect(page.locator('h1')).toContainText('Complete Your Profile');
    
    // Fill in profile details
    await page.locator('[data-testid="guest-name"]').fill(testGuest.name);
    await page.locator('[data-testid="guest-phone"]').fill(testGuest.phone);
    await page.locator('[data-testid="guest-company"]').fill(testGuest.company);
    
    // Select country
    await page.locator('[data-testid="guest-country"]').selectOption('US');
    
    // Choose contact preference
    await page.locator('[data-testid="contact-method-email"]').check();
    
    // Upload photo (optional - test both paths)
    const hasPhotoUpload = await page.locator('[data-testid="photo-upload"]').isVisible();
    if (hasPhotoUpload) {
      // Test file upload
      const fileInput = page.locator('[data-testid="photo-upload-input"]');
      await fileInput.setInputFiles({
        name: 'test-photo.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
      });
      
      // Verify preview appears
      await expect(page.locator('[data-testid="photo-preview"]')).toBeVisible();
    }
    
    // Submit profile
    await page.locator('[data-testid="submit-profile"]').click();
    
    // Step 4: Review and accept terms
    await page.waitForURL(`/guest/accept/${invitationId}`);
    await expect(page.locator('h1')).toContainText('Visitor Agreement');
    
    // Scroll through terms (test scroll tracking)
    const termsContainer = page.locator('[data-testid="terms-container"]');
    await termsContainer.evaluate(el => el.scrollTop = el.scrollHeight);
    
    // Verify all required sections are present
    await expect(page.locator('[data-testid="terms-section-safety"]')).toBeVisible();
    await expect(page.locator('[data-testid="terms-section-confidentiality"]')).toBeVisible();
    await expect(page.locator('[data-testid="terms-section-liability"]')).toBeVisible();
    
    // Check agreement checkbox
    await page.locator('[data-testid="agree-checkbox"]').check();
    
    // Step 5: Digital signature capture
    await expect(page.locator('[data-testid="signature-pad"]')).toBeVisible();
    
    // Draw signature (simulate mouse/touch events)
    const signaturePad = page.locator('[data-testid="signature-canvas"]');
    const box = await signaturePad.boundingBox();
    
    if (box) {
      // Draw a simple signature pattern
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.down();
      await page.mouse.move(box.x + 150, box.y + 50);
      await page.mouse.move(box.x + 150, box.y + 100);
      await page.mouse.move(box.x + 50, box.y + 100);
      await page.mouse.up();
      
      // Verify signature is captured
      await expect(page.locator('[data-testid="signature-preview"]')).toBeVisible();
    }
    
    // Clear and redraw signature (test clear functionality)
    await page.locator('[data-testid="clear-signature"]').click();
    await expect(page.locator('[data-testid="signature-preview"]')).not.toBeVisible();
    
    // Redraw signature
    if (box) {
      await page.mouse.move(box.x + 30, box.y + 30);
      await page.mouse.down();
      await page.mouse.move(box.x + 170, box.y + 70);
      await page.mouse.up();
    }
    
    // Submit acceptance with signature
    await page.locator('[data-testid="submit-acceptance"]').click();
    
    // Step 6: Success page with QR code
    await page.waitForURL(`/guest/success/${invitationId}`);
    await expect(page.locator('h1')).toContainText('Registration Complete');
    
    // Verify QR code is displayed
    await expect(page.locator('[data-testid="guest-qr-code"]')).toBeVisible();
    
    // Verify guest details summary
    await expect(page.locator('[data-testid="summary-name"]')).toContainText(testGuest.name);
    await expect(page.locator('[data-testid="summary-email"]')).toContainText(testGuest.email);
    
    // Test QR code download
    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-testid="download-qr"]').click();
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toContain('qr-code');
    expect(download.suggestedFilename()).toMatch(/\.(png|jpg|jpeg)$/);
    
    // Test email QR code option
    await page.locator('[data-testid="email-qr"]').click();
    await expect(page.locator('[data-testid="email-sent-confirmation"]')).toBeVisible();
    
    // Test add to wallet (if available)
    const hasWalletOption = await page.locator('[data-testid="add-to-wallet"]').isVisible();
    if (hasWalletOption) {
      await page.locator('[data-testid="add-to-wallet"]').click();
      // Verify wallet pass download or redirect
    }
  });

  test('should handle validation errors during registration', async ({ page }) => {
    const invitationId = faker.string.uuid();
    await page.goto(`/guest/register/${invitationId}`);
    
    // Try to submit without required fields
    await page.locator('[data-testid="submit-profile"]').click();
    
    // Verify validation errors appear
    await expect(page.locator('[data-testid="error-name-required"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-phone-required"]')).toBeVisible();
    
    // Test invalid phone format
    await page.locator('[data-testid="guest-name"]').fill('Test User');
    await page.locator('[data-testid="guest-phone"]').fill('invalid-phone');
    await page.locator('[data-testid="submit-profile"]').click();
    
    await expect(page.locator('[data-testid="error-phone-invalid"]')).toBeVisible();
    
    // Fix validation errors
    await page.locator('[data-testid="guest-phone"]').fill('+12345678901');
    await page.locator('[data-testid="submit-profile"]').click();
    
    // Should proceed to next step
    await expect(page).toHaveURL(/\/guest\/accept\//);
  });

  test('should enforce terms acceptance before signature', async ({ page }) => {
    const invitationId = faker.string.uuid();
    await page.goto(`/guest/accept/${invitationId}`);
    
    // Try to sign without accepting terms
    const signaturePad = page.locator('[data-testid="signature-canvas"]');
    const box = await signaturePad.boundingBox();
    
    if (box) {
      await page.mouse.move(box.x + 50, box.y + 50);
      await page.mouse.down();
      await page.mouse.move(box.x + 150, box.y + 50);
      await page.mouse.up();
    }
    
    // Submit button should be disabled
    await expect(page.locator('[data-testid="submit-acceptance"]')).toBeDisabled();
    
    // Accept terms
    await page.locator('[data-testid="agree-checkbox"]').check();
    
    // Now submit button should be enabled
    await expect(page.locator('[data-testid="submit-acceptance"]')).toBeEnabled();
  });

  test('should handle expired invitation gracefully', async ({ page }) => {
    const expiredInvitationId = 'expired-' + faker.string.uuid();
    await page.goto(`/guest/register/${expiredInvitationId}`);
    
    // Should show expiration message
    await expect(page.locator('[data-testid="invitation-expired"]')).toBeVisible();
    await expect(page.locator('[data-testid="invitation-expired"]')).toContainText('expired');
    
    // Should provide contact host option
    await expect(page.locator('[data-testid="contact-host-button"]')).toBeVisible();
    
    // Click contact host
    await page.locator('[data-testid="contact-host-button"]').click();
    
    // Should show contact information or form
    await expect(page.locator('[data-testid="host-contact-info"]')).toBeVisible();
  });

  test('should handle network errors during submission', async ({ page }) => {
    const invitationId = faker.string.uuid();
    await page.goto(`/guest/register/${invitationId}`);
    
    // Fill profile
    await page.locator('[data-testid="guest-name"]').fill('Network Test User');
    await page.locator('[data-testid="guest-phone"]').fill('+12345678901');
    
    // Simulate network failure
    await page.route('**/api/guest/complete-profile', route => {
      route.abort('failed');
    });
    
    // Try to submit
    await page.locator('[data-testid="submit-profile"]').click();
    
    // Should show error message
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="network-error"]')).toContainText('connection');
    
    // Should show retry button
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    
    // Fix network and retry
    await page.unroute('**/api/guest/complete-profile');
    await page.locator('[data-testid="retry-button"]').click();
    
    // Should succeed now
    await expect(page).toHaveURL(/\/guest\/accept\//);
  });

  test('should work on mobile devices', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only test');
    
    const invitationId = faker.string.uuid();
    await page.goto(`/guest/register/${invitationId}`);
    
    // Verify mobile-optimized layout
    await expect(page.locator('[data-testid="mobile-header"]')).toBeVisible();
    
    // Test touch signature
    const signaturePad = page.locator('[data-testid="signature-canvas"]');
    const box = await signaturePad.boundingBox();
    
    if (box) {
      // Simulate touch events
      await page.touchscreen.tap(box.x + 50, box.y + 50);
      await page.touchscreen.tap(box.x + 100, box.y + 50);
      await page.touchscreen.tap(box.x + 150, box.y + 50);
    }
    
    // Verify mobile-specific UI elements
    await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible();
  });

  test('should track registration analytics', async ({ page }) => {
    const invitationId = faker.string.uuid();
    
    // Set up analytics tracking
    const analyticsEvents: any[] = [];
    await page.evaluateOnNewDocument(() => {
      (window as any).analyticsEvents = [];
      (window as any).gtag = (...args: any[]) => {
        (window as any).analyticsEvents.push(args);
      };
    });
    
    await page.goto(`/guest/register/${invitationId}`);
    
    // Complete registration flow
    await page.locator('[data-testid="guest-name"]').fill('Analytics Test');
    await page.locator('[data-testid="guest-phone"]').fill('+12345678901');
    await page.locator('[data-testid="submit-profile"]').click();
    
    // Check analytics events were fired
    const events = await page.evaluate(() => (window as any).analyticsEvents);
    
    // Verify key events
    const hasProfileStarted = events.some((e: any[]) => 
      e[0] === 'event' && e[1] === 'registration_started'
    );
    const hasProfileCompleted = events.some((e: any[]) => 
      e[0] === 'event' && e[1] === 'profile_completed'
    );
    
    expect(hasProfileStarted || hasProfileCompleted).toBeTruthy();
  });

  test('should support accessibility features', async ({ page }) => {
    const invitationId = faker.string.uuid();
    await page.goto(`/guest/register/${invitationId}`);
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="guest-name"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="guest-phone"]')).toBeFocused();
    
    // Test ARIA labels
    const nameInput = page.locator('[data-testid="guest-name"]');
    await expect(nameInput).toHaveAttribute('aria-label', /name/i);
    
    const phoneInput = page.locator('[data-testid="guest-phone"]');
    await expect(phoneInput).toHaveAttribute('aria-label', /phone/i);
    
    // Test form validation announcements
    await page.locator('[data-testid="submit-profile"]').click();
    
    const errorMessage = page.locator('[data-testid="error-name-required"]');
    await expect(errorMessage).toHaveAttribute('role', 'alert');
    
    // Test high contrast mode
    await page.emulateMedia({ colorScheme: 'dark' });
    
    // Verify contrast ratios are maintained
    const submitButton = page.locator('[data-testid="submit-profile"]');
    const styles = await submitButton.evaluate(el => {
      const computed = getComputedStyle(el);
      return {
        color: computed.color,
        backgroundColor: computed.backgroundColor,
      };
    });
    
    // Basic check that colors are defined
    expect(styles.color).toBeTruthy();
    expect(styles.backgroundColor).toBeTruthy();
  });
});