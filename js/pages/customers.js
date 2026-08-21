/* ============================================================
   CUSTOMERS — list with computed totals, profile with history
   ============================================================ */
Shell.register('customers', async function (view) {
  const { esc, money, num } = UI;
  let all = [];
  let q = '';

  view.innerHTML = `
    <section class="card">
      <header class="card-head">
        <h2>Customers</h2>
        <button class="btn btn-ghost btn-sm" id="cusExport">
          <i class="bi bi-download"></i> Export CSV</button>
      </header>
      <div class="filters">
        <div class="search">
          <i class="bi bi-search"></i>
          <input id="cusQ" type="search" placeholder="Name, phone or city"
                 aria-label="Search customers">
        </div>
      </div>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>Customer</th><th>Phone</th><th>City</th>
            <th class="r">Orders</th><th class="r">Total spent</th>
            <th>Last order</th><th></th></tr></thead>
          <tbody id="cusBody">${UI.skeletonRows(7, 7)}</tbody>
        </table>
      </div>
      <footer class="card-foot"><span id="cusCount" class="muted"></span></footer>
    </section>`;

  const filtered = () => {
    const s = q.toLowerCase();
    return all.filter(c => !s ||
      (c.full_name + ' ' + c.phone + ' ' + (c.city || '')).toLowerCase().includes(s));
  };

  function paint() {
    const rows = filtered();
    UI.$('#cusBody').innerHTML = rows.length ? rows.map(c => `
      <tr class="click" data-id="${c.id}">
        <td><b>${esc(c.full_name)}</b></td>
        <td>${esc(c.phone)}</td>
        <td>${esc(c.city || '—')}</td>
        <td class="r">${num(c.total_orders)}</td>
        <td class="r"><b>${money(c.total_spent)}</b></td>
        <td>${c.last_order ? UI.date(c.last_order) : '—'}</td>
        <td class="r"><button class="icon-btn" data-open="${c.id}"
            aria-label="Open ${esc(c.full_name)}"><i class="bi bi-person"></i></button></td>
      </tr>`).join('')
      : `<tr><td colspan="7">${UI.empty('bi-people','No customers yet',
          'Customers appear here after their first order.')}</td></tr>`;
    UI.$('#cusCount').textContent = `${rows.length} of ${all.length} customers`;
  }

  async function openCustomer(id) {
    const c = all.find(x => x.id === id);
    if (!c) return;
    const orders = (await DB.orders()).filter(o => o.customer_id === id);
    UI.modal({
      title: c.full_name, wide:true,
      body: `
        <div class="ord-grid">
          <div><h4>Contact</h4>
            <p>${esc(c.phone)}${c.email ? '<br>' + esc(c.email) : ''}
               ${c.address ? '<br>' + esc(c.address) : ''}
               ${c.city ? '<br>' + esc(c.city) + (c.state ? ', ' + esc(c.state) : '') : ''}</p>
          </div>
          <div><h4>Summary</h4>
            <p><b>${num(c.total_orders)}</b> orders<br>
               <b>${money(c.total_spent)}</b> lifetime<br>
               <small class="muted">Last order ${c.last_order ? UI.date(c.last_order) : '—'}</small></p>
          </div>
        </div>
        <div class="table-wrap" style="margin-top:14px">
          <table class="tbl">
            <thead><tr><th>Order</th><th>Date</th><th class="r">Amount</th><th>Status</th></tr></thead>
            <tbody>${orders.length ? orders.map(o => `
              <tr><td>${esc(o.order_number)}</td><td>${UI.date(o.placed_at)}</td>
                  <td class="r">${money(o.total)}</td><td>${UI.chip(o.status)}</td></tr>`).join('')
              : `<tr><td colspan="4" class="muted" style="padding:18px">No orders on record.</td></tr>`}
            </tbody>
          </table>
        </div>`,
      footer: `<a class="btn btn-ghost" target="_blank" rel="noopener"
                 href="${UI.waLink(c.phone, `Hello ${c.full_name}, this is Sri Lakshmi Mart.`)}">
                 <i class="bi bi-whatsapp"></i> Message</a>
               <button class="btn btn-primary" data-close>Close</button>`
    });
  }

  all = await DB.customerStats();
  all.sort((a, b) => b.total_spent - a.total_spent);
  paint();

  UI.$('#cusQ').addEventListener('input', UI.debounce(e => { q = e.target.value; paint(); }));
  UI.$('#cusExport').addEventListener('click', () => UI.exportCSV(
    `customers-${UI.today()}.csv`, filtered(), [
      { label:'Name', key:'full_name' }, { label:'Phone', key:'phone' },
      { label:'City', key:'city' }, { label:'Orders', key:'total_orders' },
      { label:'Total spent', key:'total_spent' },
      { label:'Last order', value:c => c.last_order ? UI.date(c.last_order) : '' }
    ]));

  view.addEventListener('click', e => {
    const t = e.target.closest('[data-open]') || e.target.closest('[data-id]');
    if (t) openCustomer(t.getAttribute('data-open') || t.getAttribute('data-id'));
  });
});
