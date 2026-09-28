import { expect, test, type Page } from '@playwright/test';

function requirementSection(page: Page, fieldId: string) {
  return page.locator(`[data-field-id="${fieldId}"] .field-card__columns > section`).nth(1);
}

test('choose a real city, estimate both ranges, preview strictness, export and restore', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: /每多一个条件/ })).toBeVisible();
  const citySelect = page.locator('.city-picker select');
  await citySelect.selectOption('cn_shanghai');
  await expect(page.locator('.brand')).toHaveText('上海·爱情故事');
  await page.getByRole('button', { name: '开始估算' }).click();

  await expect(page.locator('.field-card')).toHaveCount(62);
  await expect(page.locator('[data-field-id="residence"]')).toHaveCount(0);
  await page.locator('[data-field-id="age"] input[type="number"]').fill('32');
  await requirementSection(page, 'age').getByRole('button', { name: /25～29岁/ }).click();
  await requirementSection(page, 'nationality').getByRole('button', { name: /^中国/ }).click();
  await requirementSection(page, 'university_tier').getByRole('button', { name: /仅985/ }).click();

  const career = page.locator('#group-career');
  if (!(await career.getAttribute('open'))) await career.locator('summary').first().click();
  await requirementSection(page, 'annual_income_cny').getByRole('button', { name: /24万元人民币及以上/ }).click();

  await expect(page.locator('.summary-panel__number')).not.toHaveText(/56 亿/);
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', await page.locator('body').evaluate((body) => body.clientWidth));
  await expect(page.locator('.save-status strong:visible, .mobile-summary small:visible').filter({ hasText: '云端已保存' })).toBeVisible({ timeout: 20_000 });

  await page.locator('button:visible').filter({ hasText: '查看完整结果' }).first().click();
  await expect(page.getByText(/上海同城条件池/, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('圈层内预计可触达', { exact: true }).first()).toBeVisible();
  const appliedBefore = await page.locator('.result-hero .result-pair article').first().locator('strong').textContent();
  const firstStrictness = page.locator('.strictness-row').first();
  await firstStrictness.getByRole('button', { name: /尽量满足/ }).click();
  await expect(page.getByText(/多项合并预览/)).toBeVisible();
  await page.getByRole('button', { name: '应用这些调整' }).click();
  await expect(page.locator('.result-hero .result-pair article').first().locator('strong')).not.toHaveText(appliedBefore ?? '');

  await page.getByRole('button', { name: /拓展圈/ }).click();
  await page.getByText('朋友助力', { exact: true }).click();
  await page.getByText('家庭助力', { exact: true }).click();
  await expect(page.getByText('圈层预览 · 尚未应用', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '应用到本次结果' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 PNG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^love-story-cn_shanghai-\d{4}-\d{2}-\d{2}\.png$/);
  await expect(page.getByAltText('上海·爱情故事结果卡片预览')).toBeVisible();

  const restoredCount = await page.locator('.result-hero .result-pair article').first().locator('strong').textContent();
  await page.reload();
  await expect(page.locator('.result-hero .result-pair article').first().locator('strong')).toHaveText(restoredCount ?? '');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', await page.locator('body').evaluate((body) => body.clientWidth));
});

test('administrator can add a dynamic question, validate, save a draft and export xlsx', async ({ page }, testInfo) => {
  await page.goto('/#/admin');
  await expect(page.getByRole('heading', { name: '配置后台' })).toBeVisible();
  await expect(page.getByRole('button', { name: '条件管理' })).toBeVisible();
  await page.getByRole('button', { name: '条件管理' }).click();
  const suffix = testInfo.project.name.includes('mobile') ? 'mobile' : 'desktop';
  await page.locator('.new-question input').nth(0).fill(`smoke_question_${suffix}`);
  await page.locator('.new-question input').nth(1).fill('冒烟测试问题');
  await page.locator('.new-question select').selectOption('enum');
  await page.locator('.new-question button').click();
  await expect(page.getByText(`smoke_question_${suffix}`, { exact: false }).first()).toBeVisible();

  await page.getByRole('button', { name: '配置概览' }).click();
  const version = `bundle-smoke-${suffix}-${Date.now()}`;
  await page.getByLabel('配置包版本').fill(version);
  await page.getByLabel('目录版本').fill(`catalog-smoke-${suffix}-${Date.now()}`);
  await page.getByLabel('模型版本').fill(`model-smoke-${suffix}-${Date.now()}`);
  await page.getByRole('button', { name: '导入、导出与发布' }).click();
  await page.getByRole('button', { name: '验证并保存草稿' }).click();
  await expect(page.getByText(/配置草稿已保存到服务端/)).toBeVisible({ timeout: 20_000 });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出当前编辑版' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
});
