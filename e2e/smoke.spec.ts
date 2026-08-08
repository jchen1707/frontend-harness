import { expect, test } from '@playwright/test';

// E2E smoke tests: the dev server boots, routing works, and the app renders.
// (Frontend analog of the python-harness testcontainers integration test.)

test('the root path redirects to /projects', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/projects');
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
});

test('the health path still renders the harness heading', async ({ page }) => {
  await page.goto('/health');
  await expect(page.getByRole('heading', { name: 'frontend-development-harness' })).toBeVisible();
});
