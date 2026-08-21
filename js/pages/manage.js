/* ============================================================
   OFFERS · REVIEWS · AI KNOWLEDGE · SETTINGS
   ============================================================ */
(function () {
  const { esc, money, num } = UI;

  /* ---------------- offers ---------------- */
  Shell.register('offers', async function (view) {
    let all = [], prods = [], cats = [];

    view.innerHTML = `
      <section class="card">
        <header class="card-head">
          <h2>Offers</h2>
          <button class="btn btn-primary btn-sm" id="ofAdd">
            <i class="bi bi-plus-lg"></i> Add offer</button>
        </header>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>Offer</th><th>Applies to</th><th>Discount</th>
              <th>Runs</th><th>Status</th><th></th></tr></thead>
            <tbody id="ofBody">${UI.skeletonRows(6, 5)}</tbody>
          </table>
        </div>
        <footer class="card-foot">
          <span class="muted">An offer stops applying after its end date on its own —
            no switch to remember.</span>
        </footer>
      </section>`;

    const target = o => o.product_id
      ? (prods.find(p => p.id === o.product_id) || {}).name || 'Product'
      : o.category_id
        ? (cats.find(c => c.id === o.category_id) || {}).name || 'Category'
        : 'All products';

    function paint() {
      UI.$('#ofBody').innerHTML = all.length ? all.map(o => `
        <tr>
          <td><b>${esc(o.name)}</b></td>
          <td>${esc(target(o))}</td>
          <td>${o.discount_type === 'percentage'
                ? esc(o.discount_value) + '%' : money(o.discount_value)}</td>
          <td>${UI.date(o.starts_on)} — ${UI.date(o.ends_on)}</td>
          <td>${UI.chip(o.computed_status)}</td>
          <td class="r nowrap">
            <button class="icon-btn" data-edit="${o.id}" aria-label="Edit"><i class="bi bi-pencil"></i></button>
            <button class="icon-btn" data-del="${o.id}" aria-label="Delete"><i class="bi bi-trash"></i></button>
          </td></tr>`).join('')
        : `<tr><td colspan="6">${UI.empty('bi-percent','No offers yet',
            'Create one to show a discount on the website.')}</td></tr>`;
    }

    function form(o) {
      o = o || {};
      UI.modal({
        title: o.id ? 'Edit offer' : 'Add offer',
        body: `
          <div class="field"><label for="o-name">Offer name <span class="req">*</span></label>
            <input id="o-name" class="inp" value="${esc(o.name || '')}"></div>
          <div class="grid-2">
            <div class="field"><label for="o-prod">Product</label>
              <select id="o-prod" class="inp"><option value="">— any —</option>
                ${prods.map(p => `<option value="${p.id}" ${p.id === o.product_id ? 'selected' : ''}>
                  ${esc(p.name)}</option>`).join('')}</select></div>
            <div class="field"><label for="o-cat">or Category</label>
              <select id="o-cat" class="inp"><option value="">— any —</option>
                ${cats.map(c => `<option value="${c.id}" ${c.id === o.category_id ? 'selected' : ''}>
                  ${esc(c.name)}</option>`).join('')}</select></div>
          </div>
          <div class="grid-2">
            <div class="field"><label for="o-type">Discount type</label>
              <select id="o-type" class="inp">
                <option value="percentage" ${o.discount_type === 'percentage' ? 'selected' : ''}>Percentage</option>
                <option value="fixed" ${o.discount_type === 'fixed' ? 'selected' : ''}>Fixed amount</option>
              </select></div>
            <div class="field"><label for="o-val">Value <span class="req">*</span></label>
              <input id="o-val" class="inp" type="number" min="0" step="0.01"
                     value="${o.discount_value ?? ''}"></div>
          </div>
          <div class="grid-2">
            <div class="field"><label for="o-from">Starts <span class="req">*</span></label>
              <input id="o-from" class="inp" type="date" value="${o.starts_on || UI.today()}"></div>
            <div class="field"><label for="o-to">Ends <span class="req">*</span></label>
              <input id="o-to" class="inp" type="date" value="${o.ends_on || UI.today()}"></div>
          </div>
          <label class="check"><input type="checkbox" id="o-active"
            ${o.is_active === false ? '' : 'checked'}> Enabled</label>`,
        footer: `<button class="btn btn-ghost" data-close>Cancel</button>
                 <button class="btn btn-primary" id="o-save">Save offer</button>`
      });
      UI.$('#o-save').onclick = async () => {
        const name = UI.$('#o-name').value.trim();
        const val = parseFloat(UI.$('#o-val').value);
        const from = UI.$('#o-from').value, to = UI.$('#o-to').value;
        if (!name) return UI.toast('Enter an offer name', 'bad');
        if (!(val > 0)) return UI.toast('Enter a discount above zero', 'bad');
        if (!from || !to) return UI.toast('Choose both dates', 'bad');
        if (to < from) return UI.toast('The end date is before the start date', 'bad');
        const r = await DB.saveOffer({
          ...(o.id ? { id:o.id } : {}), name,
          product_id:UI.$('#o-prod').value || null,
          category_id:UI.$('#o-cat').value || null,
          discount_type:UI.$('#o-type').value,
          discount_value:val, starts_on:from, ends_on:to,
          is_active:UI.$('#o-active').checked
        });
        if (!r.ok) return UI.toast(r.error || 'Could not save', 'bad');
        UI.closeModal(); UI.toast('Offer saved' + (r.demo ? ' (demo)' : ''));
        all = await DB.offers(); paint();
      };
    }

    [all, prods, cats] = await Promise.all([DB.offers(), DB.products(), DB.categories()]);
    paint();
    UI.$('#ofAdd').addEventListener('click', () => form(null));
    view.addEventListener('click', async e => {
      const ed = e.target.closest('[data-edit]');
      if (ed) return form(all.find(o => o.id === ed.getAttribute('data-edit')));
      const del = e.target.closest('[data-del]');
      if (del) {
        if (!await UI.confirmBox('Delete offer?', 'This cannot be undone.', 'Delete')) return;
        const r = await DB.deleteOffer(del.getAttribute('data-del'));
        if (!r.ok) return UI.toast(r.error || 'Could not delete', 'bad');
        UI.toast('Offer deleted' + (r.demo ? ' (demo)' : ''));
        all = await DB.offers(); paint();
      }
    });
  });

  /* ---------------- reviews ---------------- */
  Shell.register('reviews', async function (view) {
    let all = [], filter = '';

    view.innerHTML = `
      <section class="card">
        <header class="card-head">
          <h2>Reviews</h2>
          <div class="seg" id="rvFilter" role="group" aria-label="Filter">
            <button data-f="" class="on">All</button>
            <button data-f="pending">Pending</button>
            <button data-f="approved">Approved</button>
            <button data-f="hidden">Hidden</button>
          </div>
        </header>
        <div id="rvBody" class="rv-list"></div>
        <footer class="card-foot">
          <span class="muted">Reviews are written by customers. This screen only
            approves, hides or deletes them — it never creates them.</span>
        </footer>
      </section>`;

    const filtered = () => all.filter(r => !filter || r.status === filter);

    function paint() {
      const rows = filtered();
      UI.$('#rvBody').innerHTML = rows.length ? rows.map(r => `
        <article class="rv">
          <div class="rv-top">
            <div>
              <b>${esc(r.customer_name)}</b>
              ${r.location ? `<small>${esc(r.location)}</small>` : ''}
            </div>
            <div class="rv-stars" aria-label="${r.rating} out of 5">
              ${'★'.repeat(r.rating)}<span>${'★'.repeat(5 - r.rating)}</span>
            </div>
            ${UI.chip(r.status)}
          </div>
          <p>${esc(r.body)}</p>
          <div class="rv-foot">
            <small class="muted">${UI.date(r.created_at)}</small>
            <div class="nowrap">
              <button class="btn btn-ghost btn-sm" data-st="approved" data-id="${r.id}">Approve</button>
              <button class="btn btn-ghost btn-sm" data-st="hidden" data-id="${r.id}">Hide</button>
            </div>
          </div>
        </article>`).join('')
        : UI.empty('bi-star', 'No reviews here', 'Nothing matches this filter.');
    }

    all = await DB.reviews();
    paint();
    UI.$('#rvFilter').addEventListener('click', e => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      UI.$$('#rvFilter button').forEach(x => x.classList.toggle('on', x === b));
      filter = b.getAttribute('data-f'); paint();
    });
    view.addEventListener('click', async e => {
      const b = e.target.closest('[data-st]'); if (!b) return;
      const r = await DB.setReviewStatus(b.getAttribute('data-id'), b.getAttribute('data-st'));
      if (!r.ok) return UI.toast(r.error || 'Could not update', 'bad');
      UI.toast('Review ' + b.getAttribute('data-st') + (r.demo ? ' (demo)' : ''));
      all = await DB.reviews(); paint();
    });
  });

  /* ---------------- ai knowledge ---------------- */
  Shell.register('ai-knowledge', async function (view) {
    const SECTIONS = ['business','products','faq','delivery','payment','returns','offers','contact'];
    let all = [], section = '';

    view.innerHTML = `
      <div class="notice">
        <i class="bi bi-info-circle"></i>
        <div><b>No AI service is connected.</b>
          This screen manages the content a future assistant would draw on.
          Nothing here is sent anywhere until an assistant is configured.</div>
      </div>

      <section class="card" style="margin-top:14px">
        <header class="card-head">
          <h2>Knowledge entries</h2>
          <div class="head-actions">
            <button class="btn btn-ghost btn-sm" id="aiSync">
              <i class="bi bi-arrow-repeat"></i> Sync</button>
            <button class="btn btn-primary btn-sm" id="aiAdd">
              <i class="bi bi-plus-lg"></i> Add entry</button>
          </div>
        </header>
        <div class="filters">
          <select id="aiSection" class="inp" aria-label="Filter by section">
            <option value="">All sections</option>
            ${SECTIONS.map(s => `<option value="${s}">${UI.label(s)}</option>`).join('')}
          </select>
        </div>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>Section</th><th>Question</th><th>Answer</th>
              <th>Status</th><th></th></tr></thead>
            <tbody id="aiBody">${UI.skeletonRows(5, 5)}</tbody>
          </table>
        </div>
      </section>`;

    const filtered = () => all.filter(k => !section || k.section === section);

    function paint() {
      const rows = filtered();
      UI.$('#aiBody').innerHTML = rows.length ? rows.map(k => `
        <tr>
          <td>${UI.chip(k.section)}</td>
          <td>${esc(k.question || '—')}</td>
          <td class="wrap">${esc((k.answer || '').slice(0, 120))}${(k.answer || '').length > 120 ? '…' : ''}</td>
          <td>${UI.chip(k.is_published ? 'approved' : 'hidden')}</td>
          <td class="r nowrap">
            <button class="icon-btn" data-edit="${k.id}" aria-label="Edit"><i class="bi bi-pencil"></i></button>
            <button class="icon-btn" data-del="${k.id}" aria-label="Delete"><i class="bi bi-trash"></i></button>
          </td></tr>`).join('')
        : `<tr><td colspan="5">${UI.empty('bi-robot','No entries',
            'Add the answers an assistant should know.')}</td></tr>`;
    }

    function form(k) {
      k = k || {};
      UI.modal({
        title: k.id ? 'Edit entry' : 'Add entry', wide:true,
        body: `
          <div class="grid-2">
            <div class="field"><label for="k-sec">Section</label>
              <select id="k-sec" class="inp">
                ${SECTIONS.map(s => `<option value="${s}" ${s === k.section ? 'selected' : ''}>
                  ${UI.label(s)}</option>`).join('')}</select></div>
            <div class="field"><label for="k-keys">Keywords (comma separated)</label>
              <input id="k-keys" class="inp" value="${esc((k.keywords || []).join(', '))}"></div>
          </div>
          <div class="field"><label for="k-q">Question</label>
            <input id="k-q" class="inp" value="${esc(k.question || '')}"></div>
          <div class="field"><label for="k-a">Answer <span class="req">*</span></label>
            <textarea id="k-a" class="inp" rows="5">${esc(k.answer || '')}</textarea></div>
          <label class="check"><input type="checkbox" id="k-pub"
            ${k.is_published ? 'checked' : ''}> Published</label>`,
        footer: `<button class="btn btn-ghost" data-close>Cancel</button>
                 <button class="btn btn-primary" id="k-save">Save entry</button>`
      });
      UI.$('#k-save').onclick = async () => {
        const answer = UI.$('#k-a').value.trim();
        if (!answer) return UI.toast('Enter an answer', 'bad');
        const r = await DB.saveKnowledge({
          ...(k.id ? { id:k.id } : {}),
          section:UI.$('#k-sec').value,
          question:UI.$('#k-q').value.trim() || null,
          answer,
          keywords:UI.$('#k-keys').value.split(',').map(s => s.trim()).filter(Boolean),
          is_published:UI.$('#k-pub').checked
        });
        if (!r.ok) return UI.toast(r.error || 'Could not save', 'bad');
        UI.closeModal(); UI.toast('Entry saved' + (r.demo ? ' (demo)' : ''));
        all = await DB.aiKnowledge(); paint();
      };
    }

    all = await DB.aiKnowledge();
    paint();
    UI.$('#aiSection').addEventListener('change', e => { section = e.target.value; paint(); });
    UI.$('#aiAdd').addEventListener('click', () => form(null));
    UI.$('#aiSync').addEventListener('click', () => {
      const published = all.filter(k => k.is_published).length;
      UI.toast(`${published} published entries ready. Connect an assistant to use them.`);
    });
    view.addEventListener('click', async e => {
      const ed = e.target.closest('[data-edit]');
      if (ed) return form(all.find(k => k.id === ed.getAttribute('data-edit')));
      const del = e.target.closest('[data-del]');
      if (del) {
        if (!await UI.confirmBox('Delete entry?', 'This cannot be undone.', 'Delete')) return;
        const r = await DB.deleteKnowledge(del.getAttribute('data-del'));
        if (!r.ok) return UI.toast(r.error || 'Could not delete', 'bad');
        UI.toast('Entry deleted' + (r.demo ? ' (demo)' : ''));
        all = await DB.aiKnowledge(); paint();
      }
    });
  });

  /* ---------------- settings ---------------- */
  Shell.register('settings', async function (view) {
    const s = await DB.settings();
    const p = Auth.getProfile() || {};

    view.innerHTML = `
      <div class="split">
        <section class="card">
          <header class="card-head"><h2>Business information</h2></header>
          <div class="card-body">
            <div class="field"><label for="s-name">Business name</label>
              <input id="s-name" class="inp" value="${esc(s.business_name || '')}"></div>
            <div class="grid-2">
              <div class="field"><label for="s-phone">Phone</label>
                <input id="s-phone" class="inp" value="${esc(s.phone || '')}"></div>
              <div class="field"><label for="s-wa">WhatsApp number</label>
                <input id="s-wa" class="inp" value="${esc(s.whatsapp || '')}"></div>
            </div>
            <div class="grid-2">
              <div class="field"><label for="s-email">Email</label>
                <input id="s-email" class="inp" type="email" value="${esc(s.email || '')}"></div>
              <div class="field"><label for="s-fssai">FSSAI licence</label>
                <input id="s-fssai" class="inp" value="${esc(s.fssai || '')}"></div>
            </div>
            <div class="field"><label for="s-addr">Address</label>
              <textarea id="s-addr" class="inp" rows="2">${esc(s.address || '')}</textarea></div>
          </div>
        </section>

        <section class="card">
          <header class="card-head"><h2>Order settings</h2></header>
          <div class="card-body">
            <div class="grid-2">
              <div class="field"><label for="s-min">Minimum order (₹)</label>
                <input id="s-min" class="inp" type="number" min="0" value="${s.minimum_order ?? 0}"></div>
              <div class="field"><label for="s-del">Delivery charge (₹)</label>
                <input id="s-del" class="inp" type="number" min="0" value="${s.delivery_charge ?? 0}"></div>
            </div>
            <label class="check"><input type="checkbox" id="s-cod"
              ${s.cod_enabled ? 'checked' : ''}> Accept cash on delivery</label>
            <label class="check"><input type="checkbox" id="s-alerts"
              ${s.low_stock_alerts ? 'checked' : ''}> Low stock alerts</label>
          </div>
          <footer class="card-foot">
            <button class="btn btn-primary" id="s-save">Save settings</button>
          </footer>
        </section>
      </div>

      <div class="split" style="margin-top:16px">
        <section class="card">
          <header class="card-head"><h2>Admin account</h2></header>
          <div class="card-body">
            <div class="grid-2">
              <div class="field"><label>Name</label>
                <input class="inp" value="${esc(p.full_name || '')}" disabled></div>
              <div class="field"><label>Role</label>
                <input class="inp" value="${esc(UI.label(p.role || ''))}" disabled></div>
            </div>
            <div class="field"><label>Email</label>
              <input class="inp" value="${esc(p.email || '')}" disabled></div>
            <div class="field"><label for="s-pw">New password</label>
              <input id="s-pw" class="inp" type="password" placeholder="At least 8 characters"></div>
            <button class="btn btn-ghost" id="s-pw-save">Change password</button>
          </div>
        </section>

        <section class="card">
          <header class="card-head"><h2>Connection</h2></header>
          <div class="card-body">
            <p class="muted">Data source</p>
            <p><b>${DB.live() ? 'Supabase — live' : 'Demo mode — not connected'}</b></p>
            ${DB.live() ? '' : `<p class="muted" style="margin-top:8px">
              Add your project URL and anon key to <code>js/config.js</code>,
              then run <code>sql/schema.sql</code> and <code>sql/seed.sql</code>.</p>`}
          </div>
        </section>
      </div>`;

    UI.$('#s-save').onclick = async () => {
      const r = await DB.saveSettings({
        business_name:UI.$('#s-name').value.trim(),
        phone:UI.$('#s-phone').value.trim(),
        whatsapp:UI.$('#s-wa').value.replace(/\D/g, ''),
        email:UI.$('#s-email').value.trim(),
        fssai:UI.$('#s-fssai').value.trim(),
        address:UI.$('#s-addr').value.trim(),
        minimum_order:parseFloat(UI.$('#s-min').value) || 0,
        delivery_charge:parseFloat(UI.$('#s-del').value) || 0,
        cod_enabled:UI.$('#s-cod').checked,
        low_stock_alerts:UI.$('#s-alerts').checked
      });
      UI.toast(r.ok ? 'Settings saved' + (r.demo ? ' (demo)' : '')
                    : (r.error || 'Could not save'), r.ok ? '' : 'bad');
    };

    UI.$('#s-pw-save').onclick = async () => {
      const pw = UI.$('#s-pw').value;
      if (pw.length < 8) return UI.toast('Use at least 8 characters', 'bad');
      const r = await Auth.changePassword(pw);
      UI.toast(r.ok ? 'Password changed' : (r.error || 'Could not change password'),
               r.ok ? '' : 'bad');
      if (r.ok) UI.$('#s-pw').value = '';
    };
  });
})();
