import { sanitizeArtifactHtml } from "./sanitize"

const RUNTIME = String.raw`
(() => {
  const format = (value, kind) => {
    if (value === null || value === undefined) return '—';
    if (kind === 'currency') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value));
    if (kind === 'percent') return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 }).format(Number(value) / 100);
    if (kind === 'number') return new Intl.NumberFormat('en-US').format(Number(value));
    return String(value);
  };
  const at = (obj, path) => path.split('.').reduce((value, key) => value == null ? undefined : value[key], obj);
  const renderBars = (node, rows) => {
    if (!Array.isArray(rows)) return;
    const max = Math.max(...rows.map((row) => Number(row.value ?? row.spend ?? row.count ?? 0)), 1);
    node.innerHTML = '';
    rows.slice(-12).forEach((row) => {
      const item = document.createElement('div'); item.className = 'tt-bar-item';
      const label = document.createElement('span'); label.textContent = String(row.date ?? row.merchant ?? '');
      const bar = document.createElement('i'); bar.style.height = Math.max(8, (Number(row.value ?? row.spend ?? row.count ?? 0) / max) * 100) + '%';
      item.append(bar, label); node.append(item);
    });
  };
  const renderTable = (node, rows) => {
    if (!Array.isArray(rows)) return;
    const body = node.querySelector('tbody'); if (!body) return;
    body.innerHTML = '';
    rows.slice(0, 8).forEach((row) => {
      const tr = document.createElement('tr');
      ['merchant','offer','amount','status'].forEach((field) => { const td = document.createElement('td'); td.textContent = format(row[field], field === 'amount' ? 'currency' : ''); tr.append(td); });
      body.append(tr);
    });
  };
  addEventListener('message', (event) => {
    if (event.data?.type !== 'trytrust:data') return;
    const payload = event.data.payload || {};
    document.querySelectorAll('[data-tt-bind]').forEach((node) => {
      const path = node.getAttribute('data-tt-bind'); const value = at(payload, path);
      if (node.hasAttribute('data-tt-chart')) renderBars(node, value);
      else if (node.tagName === 'TABLE') renderTable(node, value);
      else node.textContent = format(value, node.getAttribute('data-tt-format'));
    });
    const stamp = document.querySelector('[data-tt-updated]');
    if (stamp) stamp.textContent = 'Updated ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  });
  parent.postMessage({ type: 'trytrust:ready' }, '*');
})();`

export function buildArtifactDocument(html: string) {
  const safe = sanitizeArtifactHtml(html)
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline' https://fonts.googleapis.com; script-src 'unsafe-inline'; font-src https://fonts.gstatic.com data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>
  :root{color-scheme:light;font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a}*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}.tt-bar-item{height:132px;display:flex;flex:1;min-width:28px;flex-direction:column;justify-content:flex-end;gap:7px;text-align:center;font-size:10px;color:#64748b;font-family:'Inter',sans-serif}.tt-bar-item i{display:block;min-height:8px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,#3b82f6,#1d4ed8)}.tt-chart{display:flex;align-items:flex-end;gap:8px;min-height:160px}table{width:100%;border-collapse:collapse;font-family:'Inter',sans-serif}th,td{padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:12px;font-family:'Inter',sans-serif}</style></head><body>${safe}<script>${RUNTIME}</script></body></html>`
}

