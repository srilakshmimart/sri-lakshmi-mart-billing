/* ============================================================
   DASHBOARD — summary cards, sales chart, recent activity
   Every figure comes from DB.summary()/DB.series(); none is fixed.
   ============================================================ */
Shell.register('dashboard', async function (view) {
  const { esc, money, num } = UI;
  let range = '7d';

  const bounds = r => ({
    'today': [UI.today(), UI.today()],
    '7d':    [UI.daysAgo(6), UI.today()],
    'month': [UI.iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), UI.today()],
    'year':  [UI.iso(new Date(new Date().getFullYear(), 0, 1)), UI.today()]
  }[r] || [UI.daysAgo(6), UI.today()]);

  view.innerHTML = `
    <div class="cards" id="dashCards">
      ${Array.from({ length:4 }, () => '<div class="card kpi"><span class="skel"></span></div>').join('')}
    </div>
    <div class="cards cards-4" id="dashCards2"></div>

    <section class="card" style="margin-top:16px">
      <header class="card-head">
        <h2>Sales overview</h2>
        <div class="seg" id="dashRange" role="group" aria-label="Date range">
          <button data-r="today">Today</button>
          <button data-r="7d" class="on">7 days</button>
          <button data-r="month">This month</button>
          <button data-r="year">This year</button>
        </div>
      </header>
      <div class="card-body"><div class="chart-box"><canvas id="dashChart"></canvas></div></div>
    </section>

    <div class="split" style="margin-top:16px">
      <section class="card">
        <header class="card-head"><h2>Recent orders</h2>
          <a class="btn btn-ghost btn-sm" href="#/orders">View all</a></header>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>Order</th><th>Customer</th><th class="r">Amount</th><th>Status</th></tr></thead>
          <tbody id="dashOrders">${UI.skeletonRows(4, 5)}</tbody>
        </table></div>
      </section>
      <section class="card">
        <header class="card-head"><h2>Needs attention</h2>
          <a class="btn btn-ghost btn-sm" href="#/inventory">Inventory</a></header>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>Product</th><th class="r">Stock</th><th>Status</th></tr></thead>
          <tbody id="dashStock">${UI.skeletonRows(3, 5)}</tbody>
        </table></div>
      </section>
    </div>`;

  let chart = null;

  async function paint() {
    const [from, to] = bounds(range);
    const [s, orders, inv, pts] = await Promise.all([
      DB.summary(from, to), DB.orders(), DB.inventory(), DB.series(from, to)
    ]);

    UI.$('#dashCards').innerHTML = [
      ['Sales', money(s.sales), 'bi-cash-coin', 'Selected range'],
      ['Orders', num(s.orders), 'bi-receipt', `${num(s.units)} items sold`],
      ['Customers', num(s.customers), 'bi-people', 'All time'],
      ['Low stock', num(s.lowStock), 'bi-exclamation-triangle',
        `${num(s.outOfStock)} out of stock`]
    ].map(([t, v, i, n], k) => `
      <div class="card kpi ${k === 3 && s.lowStock ? 'kpi-warn' : ''}">
        <span class="kpi-ico"><i class="bi ${i}"></i></span>
        <span class="kpi-label">${t}</span>
        <b class="kpi-value">${v}</b>
        <small>${esc(n)}</small>
      </div>`).join('');

    UI.$('#dashCards2').innerHTML = [
      ['Total products', num(s.products)],
      ['Pending orders', num(s.pending)],
      ['Completed', num(s.completed)],
      ['Average order', money(s.avg)]
    ].map(([t, v]) => `
      <div class="card mini"><span>${t}</span><b>${v}</b></div>`).join('');

    const recent = orders.slice(0, 5);
    UI.$('#dashOrders').innerHTML = recent.length ? recent.map(o => `
      <tr class="click" data-go="#/orders/${o.id}">
        <td><b>${esc(o.order_number)}</b><small>${UI.date(o.placed_at)}</small></td>
        <td>${esc(o.customer_name)}</td>
        <td class="r"><b>${money(o.total)}</b></td>
        <td>${UI.chip(o.status)}</td>
      </tr>`).join('')
      : `<tr><td colspan="4">${UI.empty('bi-receipt','No orders yet',
          'Orders placed on the website appear here.')}</td></tr>`;

    const attention = inv.filter(r => r.status !== 'available')
      .sort((a, b) => a.stock - b.stock).slice(0, 5);
    UI.$('#dashStock').innerHTML = attention.length ? attention.map(r => `
      <tr><td>${esc(r.product_name)}</td>
          <td class="r"><b>${num(r.stock)}</b><small>min ${num(r.minimum_stock)}</small></td>
          <td>${UI.chip(r.status)}</td></tr>`).join('')
      : `<tr><td colspan="3">${UI.empty('bi-check-circle','All stocked',
          'No product is below its minimum.')}</td></tr>`;

    await Charts.line('dashChart', pts, c => { chart = c; }, chart);
  }

  UI.$('#dashRange').addEventListener('click', e => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    range = b.getAttribute('data-r');
    UI.$$('#dashRange button').forEach(x => x.classList.toggle('on', x === b));
    paint();
  });

  view.addEventListener('click', e => {
    const row = e.target.closest('[data-go]');
    if (row) location.hash = row.getAttribute('data-go');
  });

  await paint();
});
