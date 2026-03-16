export async function takeShot(page, selector, path) {
  const el = page.locator(selector);

  await el.screenshot({
    path,
  });
}
