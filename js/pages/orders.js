/* ============================================================
   ORDERS — list, filters, detail, status workflow, bill print
   ============================================================ */
(function () {
  const { esc, money, num } = UI;

  function billHTML(order, items, settings) {
    const rows = items.map(i => `
      <tr><td>${esc(i.product_name)}${i.variant_label ? ' · ' + esc(i.variant_label) : ''}</td>
          <td class="r">${num(i.quantity)}</td>
          <td class="r">${money(i.unit_price)}</td>
          <td class="r">${money(i.subtotal)}</td></tr>`).join('');
    return `
      <h1 class="brand">${esc(settings.business_name || 'Sri Lakshmi Mart')}</h1>
      <div class="sub">${esc(settings.address || '')}<br>
        ${settings.phone ? esc(settings.phone) : ''}${settings.fssai ? ' · FSSAI ' + esc(settings.fssai) : ''}</div>
      <table>
        <tr><td><b>Order</b> ${esc(order.order_number)}</td>
            <td class="r"><b>Date</b> ${UI.date(order.placed_at)}</td></tr>
        <tr><td><b>Customer</b> ${esc(order.customer_name)}</td>
            <td class="r"><b>Phone</b> ${esc(order.customer_phone)}</td></tr>
        ${order.delivery_address ? `<tr><td colspan="2"><b>Deliver to</b> ${esc(order.delivery_address)}</td></tr>` : ''}
      </table>
      <table>
        <thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <table>
        <tr><td class="r">Subtotal</td><td class="r" style="width:120px">${money(order.subtotal)}</td></tr>
        ${Number(order.discount) ? `<tr><td class="r">Discount</td><td class="r">− ${money(order.discount)}</td></tr>` : ''}
        ${Number(order.delivery_charge) ? `<tr><td class="r">Delivery</td><td class="r">${money(order.delivery_charge)}</td></tr>` : ''}
        <tr><td class="r tot">Total</td><td class="r tot">${money(order.total)}</td></tr>
        <tr><td class="r">Payment</td><td class="r">${esc(UI.label(order.payment_method))} · ${esc(UI.label(order.payment_status))}</td></tr>
      </table>
      <p class="sub" style="margin-top:22px;text-align:center">Thank you for shopping with us.</p>`;
  }

  async function openOrder(id) {
    const [orders, settings] = await Promise.all([DB.orders(), DB.settings()]);
    const o = orders.find(x => x.id === id);
    if (!o) { UI.toast('Order not found', 'bad'); return; }
    const items = await DB.orderItems(o.id);

    const flow = UI.ORDER_FLOW;
    const stepIdx = flow.indexOf(o.status);

    UI.modal({
      title: `Order ${o.order_number}`, wide: true,
      body: `
        <div class="ord-grid">
          <div>
            <h4>Customer</h4>
            <p><b>${esc(o.customer_name)}</b><br>${esc(o.customer_phone)}
               ${o.delivery_address ? '<br>' + esc(o.delivery_address) : ''}</p>
          </div>
          <div>
            <h4>Order</h4>
            <p>${UI.dateTime(o.placed_at)}<br>
               ${UI.chip(o.status)} ${UI.chip(o.payment_status)}<br>
               <small class="muted">${esc(UI.label(o.payment_method))} · ${esc(UI.label(o.source || 'website'))}</small></p>
          </div>
        </div>

        ${o.status !== 'cancelled' ? `
        <div class="flow" aria-label="Order progress">
          ${flow.map((s, i) => `
            <div class="flow-step ${i <= stepIdx ? 'done' : ''}">
              <span></span><small>${esc(UI.label(s))}</small></div>`).join('')}
        </div>` : ''}

        <div class="table-wrap" style="margin-top:14px">
          <table class="tbl">
            <thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
            <tbody>${items.map(i => `
              <tr><td>${esc(i.product_name)}${i.variant_label ? `<small>${esc(i.variant_label)}</small>` : ''}</td>
                  <td class="r">${num(i.quantity)}</td>
                  <td class="r">${money(i.unit_price)}</td>
                  <td class="r">${money(i.subtotal)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="totals">
          <div><span>Subtotal</span><b>${money(o.subtotal)}</b></div>
          ${Number(o.discount) ? `<div><span>Discount</span><b>− ${money(o.discount)}</b></div>` : ''}
          <div><span>Delivery</span><b>${money(o.delivery_charge)}</b></div>
          <div class="grand"><span>Total</span><b>${money(o.total)}</b></div>
        </div>

        <div class="field" style="margin-top:14px">
          <label for="ordStatus">Update status</label>
          <select id="ordStatus" class="inp">
            ${flow.concat('cancelled').map(s =>
              `<option value="${s}" ${s === o.status ? 'selected' : ''}>${esc(UI.label(s))}</option>`).join('')}
          </select>
        </div>`,
      footer: `
        <button class="btn btn-ghost" id="ordPrint"><i class="bi bi-printer"></i> Print bill</button>
        <a class="btn btn-ghost" id="ordWa" target="_blank" rel="noopener"
           href="${UI.waLink(o.customer_phone,
             `Hello ${o.customer_name}, your Sri Lakshmi Mart order ${o.order_number} — ${UI.label(o.status)}. Total ${UI.money(o.total)}.`)}">
           <i class="bi bi-whatsapp"></i> Contact</a>
        <button class="btn btn-primary" id="ordSave">Save status</button>`
    });

    UI.$('#ordPrint').onclick = () => UI.printHTML(o.order_number, billHTML(o, items, settings));
    UI.$('#ordSave').onclick = async () => {
      const next = UI.$('#ordStatus').value;
      const r = await DB.setOrderStatus(o.id, next);
      if (!r.ok) { UI.toast(r.error || 'Could not update', 'bad'); return; }
      UI.closeModal();
      UI.toast(`${o.order_number} → ${UI.label(next)}` + (r.demo ? ' (demo)' : ''));
      Shell.render();
    };
  }

  Shell.register('orders', async function (view, rest) {
    const state = { q:'', status:'', pay:'', from:'', to:'' };
    let all = [];

    view.innerHTML = `
      <section class="card">
        <header class="card-head">
          <h2>Orders</h2>
          <div class="head-actions">
            <button class="btn btn-ghost btn-sm" id="ordExport">
              <i class="bi bi-download"></i> Export CSV</button>
          </div>
        </header>
        <div class="filters">
          <div class="search">
            <i class="bi bi-search"></i>
            <input id="ordQ" type="search" placeholder="Order number, customer or phone"
                   aria-label="Search orders">
          </div>
          <select id="ordStatusF" class="inp" aria-label="Filter by status">
            <option value="">All statuses</option>
            ${UI.ORDER_FLOW.concat('cancelled').map(s =>
              `<option value="${s}">${UI.label(s)}</option>`).join('')}
          </select>
          <select id="ordPayF" class="inp" aria-label="Filter by payment">
            <option value="">All payments</option>
            <option value="cod">COD</option><option value="upi">UPI</option>
            <option value="online">Online</option><option value="other">Other</option>
          </select>
          <input id="ordFrom" type="date" class="inp" aria-label="From date">
          <input id="ordTo" type="date" class="inp" aria-label="To date">
        </div>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr>
              <th>Order</th><th>Date</th><th>Customer</th><th class="r">Items</th>
              <th class="r">Amount</th><th>Payment</th><th>Status</th><th></th>
            </tr></thead>
            <tbody id="ordBody">${UI.skeletonRows(8, 8)}</tbody>
          </table>
        </div>
        <footer class="card-foot"><span id="ordCount" class="muted"></span></footer>
      </section>`;

    const items = await DB.allItems();
    const countFor = id => items.filter(i => i.order_id === id)
                                .reduce((s, i) => s + Number(i.quantity || 0), 0);

    function filtered() {
      const q = state.q.toLowerCase();
      return all.filter(o => {
        if (state.status && o.status !== state.status) return false;
        if (state.pay && o.payment_method !== state.pay) return false;
        if (state.from && o.placed_at.slice(0,10) < state.from) return false;
        if (state.to && o.placed_at.slice(0,10) > state.to) return false;
        if (!q) return true;
        return (o.order_number + ' ' + o.customer_name + ' ' + o.customer_phone)
          .toLowerCase().includes(q);
      });
    }

    function paint() {
      const rows = filtered();
      UI.$('#ordBody').innerHTML = rows.length ? rows.map(o => `
        <tr class="click" data-id="${o.id}">
          <td><b>${esc(o.order_number)}</b></td>
          <td>${UI.date(o.placed_at)}</td>
          <td>${esc(o.customer_name)}<small>${esc(o.customer_phone)}</small></td>
          <td class="r">${num(countFor(o.id))}</td>
          <td class="r"><b>${money(o.total)}</b></td>
          <td>${esc(UI.label(o.payment_method))}<small>${esc(UI.label(o.payment_status))}</small></td>
          <td>${UI.chip(o.status)}</td>
          <td class="r"><button class="icon-btn" data-open="${o.id}"
              aria-label="Open ${esc(o.order_number)}"><i class="bi bi-eye"></i></button></td>
        </tr>`).join('')
        : `<tr><td colspan="8">${UI.empty('bi-receipt','No orders match',
            'Try clearing the filters, or wait for the next order.')}</td></tr>`;
      UI.$('#ordCount').textContent = `${rows.length} of ${all.length} orders`;
    }

    all = await DB.orders();
    paint();

    UI.$('#ordQ').addEventListener('input', UI.debounce(e => { state.q = e.target.value; paint(); }));
    ['ordStatusF','ordPayF','ordFrom','ordTo'].forEach(id =>
      UI.$('#' + id).addEventListener('change', e => {
        state[{ ordStatusF:'status', ordPayF:'pay', ordFrom:'from', ordTo:'to' }[id]] = e.target.value;
        paint();
      }));

    UI.$('#ordExport').addEventListener('click', () => UI.exportCSV(
      `orders-${UI.today()}.csv`, filtered(), [
        { label:'Order', key:'order_number' },
        { label:'Date', value:o => UI.date(o.placed_at) },
        { label:'Customer', key:'customer_name' },
        { label:'Phone', key:'customer_phone' },
        { label:'Items', value:o => countFor(o.id) },
        { label:'Amount', key:'total' },
        { label:'Payment', key:'payment_method' },
        { label:'Payment status', key:'payment_status' },
        { label:'Status', key:'status' }
      ]));

    view.addEventListener('click', e => {
      const t = e.target.closest('[data-open]') || e.target.closest('[data-id]');
      if (t) openOrder(t.getAttribute('data-open') || t.getAttribute('data-id'));
    });

    if (rest && rest[0]) openOrder(rest[0]);
  });

  window.OrdersPage = { openOrder, billHTML };
})();
