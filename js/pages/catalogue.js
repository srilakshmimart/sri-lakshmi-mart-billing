/* ============================================================
   PRODUCTS · INVENTORY · CATEGORIES
   ============================================================ */
(function () {
  const { esc, money, num } = UI;

  /* ---------------- products ---------------- */
  Shell.register('products', async function (view) {
    let all = [], cats = [], inv = [], q = '', cat = '';

    view.innerHTML = `
      <section class="card">
        <header class="card-head">
          <h2>Products</h2>
          <div class="head-actions">
            <button class="btn btn-ghost btn-sm" id="prExport">
              <i class="bi bi-download"></i> Export</button>
            <button class="btn btn-primary btn-sm" id="prAdd">
              <i class="bi bi-plus-lg"></i> Add product</button>
          </div>
        </header>
        <div class="filters">
          <div class="search"><i class="bi bi-search"></i>
            <input id="prQ" type="search" placeholder="Product name or SKU"
                   aria-label="Search products"></div>
          <select id="prCat" class="inp" aria-label="Filter by category">
            <option value="">All categories</option>
          </select>
        </div>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th></th><th>Product</th><th>Category</th><th class="r">Price</th>
              <th class="r">Offer</th><th class="r">Stock</th><th>Status</th><th></th></tr></thead>
            <tbody id="prBody">${UI.skeletonRows(8, 8)}</tbody>
          </table>
        </div>
        <footer class="card-foot"><span id="prCount" class="muted"></span></footer>
      </section>`;

    const catName = id => (cats.find(c => c.id === id) || {}).name || '—';
    const stockOf = id => {
      const r = inv.find(x => x.product_id === id);
      return r ? r.stock : null;
    };

    const filtered = () => all.filter(p => {
      if (cat && p.category_id !== cat) return false;
      if (!q) return true;
      return ((p.name || '') + ' ' + (p.sku || '')).toLowerCase().includes(q.toLowerCase());
    });

    function paint() {
      const rows = filtered();
      UI.$('#prBody').innerHTML = rows.length ? rows.map(p => {
        const s = stockOf(p.id);
        return `<tr>
          <td class="thumb">${p.image_url
            ? `<img src="${esc(p.image_url)}" alt="" loading="lazy">`
            : `<span class="thumb-fallback"><i class="bi bi-box"></i></span>`}</td>
          <td><b>${esc(p.name)}</b><small>${esc(p.sku || '')}</small></td>
          <td>${esc(catName(p.category_id))}</td>
          <td class="r">${money(p.price)}</td>
          <td class="r">${p.offer_price ? money(p.offer_price) : '—'}</td>
          <td class="r">${s === null ? '—' : num(s)}</td>
          <td>${UI.chip(p.is_active ? 'active' : 'disabled')}</td>
          <td class="r nowrap">
            <button class="icon-btn" data-edit="${p.id}" aria-label="Edit"><i class="bi bi-pencil"></i></button>
            <button class="icon-btn" data-del="${p.id}" aria-label="Delete"><i class="bi bi-trash"></i></button>
          </td></tr>`;
      }).join('')
        : `<tr><td colspan="8">${UI.empty('bi-box-seam','No products match',
            'Try a different search, or add a product.')}</td></tr>`;
      UI.$('#prCount').textContent = `${rows.length} of ${all.length} products`;
    }

    function form(p) {
      p = p || {};
      UI.modal({
        title: p.id ? 'Edit product' : 'Add product', wide:true,
        body: `
          <div class="grid-2">
            <div class="field"><label for="f-name">Name <span class="req">*</span></label>
              <input id="f-name" class="inp" value="${esc(p.name || '')}"></div>
            <div class="field"><label for="f-sku">SKU</label>
              <input id="f-sku" class="inp" value="${esc(p.sku || '')}"></div>
          </div>
          <div class="grid-2">
            <div class="field"><label for="f-cat">Category</label>
              <select id="f-cat" class="inp">
                <option value="">Uncategorised</option>
                ${cats.map(c => `<option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>
                  ${esc(c.name)}</option>`).join('')}
              </select></div>
            <div class="field"><label for="f-barcode">Barcode</label>
              <input id="f-barcode" class="inp" value="${esc(p.barcode || '')}"></div>
          </div>
          <div class="grid-2">
            <div class="field"><label for="f-price">Price <span class="req">*</span></label>
              <input id="f-price" class="inp" type="number" step="0.01" min="0"
                     value="${p.price ?? ''}"></div>
            <div class="field"><label for="f-offer">Offer price</label>
              <input id="f-offer" class="inp" type="number" step="0.01" min="0"
                     value="${p.offer_price ?? ''}"></div>
          </div>
          <div class="field"><label for="f-img">Image URL</label>
            <input id="f-img" class="inp" value="${esc(p.image_url || '')}"></div>
          <div class="field"><label for="f-desc">Description</label>
            <textarea id="f-desc" class="inp" rows="3">${esc(p.description || '')}</textarea></div>
          <label class="check"><input type="checkbox" id="f-active"
            ${p.is_active === false ? '' : 'checked'}> Visible on the website</label>`,
        footer: `<button class="btn btn-ghost" data-close>Cancel</button>
                 <button class="btn btn-primary" id="f-save">Save product</button>`
      });

      UI.$('#f-save').onclick = async () => {
        const name = UI.$('#f-name').value.trim();
        const price = parseFloat(UI.$('#f-price').value);
        if (!name) return UI.toast('Enter a product name', 'bad');
        if (!(price >= 0)) return UI.toast('Enter a valid price', 'bad');
        const payload = {
          ...(p.id ? { id:p.id } : {}),
          name, sku:UI.$('#f-sku').value.trim() || null,
          barcode:UI.$('#f-barcode').value.trim() || null,
          category_id:UI.$('#f-cat').value || null,
          price, offer_price:UI.$('#f-offer').value ? parseFloat(UI.$('#f-offer').value) : null,
          image_url:UI.$('#f-img').value.trim() || null,
          description:UI.$('#f-desc').value.trim() || null,
          is_active:UI.$('#f-active').checked
        };
        const r = await DB.saveProduct(payload);
        if (!r.ok) return UI.toast(r.error || 'Could not save', 'bad');
        UI.closeModal();
        UI.toast('Product saved' + (r.demo ? ' (demo)' : ''));
        all = await DB.products(); paint();
      };
    }

    [all, cats, inv] = await Promise.all([DB.products(), DB.categories(), DB.inventory()]);
    UI.$('#prCat').innerHTML += cats.map(c =>
      `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    paint();

    UI.$('#prQ').addEventListener('input', UI.debounce(e => { q = e.target.value; paint(); }));
    UI.$('#prCat').addEventListener('change', e => { cat = e.target.value; paint(); });
    UI.$('#prAdd').addEventListener('click', () => form(null));
    UI.$('#prExport').addEventListener('click', () => UI.exportCSV(
      `products-${UI.today()}.csv`, filtered(), [
        { label:'SKU', key:'sku' }, { label:'Name', key:'name' },
        { label:'Category', value:p => catName(p.category_id) },
        { label:'Price', key:'price' }, { label:'Offer price', key:'offer_price' },
        { label:'Stock', value:p => stockOf(p.id) },
        { label:'Active', key:'is_active' }
      ]));

    view.addEventListener('click', async e => {
      const ed = e.target.closest('[data-edit]');
      if (ed) return form(all.find(p => p.id === ed.getAttribute('data-edit')));
      const del = e.target.closest('[data-del]');
      if (del) {
        const p = all.find(x => x.id === del.getAttribute('data-del'));
        if (!await UI.confirmBox('Delete product?',
          `“${esc(p.name)}” will be removed. Past orders keep their own copy of the name and price.`,
          'Delete')) return;
        const r = await DB.deleteProduct(p.id);
        if (!r.ok) return UI.toast(r.error || 'Could not delete', 'bad');
        UI.toast('Product deleted' + (r.demo ? ' (demo)' : ''));
        all = await DB.products(); paint();
      }
    });
  });

  /* ---------------- inventory ---------------- */
  Shell.register('inventory', async function (view) {
    let rows = [], filter = '', q = '';

    view.innerHTML = `
      <div class="cards cards-4" id="invCards"></div>
      <section class="card" style="margin-top:16px">
        <header class="card-head">
          <h2>Stock</h2>
          <button class="btn btn-ghost btn-sm" id="invExport">
            <i class="bi bi-download"></i> Export</button>
        </header>
        <div class="filters">
          <div class="search"><i class="bi bi-search"></i>
            <input id="invQ" type="search" placeholder="Product name" aria-label="Search stock"></div>
          <div class="seg" id="invFilter" role="group" aria-label="Filter by status">
            <button data-f="" class="on">All</button>
            <button data-f="available">Available</button>
            <button data-f="low_stock">Low</button>
            <button data-f="out_of_stock">Out</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>Product</th><th class="r">Stock</th><th class="r">Minimum</th>
              <th>Status</th><th>Updated</th><th></th></tr></thead>
            <tbody id="invBody">${UI.skeletonRows(6, 8)}</tbody>
          </table>
        </div>
      </section>`;

    const filtered = () => rows.filter(r =>
      (!filter || r.status === filter) &&
      (!q || (r.product_name || '').toLowerCase().includes(q.toLowerCase())));

    function paintCards() {
      const total = rows.length;
      const ok = rows.filter(r => r.status === 'available').length;
      const low = rows.filter(r => r.status === 'low_stock').length;
      const out = rows.filter(r => r.status === 'out_of_stock').length;
      UI.$('#invCards').innerHTML = [
        ['Total products', total, ''], ['In stock', ok, 'ok'],
        ['Low stock', low, low ? 'warn' : ''], ['Out of stock', out, out ? 'bad' : '']
      ].map(([t, v, tone]) => `
        <div class="card mini ${tone ? 'mini-' + tone : ''}"><span>${t}</span><b>${num(v)}</b></div>`
      ).join('');
    }

    function paint() {
      const list = filtered();
      UI.$('#invBody').innerHTML = list.length ? list.map(r => `
        <tr>
          <td><b>${esc(r.product_name)}</b>${r.variant_label ? `<small>${esc(r.variant_label)}</small>` : ''}</td>
          <td class="r"><b>${num(r.stock)}</b></td>
          <td class="r">${num(r.minimum_stock)}</td>
          <td>${UI.chip(r.status)}</td>
          <td>${UI.date(r.updated_at)}</td>
          <td class="r nowrap">
            <button class="icon-btn" data-in="${r.product_id}" aria-label="Stock in">
              <i class="bi bi-plus-circle"></i></button>
            <button class="icon-btn" data-out="${r.product_id}" aria-label="Stock out">
              <i class="bi bi-dash-circle"></i></button>
            <button class="icon-btn" data-hist="${r.product_id}" aria-label="History">
              <i class="bi bi-clock-history"></i></button>
          </td></tr>`).join('')
        : `<tr><td colspan="6">${UI.empty('bi-boxes','Nothing here',
            'No product matches this filter.')}</td></tr>`;
      paintCards();
    }

    function moveForm(productId, direction) {
      const r = rows.find(x => x.product_id === productId);
      UI.modal({
        title: direction > 0 ? 'Stock in' : 'Stock out',
        body: `
          <p class="muted">${esc(r ? r.product_name : '')} — currently
             <b>${num(r ? r.stock : 0)}</b> in stock.</p>
          <div class="field"><label for="mv-qty">Quantity <span class="req">*</span></label>
            <input id="mv-qty" class="inp" type="number" min="1" value="1"></div>
          <div class="field"><label for="mv-note">Note</label>
            <input id="mv-note" class="inp" placeholder="Supplier, damage, correction…"></div>`,
        footer: `<button class="btn btn-ghost" data-close>Cancel</button>
                 <button class="btn btn-primary" id="mv-save">Save movement</button>`
      });
      UI.$('#mv-save').onclick = async () => {
        const qty = parseInt(UI.$('#mv-qty').value, 10);
        if (!(qty > 0)) return UI.toast('Enter a quantity above zero', 'bad');
        const res = await DB.stockMove(productId, direction * qty,
          direction > 0 ? 'stock_in' : 'stock_out', UI.$('#mv-note').value.trim());
        if (!res.ok) return UI.toast(res.error || 'Could not save', 'bad');
        UI.closeModal();
        UI.toast(`${direction > 0 ? '+' : '−'}${qty} recorded` + (res.demo ? ' (demo)' : ''));
        rows = await DB.inventory(); paint();
        Shell.renderNotifications();
      };
    }

    async function history(productId) {
      const r = rows.find(x => x.product_id === productId);
      const list = await DB.stockHistory(productId);
      UI.modal({
        title: `Stock history — ${r ? r.product_name : ''}`,
        body: list.length ? `
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Date</th><th>Type</th><th class="r">Change</th>
              <th class="r">Balance</th><th>Note</th></tr></thead>
            <tbody>${list.map(t => `
              <tr><td>${UI.dateTime(t.created_at)}</td>
                  <td>${esc(UI.label(t.kind))}</td>
                  <td class="r ${t.quantity > 0 ? 'pos' : 'neg'}">
                    ${t.quantity > 0 ? '+' : ''}${num(t.quantity)}</td>
                  <td class="r">${t.balance_after ?? '—'}</td>
                  <td>${esc(t.note || '')}</td></tr>`).join('')}
            </tbody></table></div>`
          : UI.empty('bi-clock-history', 'No movements yet',
              'Stock in and stock out are recorded here.'),
        footer: `<button class="btn btn-primary" data-close>Close</button>`
      });
    }

    rows = await DB.inventory();
    paint();

    UI.$('#invQ').addEventListener('input', UI.debounce(e => { q = e.target.value; paint(); }));
    UI.$('#invFilter').addEventListener('click', e => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      UI.$$('#invFilter button').forEach(x => x.classList.toggle('on', x === b));
      filter = b.getAttribute('data-f'); paint();
    });
    UI.$('#invExport').addEventListener('click', () => UI.exportCSV(
      `inventory-${UI.today()}.csv`, filtered(), [
        { label:'Product', key:'product_name' }, { label:'Stock', key:'stock' },
        { label:'Minimum', key:'minimum_stock' }, { label:'Status', key:'status' }
      ]));

    view.addEventListener('click', e => {
      const i = e.target.closest('[data-in]');   if (i) return moveForm(i.getAttribute('data-in'), 1);
      const o = e.target.closest('[data-out]');  if (o) return moveForm(o.getAttribute('data-out'), -1);
      const h = e.target.closest('[data-hist]'); if (h) return history(h.getAttribute('data-hist'));
    });
  });

  /* ---------------- categories ---------------- */
  Shell.register('categories', async function (view) {
    let cats = [], prods = [];

    const load = async () => {
      [cats, prods] = await Promise.all([DB.categories(), DB.products()]);
      paint();
    };

    const count = id => prods.filter(p => p.category_id === id).length;

    function paint() {
      view.innerHTML = `
        <section class="card">
          <header class="card-head">
            <h2>Categories</h2>
            <div class="head-actions">
              <button class="btn btn-primary btn-sm" id="catAdd">
                <i class="bi bi-plus-lg"></i> Add category
              </button>
            </div>
          </header>
          <div class="table-wrap">
            <table class="tbl">
              <thead><tr><th>Category</th><th>Description</th><th class="r">Products</th>
                <th>Status</th></tr></thead>
              <tbody>${cats.length ? cats.map(c => `
                <tr><td><b>${esc(c.name)}</b></td>
                    <td>${esc(c.description || '—')}</td>
                    <td class="r">${num(count(c.id))}</td>
                    <td>${UI.chip(c.is_active === false ? 'disabled' : 'active')}</td></tr>`).join('')
                : `<tr><td colspan="4">${UI.empty('bi-tags','No categories',
                    'Click “Add category” to create your first category.')}</td></tr>`}
              </tbody>
            </table>
          </div>
          <footer class="card-foot">
            <span class="muted">Categories are shared with the customer website.
              Adding them here makes them available when creating products.</span>
          </footer>
        </section>`;

      UI.$('#catAdd').onclick = addCategory;
    }

    async function addCategory() {
      UI.modal({
        title: 'Add category',
        body: `
          <div class="field">
            <label for="cat-name">Category name <span class="req">*</span></label>
            <input id="cat-name" class="inp" placeholder="e.g. Health Mix">
          </div>
          <div class="field">
            <label for="cat-description">Description</label>
            <textarea id="cat-description" class="inp" rows="3"
              placeholder="Short category description"></textarea>
          </div>
          <div class="field">
            <label for="cat-image">Image URL</label>
            <input id="cat-image" class="inp" placeholder="https://...">
          </div>
          <label class="check">
            <input type="checkbox" id="cat-active" checked>
            Active
          </label>`,
        footer: `<button class="btn btn-ghost" data-close>Cancel</button>
                 <button class="btn btn-primary" id="cat-save">Save category</button>`
      });

      UI.$('#cat-save').onclick = async () => {
        const name = UI.$('#cat-name').value.trim();
        const description = UI.$('#cat-description').value.trim() || null;
        const image_url = UI.$('#cat-image').value.trim() || null;

        if (!name) return UI.toast('Enter a category name', 'bad');

        const payload = {
          name,
          description,
          image_url,
          is_active: UI.$('#cat-active').checked
        };

        const [data, error] = await SB.run(c =>
          c.from('categories').insert(payload).select().single()
        );

        if (error) {
          return UI.toast(error.message || 'Could not save category', 'bad');
        }

        UI.closeModal();
        UI.toast('Category added');
        await load();
      };
    }

    await load();
  });
})();
