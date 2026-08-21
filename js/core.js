/* ============================================================
   CORE — formatting, DOM helpers, toasts, modals, exports
   ============================================================ */
window.UI = (function () {
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  const esc = s => String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const money = n => CONFIG.CURRENCY +
    Number(n || 0).toLocaleString(CONFIG.LOCALE, { maximumFractionDigits:2 });

  const num = n => Number(n || 0).toLocaleString(CONFIG.LOCALE);

  const date = d => d ? new Date(d).toLocaleDateString(CONFIG.LOCALE,
    { day:'2-digit', month:'short', year:'numeric' }) : '—';

  const dateTime = d => d ? new Date(d).toLocaleString(CONFIG.LOCALE,
    { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

  const iso = d => new Date(d).toISOString().slice(0, 10);
  const today = () => iso(new Date());
  const daysAgo = n => iso(new Date(Date.now() - n * 864e5));

  /* ---------- status chips ---------- */
  const ORDER_FLOW = ['new','confirmed','processing','packed','shipped','delivered'];
  const STATUS_TONE = {
    new:'info', confirmed:'info', processing:'warn', packed:'warn',
    shipped:'warn', delivered:'ok', cancelled:'bad',
    pending:'warn', paid:'ok', failed:'bad', refunded:'bad',
    available:'ok', low_stock:'warn', out_of_stock:'bad',
    active:'ok', scheduled:'info', expired:'muted', disabled:'muted',
    approved:'ok', hidden:'muted', issued:'info'
  };
  const label = s => String(s || '').replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  const chip = s => `<span class="chip chip-${STATUS_TONE[s] || 'muted'}">${esc(label(s))}</span>`;

  /* ---------- toast ---------- */
  function toast(msg, kind) {
    let host = $('#toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toasts'; host.className = 'toasts';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.setAttribute('role', 'status');
    el.innerHTML = `<i class="bi ${kind === 'bad' ? 'bi-exclamation-triangle' : 'bi-check-circle'}"></i>
                    <span>${esc(msg)}</span>`;
    host.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 2800);
  }

  /* ---------- modal ---------- */
  function modal({ title, body, footer, wide }) {
    closeModal();
    const el = document.createElement('div');
    el.className = 'modal-wrap';
    el.innerHTML = `
      <div class="modal-scrim" data-close></div>
      <div class="modal-card ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"
           aria-label="${esc(title)}">
        <header class="modal-head">
          <h2>${esc(title)}</h2>
          <button class="icon-btn" data-close aria-label="Close"><i class="bi bi-x-lg"></i></button>
        </header>
        <div class="modal-body">${body}</div>
        ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
      </div>`;
    document.body.appendChild(el);
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => el.classList.add('open'));
    el.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
    const f = el.querySelector('input,select,textarea,button:not([data-close])');
    if (f) setTimeout(() => f.focus(), 80);
    return el;
  }
  function closeModal() {
    const el = $('.modal-wrap');
    if (!el) return;
    el.classList.remove('open');
    document.body.classList.remove('no-scroll');
    setTimeout(() => el.remove(), 180);
  }
  addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  function confirmBox(title, message, confirmLabel) {
    return new Promise(resolve => {
      const el = modal({
        title,
        body:`<p class="muted">${message}</p>`,
        footer:`<button class="btn btn-ghost" data-close>Cancel</button>
                <button class="btn btn-danger" id="cfmYes">${esc(confirmLabel || 'Confirm')}</button>`
      });
      el.querySelector('#cfmYes').onclick = () => { closeModal(); resolve(true); };
      el.addEventListener('click', e => {
        if (e.target.closest('[data-close]')) resolve(false);
      });
    });
  }

  /* ---------- skeleton + empty ---------- */
  const skeletonRows = (cols, rows) =>
    Array.from({ length: rows || 6 }, () =>
      `<tr>${Array.from({ length: cols }, () => '<td><span class="skel"></span></td>').join('')}</tr>`
    ).join('');

  const empty = (icon, title, note, action) => `
    <div class="empty">
      <i class="bi ${icon}"></i>
      <b>${esc(title)}</b>
      ${note ? `<p>${esc(note)}</p>` : ''}
      ${action || ''}
    </div>`;

  /* ---------- export ---------- */
  function toCSV(rows, headers) {
    const esc2 = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = headers.map(h => esc2(h.label)).join(',');
    const body = rows.map(r => headers.map(h => esc2(
      typeof h.value === 'function' ? h.value(r) : r[h.key])).join(',')).join('\n');
    return head + '\n' + body;
  }
  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 200);
  }
  function exportCSV(name, rows, headers) {
    if (!rows.length) { toast('Nothing to export', 'bad'); return; }
    download(name, toCSV(rows, headers));
    toast(`Exported ${rows.length} rows`);
  }

  /* ---------- printing ---------- */
  function printHTML(title, inner) {
    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) { toast('Allow pop-ups to print', 'bad'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8">
      <title>${esc(title)}</title>
      <style>
        body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#25211D;
             padding:28px;max-width:760px;margin:auto}
        h1{font-size:20px;margin:0 0 4px} .sub{color:#6E655C;font-size:12px;margin-bottom:18px}
        table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}
        th{text-align:left;border-bottom:2px solid #DED4C7;padding:8px 6px;font-size:11px;
           text-transform:uppercase;letter-spacing:.06em;color:#6E655C}
        td{padding:8px 6px;border-bottom:1px solid #ECE3D5}
        .r{text-align:right} .tot{font-weight:700;font-size:15px}
        .brand{color:#7A263A;font-weight:700;letter-spacing:.08em}
      </style></head><body>${inner}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  }

  /* ---------- whatsapp ---------- */
  const waLink = (phone, text) => {
    const digits = String(phone || '').replace(/\D/g, '');
    const full = digits.length === 10 ? '91' + digits : digits;
    return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
  };

  /* ---------- debounce ---------- */
  function debounce(fn, ms) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms || 220); };
  }

  return { $, $$, esc, money, num, date, dateTime, iso, today, daysAgo,
           chip, label, ORDER_FLOW, STATUS_TONE, toast, modal, closeModal, confirmBox,
           skeletonRows, empty, exportCSV, download, printHTML, waLink, debounce };
})();
