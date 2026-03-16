import { chromium } from 'playwright';

async function login() {
  const browser = await chromium.launch();

  const page = await browser.newPage();

  await page.goto('https://old.example.com/login');

  await page.fill('#username', 'user');
  await page.fill('#password', 'pass');

  await page.click('button[type=submit]');

  await page.context().storageState({
    path: 'auth/auth.json',
  });

  await browser.close();
}

login();
