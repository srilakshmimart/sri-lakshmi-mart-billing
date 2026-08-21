/* ============================================================
   REPORTS · ANALYTICS
   Both read the same DB helpers as the dashboard, so figures agree.
   ============================================================ */
(function () {
  const { esc, money, num } = UI;

  function rangeFor(preset) {
    const d = new Date();
    switch (preset) {
      case 'today':   return [UI.today(), UI.today()];
      case 'week':    return [UI.daysAgo(6), UI.today()];
      case 'month':   return [UI.iso(new Date(d.getFullYear(), d.getMonth(), 1)), UI.today()];
      case 'year':    return [UI.iso(new Date(d.getFullYear(), 0, 1)), UI.today()];
      default:        return [UI.daysAgo(29), UI.today()];
    }
  }

  Shell.register('reports', async function (view) {
    let from = UI.daysAgo(29), to = UI.today(), status = '', pay = '', cat = '';
    const cats = await DB.categories();

    view.innerHTML = `
      <section class="card">
        <header class="card-head">
          <h2>Report builder</h2>
          <div class="seg" id="repPreset" role="group" aria-label="Quick range">
            <button data-p="today">Daily</button>
            <button data-p="week">Weekly</button>
            <button data-p="month">Monthly</button>
            <button data-p="year">Yearly</button>
            <button data-p="custom" class="on">Custom</button>
          </div>
        </header>
        <div class="filters">
          <label class="inline"><span>From</span>
            <input id="repFrom" type="date" class="inp" value="${from}"></label>
          <label class="inline"><span>To</span>
            <input id="repTo" type="date" class="inp" value="${to}"></label>
          <select id="repStatus" class="inp" aria-label="Order status">
            <option value="">All statuses</option>
            ${UI.ORDER_FLOW.concat('cancelled').map(s =>
              `<option value="${s}">${UI.label(s)}</option>`).join('')}
          </select>
          <select id="repPay" class="inp" aria-label="Payment method">
            <option value="">All payments</option>
            <option value="cod">COD</option><option value="upi">UPI</option>
            <option value="online">Online</option><option value="other">Other</option>
          </select>
          <select id="repCat" class="inp" aria-label="Category">
            <option value="">All categories</option>
            ${cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" id="repRun">
            <i class="bi bi-play"></i> Generate</button>
        </div>
      </section>

      <div id="repOut"></div>`;

    async function run() {
      const out = UI.$('#repOut');
      out.innerHTML = '<div class="loading"><span class="spin"></span></div>';

      const [orders, items, prods] = await Promise.all([DB.orders(), DB.allItems(), DB.products()]);
      let scoped = DB.inRange(orders, from, to);
      if (status) scoped = scoped.filter(o => o.status === status);
      else scoped = scoped.filter(o => o.status !== 'cancelled');
      if (pay) scoped = scoped.filter(o => o.payment_method === pay);

      const ids = new Set(scoped.map(o => o.id));
      let lines = items.filter(i => ids.has(i.order_id));
      if (cat) {
        const inCat = new Set(prods.filter(p => p.category_id === cat).map(p => p.id));
        lines = lines.filter(i => inCat.has(i.product_id));
      }

      const sales = cat
        ? lines.reduce((s, i) => s + Number(i.subtotal || 0), 0)
        : scoped.reduce((s, o) => s + Number(o.total || 0), 0);
      const units = lines.reduce((s, i) => s + Number(i.quantity || 0), 0);

      const byProduct = {};
      lines.forEach(i => {
        const k = i.product_id || i.product_name;
        (byProduct[k] = byProduct[k] || { name:i.product_name, units:0, revenue:0, id:i.product_id });
        byProduct[k].units += Number(i.quantity || 0);
        byProduct[k].revenue += Number(i.subtotal || 0);
      });
      const products = Object.values(byProduct).sort((a, b) => b.revenue - a.revenue);

      const catName = id => (cats.find(c => c.id === id) || {}).name || 'Uncategorised';
      const catOf = pid => (prods.find(p => p.id === pid) || {}).category_id;
      const byCat = {};
      products.forEach(p => {
        const k = catName(catOf(p.id));
        (byCat[k] = byCat[k] || { name:k, units:0, revenue:0 });
        byCat[k].units += p.units; byCat[k].revenue += p.revenue;
      });
      const categories = Object.values(byCat).sort((a, b) => b.revenue - a.revenue);

      out.innerHTML = `
        <div class="cards cards-4" style="margin-top:16px">
          ${[['Total sales', money(sales)], ['Orders', num(scoped.length)],
             ['Items sold', num(units)],
             ['Average order', money(scoped.length ? sales / scoped.length : 0)]]
            .map(([t, v]) => `<div class="card mini"><span>${t}</span><b>${v}</b></div>`).join('')}
        </div>

        <section class="card" style="margin-top:16px">
          <header class="card-head">
            <h2>${esc(UI.date(from))} — ${esc(UI.date(to))}</h2>
            <div class="head-actions">
              <button class="btn btn-ghost btn-sm" id="repCsv"><i class="bi bi-download"></i> CSV</button>
              <button class="btn btn-ghost btn-sm" id="repPrint"><i class="bi bi-printer"></i> Print</button>
            </div>
          </header>
          <div class="split">
            <div class="table-wrap">
              <table class="tbl">
                <thead><tr><th>Product</th><th class="r">Units</th><th class="r">Revenue</th></tr></thead>
                <tbody>${products.length ? products.slice(0, 25).map(p => `
                  <tr><td>${esc(p.name)}</td><td class="r">${num(p.units)}</td>
                      <td class="r"><b>${money(p.revenue)}</b></td></tr>`).join('')
                  : `<tr><td colspan="3">${UI.empty('bi-clipboard-data','No sales in this range',
                      'Adjust the dates or filters.')}</td></tr>`}
                </tbody>
              </table>
            </div>
            <div class="table-wrap">
              <table class="tbl">
                <thead><tr><th>Category</th><th class="r">Units</th><th class="r">Revenue</th></tr></thead>
                <tbody>${categories.map(c => `
                  <tr><td>${esc(c.name)}</td><td class="r">${num(c.units)}</td>
                      <td class="r"><b>${money(c.revenue)}</b></td></tr>`).join('')
                  || `<tr><td colspan="3" class="muted" style="padding:18px">—</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        </section>`;

      UI.$('#repCsv').onclick = () => UI.exportCSV(
        `report-${from}_to_${to}.csv`, products, [
          { label:'Product', key:'name' }, { label:'Units', key:'units' },
          { label:'Revenue', key:'revenue' }
        ]);
      UI.$('#repPrint').onclick = () => UI.printHTML('Sales report', `
        <h1 class="brand">Sri Lakshmi Mart</h1>
        <div class="sub">Sales report · ${UI.date(from)} — ${UI.date(to)}</div>
        <table><tr><td>Total sales</td><td class="r tot">${money(sales)}</td></tr>
          <tr><td>Orders</td><td class="r">${num(scoped.length)}</td></tr>
          <tr><td>Items sold</td><td class="r">${num(units)}</td></tr></table>
        <table><thead><tr><th>Product</th><th class="r">Units</th><th class="r">Revenue</th></tr></thead>
          <tbody>${products.map(p => `<tr><td>${esc(p.name)}</td>
            <td class="r">${num(p.units)}</td><td class="r">${money(p.revenue)}</td></tr>`).join('')}
          </tbody></table>`);
    }

    UI.$('#repPreset').addEventListener('click', e => {
      const b = e.target.closest('[data-p]'); if (!b) return;
      UI.$$('#repPreset button').forEach(x => x.classList.toggle('on', x === b));
      const p = b.getAttribute('data-p');
      if (p !== 'custom') {
        [from, to] = rangeFor(p);
        UI.$('#repFrom').value = from; UI.$('#repTo').value = to;
        run();
      }
    });
    UI.$('#repFrom').addEventListener('change', e => { from = e.target.value; });
    UI.$('#repTo').addEventListener('change', e => { to = e.target.value; });
    UI.$('#repStatus').addEventListener('change', e => { status = e.target.value; });
    UI.$('#repPay').addEventListener('change', e => { pay = e.target.value; });
    UI.$('#repCat').addEventListener('change', e => { cat = e.target.value; });
    UI.$('#repRun').addEventListener('click', run);

    run();
  });

  Shell.register('analytics', async function (view) {
    let preset = 'month';

    view.innerHTML = `
      <section class="card">
        <header class="card-head">
          <h2>Sales &amp; orders</h2>
          <div class="seg" id="anRange" role="group" aria-label="Range">
            <button data-p="week">7 days</button>
            <button data-p="month" class="on">This month</button>
            <button data-p="year">This year</button>
          </div>
        </header>
        <div class="card-body"><div class="chart-box"><canvas id="anTrend"></canvas></div></div>
      </section>

      <div class="split" style="margin-top:16px">
        <section class="card">
          <header class="card-head"><h2>Top products</h2></header>
          <div class="card-body"><div class="chart-box sm"><canvas id="anTop"></canvas></div></div>
        </section>
        <section class="card">
          <header class="card-head"><h2>Revenue by category</h2></header>
          <div class="card-body"><div class="chart-box sm"><canvas id="anCat"></canvas></div></div>
        </section>
      </div>

      <section class="card" style="margin-top:16px">
        <header class="card-head"><h2>Top selling products</h2></header>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>#</th><th>Product</th><th class="r">Units sold</th>
              <th class="r">Revenue</th></tr></thead>
            <tbody id="anTable">${UI.skeletonRows(4, 6)}</tbody>
          </table>
        </div>
      </section>`;

    let trend = null;

    async function paint() {
      const [from, to] = rangeFor(preset);
      const [pts, tops, cats] = await Promise.all([
        DB.series(from, to), DB.topProducts(from, to, 8), DB.topCategories(from, to)
      ]);

      trend = await Charts.line('anTrend', pts, c => { trend = c; }, trend);
      if (tops.length) {
        await Charts.bar('anTop', tops.slice(0, 6).map(t =>
          t.name.length > 18 ? t.name.slice(0, 17) + '…' : t.name),
          tops.slice(0, 6).map(t => t.revenue));
      }
      if (cats.length) {
        await Charts.doughnut('anCat', cats.map(c => c.name), cats.map(c => c.revenue));
      }

      UI.$('#anTable').innerHTML = tops.length ? tops.map((t, i) => `
        <tr><td class="muted">${i + 1}</td>
            <td><b>${esc(t.name)}</b></td>
            <td class="r">${num(t.units)}</td>
            <td class="r"><b>${money(t.revenue)}</b></td></tr>`).join('')
        : `<tr><td colspan="4">${UI.empty('bi-graph-up','No sales yet',
            'Charts fill in as orders arrive.')}</td></tr>`;
    }

    UI.$('#anRange').addEventListener('click', e => {
      const b = e.target.closest('[data-p]'); if (!b) return;
      UI.$$('#anRange button').forEach(x => x.classList.toggle('on', x === b));
      preset = b.getAttribute('data-p'); paint();
    });

    await paint();
  });
})();
