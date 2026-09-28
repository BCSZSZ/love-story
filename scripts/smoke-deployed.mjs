import assert from 'node:assert/strict';
import { chromium, devices } from '@playwright/test';

const siteUrl = process.argv[2]?.replace(/\/$/, '');
if (!siteUrl || !siteUrl.startsWith('https://')) {
  process.stderr.write('用法：pnpm test:smoke:deployed https://<CloudFront 域名>\n');
  process.exit(2);
}

const health = await globalThis.fetch(`${siteUrl}/api/health`, { cache: 'no-store' });
assert.equal(health.status, 200, `health check returned ${health.status}`);
const healthBody = await health.json();
assert.equal(healthBody.status, 'ok');
assert.equal(healthBody.uploadEnabled, true);

const browser = await chromium.launch();
const results = [];

async function readDraft(page) {
  return page.evaluate(() => {
    const raw = globalThis.localStorage.getItem('tls:draft:v2');
    return raw ? JSON.parse(raw) : undefined;
  });
}

async function cleanupRecord(page) {
  const draft = await readDraft(page).catch(() => undefined);
  if (!draft?.recordId || !draft?.managementToken || !draft?.acceptedRevision) return undefined;
  const cleanup = await page.evaluate(async ({ recordId, managementToken }) => {
    const response = await globalThis.fetch(`/api/v1/records/${encodeURIComponent(recordId)}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${managementToken}` },
    });
    return { status: response.status, body: await response.text() };
  }, draft);
  assert.ok([204, 404, 410].includes(cleanup.status), `cleanup returned ${cleanup.status}: ${cleanup.body}`);
  return { recordId: draft.recordId, status: cleanup.status };
}

async function waitForCloudSave(page) {
  await page.waitForFunction(() => {
    const raw = globalThis.localStorage.getItem('tls:draft:v2');
    if (!raw) return false;
    const draft = JSON.parse(raw);
    return draft.saveStatus === 'saved' && draft.acceptedRevision > 0;
  }, undefined, { timeout: 30_000 });
}

function requirementSection(page, fieldId) {
  return page.locator(`[data-field-id="${fieldId}"] .field-card__columns > section`).nth(1);
}

async function assertNoOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: globalThis.document.documentElement.scrollWidth,
    clientWidth: globalThis.document.documentElement.clientWidth,
  }));
  assert.ok(dimensions.scrollWidth <= dimensions.clientWidth, `horizontal overflow: ${JSON.stringify(dimensions)}`);
}

async function runDesktop() {
  const context = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  let cleanup;
  try {
    await page.goto(`${siteUrl}/#/`, { waitUntil: 'networkidle' });
    await page.locator('.city-picker select').selectOption('cn_shanghai');
    await page.getByRole('button', { name: '开始估算' }).click();
    await page.locator('.field-card').first().waitFor();
    assert.equal(await page.locator('.field-card').count(), 62);
    assert.equal(await page.locator('[data-field-id="residence"]').count(), 0);
    await page.locator('[data-field-id="age"] input[type="number"]').fill('32');
    await requirementSection(page, 'age').getByRole('button', { name: /25～29岁/ }).click();
    await requirementSection(page, 'nationality').getByRole('button', { name: /^中国/ }).click();
    await requirementSection(page, 'university_tier').getByRole('button', { name: /仅985/ }).click();
    await waitForCloudSave(page);
    await assertNoOverflow(page);

    await page.locator('button:visible').filter({ hasText: '查看完整结果' }).first().click();
    await page.getByText('上海同城条件池', { exact: true }).first().waitFor();
    await page.getByText('圈层内预计可触达', { exact: true }).first().waitFor();
    const before = await page.locator('.result-hero .result-pair article').first().locator('strong').textContent();
    await page.locator('.strictness-row').first().getByRole('button', { name: /尽量满足/ }).click();
    await page.getByText(/多项合并预览/).waitFor();
    await page.getByRole('button', { name: '应用这些调整' }).click();
    await page.waitForFunction((previous) => {
      const current = globalThis.document.querySelector('.result-hero .result-pair article strong')?.textContent;
      return current !== previous;
    }, before);
    await waitForCloudSave(page);

    await page.getByRole('button', { name: /拓展圈/ }).click();
    await page.getByText('朋友助力', { exact: true }).click();
    await page.getByText('家庭助力', { exact: true }).click();
    await page.getByRole('button', { name: '应用到本次结果' }).click();
    await waitForCloudSave(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '下载 PNG' }).click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^love-story-cn_shanghai-\d{4}-\d{2}-\d{2}\.png$/);
    await page.getByAltText('上海·爱情故事结果卡片预览').waitFor();

    const restored = await page.locator('.result-hero .result-pair article').first().locator('strong').textContent();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.result-hero .result-pair article').first().locator('strong').textContent(), restored);
    await assertNoOverflow(page);
    assert.deepEqual(pageErrors, []);
  } finally {
    cleanup = await cleanupRecord(page).catch((error) => ({ error: error.message }));
    await context.close();
  }
  assert.ok(cleanup && !cleanup.error, `desktop cleanup failed: ${JSON.stringify(cleanup)}`);
  return { viewport: '1280x900', cloudSave: true, png: true, reloadRestore: true, cleanup };
}

async function runMobile() {
  const context = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  let cleanup;
  try {
    await page.goto(`${siteUrl}/#/`, { waitUntil: 'networkidle' });
    await page.locator('.city-picker select').selectOption('jp_osaka');
    await page.getByRole('button', { name: '开始估算' }).click();
    await page.locator('.field-card').first().waitFor();
    assert.equal(await page.locator('.field-card').count(), 62);
    assert.equal(await page.locator('[data-field-id="residence"]').count(), 0);
    await page.locator('[data-field-id="age"] input[type="number"]').fill('29');
    await requirementSection(page, 'nationality').getByRole('button', { name: /^日本/ }).click();
    await waitForCloudSave(page);
    await page.locator('.mobile-summary').waitFor();
    await assertNoOverflow(page);
    await page.locator('button:visible').filter({ hasText: '查看完整结果' }).first().click();
    await page.getByText('大阪同城条件池', { exact: true }).first().waitFor();
    await page.getByText('圈层内预计可触达', { exact: true }).first().waitFor();
    const restored = await page.locator('.result-hero .result-pair article').first().locator('strong').textContent();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.result-hero .result-pair article').first().locator('strong').textContent(), restored);
    await assertNoOverflow(page);
    assert.deepEqual(pageErrors, []);
  } finally {
    cleanup = await cleanupRecord(page).catch((error) => ({ error: error.message }));
    await context.close();
  }
  assert.ok(cleanup && !cleanup.error, `mobile cleanup failed: ${JSON.stringify(cleanup)}`);
  return { viewport: '390x844', cloudSave: true, reloadRestore: true, cleanup };
}

try {
  results.push({ desktop: await runDesktop() });
  results.push({ mobile: await runMobile() });
  process.stdout.write(`${JSON.stringify({ siteUrl, health: healthBody, results }, null, 2)}\n`);
} finally {
  await browser.close();
}
