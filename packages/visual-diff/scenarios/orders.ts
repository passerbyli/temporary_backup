export async function ordersScenario(page) {
  await page.click('text=筛选');

  await page.fill('#keyword', 'test');

  await page.click('text=查询');

  await page.waitForLoadState('networkidle');
}
