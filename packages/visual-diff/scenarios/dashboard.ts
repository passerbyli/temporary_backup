export async function dashboardScenario(page) {
  await page.waitForSelector('#dashboard-root');
}
