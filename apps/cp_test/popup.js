// popup.js - 支持 account actions & filter rules
document.addEventListener('DOMContentLoaded', init);

function bg(msg) {
  return new Promise((res) => chrome.runtime.sendMessage(msg, res));
}

async function init() {
  document.getElementById('refreshBtn').addEventListener('click', loadCaptures);
  document.getElementById('saveAccountsBtn').addEventListener('click', saveAccounts);
  document.getElementById('addAccountBtn').addEventListener('click', addAccount);
  document.getElementById('exportBtn').addEventListener('click', exportCaptures);
  document.getElementById('saveFilterBtn').addEventListener('click', saveFilter);

  // load accounts & filter & captures
  await loadFilter();
  await loadAccounts();
  await loadCaptures();
}

async function loadFilter() {
  const resp = await bg({ type: 'get_filter' });
  if (resp?.ok) {
    const f = resp.filter || {};
    document.getElementById('useFilters').checked = !!f.useFilters;
    document.getElementById('includeRegex').value = f.includeRegex || '';
    document.getElementById('excludeRegex').value = f.excludeRegex || '';
  }
}

async function saveFilter() {
  const filter = {
    useFilters: document.getElementById('useFilters').checked,
    includeRegex: document.getElementById('includeRegex').value.trim(),
    excludeRegex: document.getElementById('excludeRegex').value.trim(),
  };
  const resp = await bg({ type: 'save_filter', filter });
  if (resp?.ok) alert('Filter saved');
  else alert('Save failed');
}

async function loadCaptures() {
  const resp = await bg({ type: 'get_captures' });
  const listDiv = document.getElementById('capturesList');
  listDiv.innerHTML = '';
  if (!resp?.ok) {
    listDiv.textContent = 'Load failed';
    return;
  }
  const caps = resp.captures || [];
  if (caps.length === 0) {
    listDiv.textContent = 'No captures yet.';
    return;
  }
  caps.forEach((cap) => {
    const d = document.createElement('div');
    d.className = 'captureItem';
    d.textContent = `${cap.method || 'GET'} ${truncate(cap.url, 130)}`;
    d.addEventListener('click', () => onSelectCapture(cap));
    listDiv.appendChild(d);
  });
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n) + '...' : s;
}

async function loadAccounts() {
  const resp = await bg({ type: 'get_accounts' });
  const listDiv = document.getElementById('accountsList');
  listDiv.innerHTML = '';
  const accounts = resp?.accounts || [];
  if (accounts.length === 0) {
    listDiv.textContent = 'No accounts configured. Click "Add Account" to create one.';
    return;
  }
  accounts.forEach((acc) => {
    const el = createAccountNode(acc);
    listDiv.appendChild(el);
  });
}

function createAccountNode(acc) {
  const wrapper = document.createElement('div');
  wrapper.className = 'captureItem';
  const title = document.createElement('div');
  title.innerHTML = `<strong>${escapeHtml(acc.name)}</strong> <small>(${acc.type || 'token'})</small>`;
  wrapper.appendChild(title);

  const area = document.createElement('textarea');
  area.rows = 3;
  area.value = JSON.stringify(acc, null, 2);
  wrapper.appendChild(area);

  const btnRow = document.createElement('div');
  btnRow.style.marginTop = '6px';
  const openBtn = document.createElement('button');
  openBtn.textContent = 'Open login tab';
  openBtn.addEventListener('click', async () => {
    // open login tab - we expect user to login as that account manually
    const url = prompt(
      'Open which URL for login? (full URL)',
      window.location.origin || 'https://your-test-site.example',
    );
    if (!url) return;
    const resp = await bg({ type: 'open_login_tab', url });
    if (resp?.ok) alert('Login tab opened. Please login as the account, then come back and click "Capture cookies".');
  });
  btnRow.appendChild(openBtn);

  const capBtn = document.createElement('button');
  capBtn.textContent = 'Capture cookies from active tab';
  capBtn.style.marginLeft = '6px';
  capBtn.addEventListener('click', async () => {
    const accountName = acc.name;
    const tabId = null; // use active tab
    const resp = await bg({ type: 'capture_cookies_from_active_tab', accountName, tabId });
    if (resp?.ok) {
      alert(`Saved ${resp.cookiesSaved} cookies to account ${accountName}`);
      await loadAccounts();
    } else alert('Capture failed: ' + (resp.error || 'unknown'));
  });
  btnRow.appendChild(capBtn);

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear stored cookies';
  clearBtn.style.marginLeft = '6px';
  clearBtn.addEventListener('click', async () => {
    const r = confirm('Clear stored cookies for this account?');
    if (!r) return;
    const resp = await bg({ type: 'clear_stored_cookies', accountName: acc.name });
    if (resp?.ok) {
      alert('Cleared');
      await loadAccounts();
    } else alert('Clear failed');
  });
  btnRow.appendChild(clearBtn);

  wrapper.appendChild(btnRow);

  // update & delete buttons
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Update account';
  saveBtn.style.marginTop = '6px';
  saveBtn.addEventListener('click', async () => {
    try {
      const newAcc = JSON.parse(area.value);
      // load existing, replace or add
      const resp = await bg({ type: 'get_accounts' });
      const arr = resp.accounts || [];
      const idx = arr.findIndex((a) => a.name === acc.name);
      if (idx >= 0) arr[idx] = newAcc;
      else arr.push(newAcc);
      await bg({ type: 'save_accounts', accounts: arr });
      alert('Saved');
      await loadAccounts();
    } catch (e) {
      alert('Invalid JSON');
    }
  });
  wrapper.appendChild(saveBtn);

  const delBtn = document.createElement('button');
  delBtn.textContent = 'Delete';
  delBtn.style.marginLeft = '6px';
  delBtn.addEventListener('click', async () => {
    if (!confirm('Delete this account?')) return;
    const resp = await bg({ type: 'get_accounts' });
    const arr = resp.accounts || [];
    const idx = arr.findIndex((a) => a.name === acc.name);
    if (idx >= 0) {
      arr.splice(idx, 1);
      await bg({ type: 'save_accounts', accounts: arr });
      alert('Deleted');
      await loadAccounts();
    }
  });
  wrapper.appendChild(delBtn);

  return wrapper;
}

function escapeHtml(s) {
  return (s + '').replace(
    /[&<>"']/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m],
  );
}

function addAccount() {
  const name = prompt('Account name (e.g. test1)');
  if (!name) return;
  // default account object
  const acc = { name, type: 'token', token: 'REPLACE_ME' };
  (async () => {
    const resp = await bg({ type: 'get_accounts' });
    const arr = resp.accounts || [];
    arr.push(acc);
    await bg({ type: 'save_accounts', accounts: arr });
    await loadAccounts();
  })();
}

async function saveAccounts() {
  // rebuild from displayed list
  const nodes = Array.from(document.getElementById('accountsList').children);
  const arr = [];
  for (const n of nodes) {
    const ta = n.querySelector('textarea');
    if (!ta) continue;
    try {
      const obj = JSON.parse(ta.value);
      arr.push(obj);
    } catch (e) {
      /* skip invalid */
    }
  }
  await bg({ type: 'save_accounts', accounts: arr });
  alert('Saved accounts');
}

async function onSelectCapture(cap) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = `<h4>Selected: ${cap.method} ${cap.url}</h4>`;
  const details = document.createElement('pre');
  const safeBody = cap.body && cap.body.length > 2000 ? cap.body.slice(0, 2000) + '...[truncated]' : cap.body;
  details.textContent = `Captured at: ${cap.receivedAt || cap.timestamp}\nInitiator: ${cap.initiator}\nHeaders: ${JSON.stringify(cap.headers || {}, null, 2)}\nBody: ${safeBody}`;
  resultsDiv.appendChild(details);

  const replayBtn = document.createElement('button');
  replayBtn.textContent = 'Replay with configured accounts';
  replayBtn.addEventListener('click', () => startReplay(cap));
  resultsDiv.appendChild(replayBtn);
}

async function startReplay(cap) {
  const respAcc = await bg({ type: 'get_accounts' });
  const accounts = respAcc.accounts || [];
  if (!accounts.length) {
    alert('No accounts configured');
    return;
  }

  const concurrency = parseInt(document.getElementById('optConcurrency').value || '2', 10);
  const delayMs = parseInt(document.getElementById('optDelay').value || '200', 10);
  const useStoredCookies = document.getElementById('optUseStoredCookies').checked;

  const resp = await bg({
    type: 'replay_request',
    payload: { capture: cap, accounts, options: { concurrency, delayMs, useStoredCookies } },
  });
  const resultsDiv = document.getElementById('results');
  if (!resp?.ok) {
    resultsDiv.appendChild(document.createElement('div')).textContent = 'Replay failed: ' + JSON.stringify(resp);
    return;
  }
  resultsDiv.appendChild(document.createElement('h4')).textContent = 'Results:';
  resp.results.forEach((r) => {
    const node = document.createElement('div');
    node.innerHTML = `<strong>${r.account}</strong> — status: ${r.status || 'ERR'} ${r.statusText || ''}<br/>${r.error ? 'error: ' + r.error : 'body: ' + (r.bodyText ? sanitize(r.bodyText).slice(0, 3000) : '[empty]')}`;
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(r, null, 2);
    node.appendChild(pre);
    resultsDiv.appendChild(node);
  });
}

function sanitize(text) {
  if (!text) return '';
  return text.replace(/Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/gi, '[REDACTED_TOKEN]');
}

async function exportCaptures() {
  const resp = await bg({ type: 'export_captures' });
  if (!resp?.ok) {
    alert('export failed');
    return;
  }
  const dataStr = JSON.stringify(resp.data || [], null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `authinspector_captures_${new Date().toISOString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
