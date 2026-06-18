import { expect, test } from '@playwright/test';

// E2E smoke test: the dev server boots and the app renders.
// (Frontend analog of the python-harness testcontainers integration test.)
test('home page renders the harness heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'frontend-development-harness' })).toBeVisible();
});
