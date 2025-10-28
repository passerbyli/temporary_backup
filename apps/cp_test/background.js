// background.js - 支持：按规则过滤、打开登录页捕获 cookie、为账号保存/写入 cookie、replay 使用保存的 cookie
const STORAGE_CAP = 'authInspector_captured';
const STORAGE_ACCS = 'authInspector_accounts';
const STORAGE_FILTER = 'authInspector_filter';
const MAX_CAPTURE = 2000;

function nowISO() {
  return new Date().toISOString();
}

// Helpers
async function getStored(key) {
  const o = await chrome.storage.local.get(key);
  return o[key] || null;
}
async function setStored(obj) {
  await chrome.storage.local.set(obj);
}

async function saveCaptureIfMatches(payload) {
  const filter = (await getStored(STORAGE_FILTER)) || {};
  const include = filter.includeRegex || '';
  const exclude = filter.excludeRegex || '';
  const useFilters = !!filter.useFilters;
  // if not using filters, accept all
  if (useFilters) {
    try {
      if (include) {
        const reInc = new RegExp(include);
        if (!reInc.test(payload.url)) return;
      }
      if (exclude) {
        const reEx = new RegExp(exclude);
        if (reEx.test(payload.url)) return;
      }
    } catch (e) {
      // if regex invalid, skip saving to avoid noise
      console.warn('Invalid filter regex', e);
      return;
    }
  }
  // Save
  const current = (await getStored(STORAGE_CAP)) || [];
  const item = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...payload,
    receivedAt: nowISO(),
  };
  current.unshift(item);
  if (current.length > MAX_CAPTURE) current.length = MAX_CAPTURE;
  await setStored({ [STORAGE_CAP]: current });
}

// Message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === 'cap_request') {
        await saveCaptureIfMatches(msg.payload);
        sendResponse({ ok: true });
      } else if (msg?.type === 'get_captures') {
        const caps = (await getStored(STORAGE_CAP)) || [];
        sendResponse({ ok: true, captures: caps });
      } else if (msg?.type === 'get_accounts') {
        const accs = (await getStored(STORAGE_ACCS)) || [];
        sendResponse({ ok: true, accounts: accs });
      } else if (msg?.type === 'save_accounts') {
        await setStored({ [STORAGE_ACCS]: msg.accounts || [] });
        sendResponse({ ok: true });
      } else if (msg?.type === 'open_login_tab') {
        // payload: { url }
        const tab = await chrome.tabs.create({ url: msg.url, active: true });
        sendResponse({ ok: true, tabId: tab.id });
      } else if (msg?.type === 'capture_cookies_from_active_tab') {
        // payload: { accountName, tabId }
        const accountName = msg.accountName;
        // get tab from tabId or active
        let tab;
        if (msg.tabId) tab = await chrome.tabs.get(msg.tabId);
        else {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          tab = tabs && tabs[0];
        }
        if (!tab || !tab.url) {
          sendResponse({ ok: false, error: 'no-active-tab' });
          return;
        }
        const urlObj = new URL(tab.url);
        // chrome.cookies.getAll expects domain without protocol; use urlObj.hostname
        const cookies = await chrome.cookies.getAll({ domain: urlObj.hostname });
        // store cookies under account
        const accounts = (await getStored(STORAGE_ACCS)) || [];
        const idx = accounts.findIndex((a) => a.name === accountName);
        const cookiesToStore = cookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          secure: c.secure,
          httpOnly: c.httpOnly,
          sameSite: c.sameSite,
          expirationDate: c.expirationDate,
        }));
        if (idx >= 0) {
          accounts[idx].storedCookies = cookiesToStore;
        } else {
          accounts.push({ name: accountName, type: 'cookie', storedCookies: cookiesToStore });
        }
        await setStored({ [STORAGE_ACCS]: accounts });
        sendResponse({ ok: true, cookiesSaved: cookiesToStore.length });
      } else if (msg?.type === 'clear_stored_cookies') {
        // payload: { accountName }
        const accs = (await getStored(STORAGE_ACCS)) || [];
        const idx = accs.findIndex((a) => a.name === msg.accountName);
        if (idx >= 0) {
          delete accs[idx].storedCookies;
          await setStored({ [STORAGE_ACCS]: accs });
          sendResponse({ ok: true });
        } else sendResponse({ ok: false, error: 'account-not-found' });
      } else if (msg?.type === 'save_filter') {
        await setStored({ [STORAGE_FILTER]: msg.filter || {} });
        sendResponse({ ok: true });
      } else if (msg?.type === 'get_filter') {
        const f = (await getStored(STORAGE_FILTER)) || { useFilters: false, includeRegex: '', excludeRegex: '' };
        sendResponse({ ok: true, filter: f });
      } else if (msg?.type === 'replay_request') {
        // payload: { capture, accounts, options }
        const { capture, accounts, options } = msg.payload;
        const results = [];

        // helper to set cookies for one account
        async function setCookiesForAccount(acc) {
          if (!acc.storedCookies || !Array.isArray(acc.storedCookies)) return;
          try {
            for (const c of acc.storedCookies) {
              // build url param for chrome.cookies.set: requires scheme, use https if secure else http
              const scheme = c.secure ? 'https' : 'http';
              const domain = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
              const urlBase = `${scheme}://${domain}${c.path || '/'}`;
              const details = {
                url: urlBase,
                name: c.name,
                value: c.value,
                path: c.path || '/',
                secure: c.secure,
                httpOnly: c.httpOnly,
                expirationDate: c.expirationDate,
              };
              // when domain is set, chrome.cookies.set may ignore domain param; using url is required
              try {
                await chrome.cookies.set(details);
              } catch (e) {
                console.warn('cookie.set fail', e);
              }
            }
          } catch (e) {
            console.warn('setCookiesForAccount err', e);
          }
        }

        async function replayForAccount(acc) {
          const out = { account: acc.name, status: null, bodyText: null, error: null, timestamp: nowISO() };
          try {
            // If cookie account and includeCookies option, write cookies first
            if (acc.type === 'cookie' && options?.useStoredCookies) {
              await setCookiesForAccount(acc);
            }
            // prepare fetch
            const fetchOpts = {
              method: capture.method || 'GET',
              headers: {},
              credentials: acc.type === 'cookie' && options?.useStoredCookies ? 'include' : 'omit',
            };

            if (capture.headers && typeof capture.headers === 'object') {
              for (const [k, v] of Object.entries(capture.headers)) {
                if (k.toLowerCase() === 'authorization') continue;
                fetchOpts.headers[k] = v;
              }
            }

            if (acc.type === 'token' && acc.token) {
              fetchOpts.headers['Authorization'] = acc.token.startsWith('Bearer') ? acc.token : `Bearer ${acc.token}`;
            }

            if (capture.body) {
              try {
                JSON.parse(capture.body);
                fetchOpts.body = capture.body;
                fetchOpts.headers['Content-Type'] = fetchOpts.headers['Content-Type'] || 'application/json';
              } catch (e) {
                fetchOpts.body = capture.body;
              }
            }

            const resp = await fetch(capture.url, fetchOpts);
            out.status = resp.status;
            const ct = resp.headers.get('content-type') || '';
            out.statusText = resp.statusText;
            out.bodyText = await resp.clone().text();
          } catch (err) {
            out.error = err.message || String(err);
          }
          return out;
        }

        // run sequential with concurrency
        const concurrency = Math.max(1, options?.concurrency || 2);
        const delayMs = Math.max(0, options?.delayMs || 200);

        for (let i = 0; i < accounts.length; i += concurrency) {
          const batch = accounts.slice(i, i + concurrency);
          const promises = batch.map((acc) => replayForAccount(acc));
          const batchRes = await Promise.all(promises);
          results.push(...batchRes);
          if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
        }

        sendResponse({ ok: true, results, captureId: capture.id });
      } else if (msg?.type === 'export_captures') {
        const caps = (await getStored(STORAGE_CAP)) || [];
        sendResponse({ ok: true, data: caps });
      } else {
        sendResponse({ ok: false, error: 'unknown-message' });
      }
    } catch (e) {
      console.error(e);
      sendResponse({ ok: false, error: e && e.message ? e.message : String(e) });
    }
  })();
  return true;
});
