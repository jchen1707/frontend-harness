import { expect, test } from '@playwright/test';

test('a user can search Projects, reload the result, and return with browser history', async ({
  page,
}) => {
  await page.goto('/projects');
  await expect(page.getByRole('link', { name: 'Project 1' })).toBeVisible();

  await page.keyboard.press('Tab');
  const searchBox = page.getByRole('searchbox', { name: 'Search projects' });
  await expect(searchBox).toBeFocused();

  await searchBox.pressSequentially('Project 2');
  await expect(page).toHaveURL(/\/projects\?q=Project\+2$/);
  await expect(page.getByRole('link', { name: 'Project 2' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Project 1' })).toBeHidden();
  await expect(page.getByRole('status')).toHaveText('1 project found.');

  await page.reload();
  await expect(searchBox).toHaveValue('Project 2');
  await expect(page.getByRole('link', { name: 'Project 2' })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(searchBox).toHaveValue('');
  await expect(page.getByRole('link', { name: 'Project 1' })).toBeVisible();
});
