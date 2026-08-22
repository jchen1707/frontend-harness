import { expect, test } from '@playwright/test';

// End-to-end journey against the real browser worker.
// This is the only proof that the MSW worker starts and serves data in Chrome.
test('the projects list renders and a row navigates to the project detail stub', async ({
  page,
}) => {
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();

  const firstRowLink = page.getByRole('link').first();
  const projectHref = await firstRowLink.getAttribute('href');
  expect(projectHref).not.toBeNull();

  await firstRowLink.click();
  await expect(page).toHaveURL(projectHref!);
  await expect(page.getByRole('heading', { name: /Project project-/ })).toBeVisible();
});
