/* ============================================================
   BILLS — issued bills, date filters, print / export
   ============================================================ */
Shell.register('bills', async function (view) {
  const { esc, money } = UI;
  const state = { q:'', from:'', to:'', preset:'' };
  let all = [];

  view.innerHTML = `
    <section class="card">
      <header class="card-head">
        <h2>Bill history</h2>
        <button class="btn btn-ghost btn-sm" id="billExport">
          <i class="bi bi-download"></i> Export CSV</button>
      </header>
      <div class="filters">
        <div class="search">
          <i class="bi bi-search"></i>
          <input id="billQ" type="search" placeholder="Bill number, customer or phone"
                 aria-label="Search bills">
        </div>
        <div class="seg" id="billPreset" role="group" aria-label="Quick range">
          <button data-p="today">Today</button>
          <button data-p="yesterday">Yesterday</button>
          <button data-p="week">This week</button>
          <button data-p="month">This month</button>
          <button data-p="" class="on">All</button>
        </div>
        <input id="billFrom" type="date" class="inp" aria-label="From date">
        <input id="billTo" type="date" class="inp" aria-label="To date">
      </div>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Bill</th><th>Date</th><th>Customer</th><th>Order</th>
            <th class="r">Amount</th><th>Payment</th><th>Status</th><th></th></tr></thead>
          <tbody id="billBody">${UI.skeletonRows(8, 8)}</tbody>
        </table>
      </div>
      <footer class="card-foot"><span id="billCount" class="muted"></span></footer>
    </section>`;

  const presetRange = p => {
    const d = new Date();
    if (p === 'today') return [UI.today(), UI.today()];
    if (p === 'yesterday') return [UI.daysAgo(1), UI.daysAgo(1)];
    if (p === 'week') {
      const dow = (d.getDay() + 6) % 7;      // Monday as the first day
      return [UI.daysAgo(dow), UI.today()];
    }
    if (p === 'month')
      return [UI.iso(new Date(d.getFullYear(), d.getMonth(), 1)), UI.today()];
    return ['', ''];
  };

  function filtered() {
    const q = state.q.toLowerCase();
    return all.filter(b => {
      const o = b.orders || {};
      const day = (b.issued_at || '').slice(0, 10);
      if (state.from && day < state.from) return false;
      if (state.to && day > state.to) return false;
      if (!q) return true;
      return (b.bill_number + ' ' + (o.customer_name || '') + ' ' + (o.customer_phone || ''))
        .toLowerCase().includes(q);
    });
  }

  function paint() {
    const rows = filtered();
    UI.$('#billBody').innerHTML = rows.length ? rows.map(b => {
      const o = b.orders || {};
      return `<tr>
        <td><b>${esc(b.bill_number)}</b></td>
        <td>${UI.date(b.issued_at)}</td>
        <td>${esc(o.customer_name || '—')}<small>${esc(o.customer_phone || '')}</small></td>
        <td>${esc(o.order_number || '—')}</td>
        <td class="r"><b>${money(b.amount)}</b></td>
        <td>${esc(UI.label(o.payment_method || '—'))}</td>
        <td>${UI.chip(b.status)}</td>
        <td class="r">
          <button class="icon-btn" data-print="${b.order_id}" aria-label="Print bill">
            <i class="bi bi-printer"></i></button>
          <button class="icon-btn" data-view="${b.order_id}" aria-label="View order">
            <i class="bi bi-eye"></i></button>
        </td></tr>`;
    }).join('')
      : `<tr><td colspan="8">${UI.empty('bi-file-earmark-text','No bills in this range',
          'Bills are created when an order is confirmed.')}</td></tr>`;
    UI.$('#billCount').textContent = `${rows.length} of ${all.length} bills`;
  }

  all = await DB.bills();
  paint();

  UI.$('#billQ').addEventListener('input', UI.debounce(e => { state.q = e.target.value; paint(); }));
  UI.$('#billPreset').addEventListener('click', e => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    UI.$$('#billPreset button').forEach(x => x.classList.toggle('on', x === b));
    const [f, t] = presetRange(b.getAttribute('data-p'));
    state.from = f; state.to = t;
    UI.$('#billFrom').value = f; UI.$('#billTo').value = t;
    paint();
  });
  UI.$('#billFrom').addEventListener('change', e => { state.from = e.target.value; paint(); });
  UI.$('#billTo').addEventListener('change', e => { state.to = e.target.value; paint(); });

  UI.$('#billExport').addEventListener('click', () => UI.exportCSV(
    `bills-${UI.today()}.csv`, filtered(), [
      { label:'Bill', key:'bill_number' },
      { label:'Date', value:b => UI.date(b.issued_at) },
      { label:'Customer', value:b => (b.orders || {}).customer_name || '' },
      { label:'Phone', value:b => (b.orders || {}).customer_phone || '' },
      { label:'Order', value:b => (b.orders || {}).order_number || '' },
      { label:'Amount', key:'amount' },
      { label:'Status', key:'status' }
    ]));

  view.addEventListener('click', async e => {
    const p = e.target.closest('[data-print]');
    if (p) {
      const id = p.getAttribute('data-print');
      const [orders, settings] = await Promise.all([DB.orders(), DB.settings()]);
      const o = orders.find(x => x.id === id);
      if (!o) return UI.toast('Order not found', 'bad');
      const items = await DB.orderItems(id);
      UI.printHTML(o.order_number, OrdersPage.billHTML(o, items, settings));
      return;
    }
    const v = e.target.closest('[data-view]');
    if (v) OrdersPage.openOrder(v.getAttribute('data-view'));
  });
});
