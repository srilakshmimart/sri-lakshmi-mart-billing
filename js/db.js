/* ============================================================
   DATA LAYER

   Every screen reads through this module — no page issues its own
   Supabase query. That keeps table names in one place and means
   swapping demo mode for the live database changes nothing above.

   Demo mode exists so the interface can be reviewed before the
   backend is provisioned. It is announced by a banner, and
   DB.live() is false throughout, so nothing here can be mistaken
   for real business figures.
   ============================================================ */
window.DB = (function () {

  const live = () => SB.live();

  /* ---------------- demo dataset ----------------
     Products and categories mirror the real catalogue. Orders,
     customers and stock are illustrative only and exist purely so
     tables, charts and empty states can be seen working. */
  const DEMO = (function () {
    const cats = [
      { id:'c1', slug:'organic-malt',     name:'Malt',      is_active:true },
      { id:'c2', slug:'organic-readymix', name:'Ready Mix', is_active:true },
      { id:'c3', slug:'organic-masala',   name:'Masala',    is_active:true },
      { id:'c4', slug:'organic-laddu',    name:'Laddu',     is_active:true },
      { id:'c5', slug:'home-kitchen',     name:'Kitchen',   is_active:true },
      { id:'c6', slug:'home-cleaning',    name:'Cleaning',  is_active:true },
      { id:'c7', slug:'home-beauty',      name:'Beauty',    is_active:true },
      { id:'c8', slug:'home-home',        name:'Home',      is_active:true },
      { id:'c9', slug:'home-kids',        name:'Kids',      is_active:true }
    ];
    const catBySlug = s => (cats.find(c => c.slug === s) || {}).id;

    const products = [], variants = [], inventory = [];
    const src = window.DEMO_CATALOGUE || { products: [], accessories: [] };

    src.products.forEach((p, i) => {
      const id = 'p' + p.id;
      products.push({
        id, sku:'SLM-P' + String(p.id).padStart(3,'0'), name:p.name,
        category_id:catBySlug('organic-' + p.cat), price:p.price,
        offer_price:null, image_url:p.img || '', description:p.desc,
        is_active:true
      });
      (p.sizes || []).forEach(sz => {
        const g = parseInt(String(sz).replace(/[^0-9]/g,''), 10);
        const grams = String(sz).toLowerCase().includes('kg') ? g*1000 : g;
        variants.push({ id:id+'-'+grams, product_id:id, label:sz, grams,
          price:(p.prices && p.prices[String(grams)]) || p.price });
      });
      // a spread of stock so Available / Low / Out can all be seen
      const stock = [0, 4, 7, 18, 26, 40, 12][i % 7];
      inventory.push({ id:'i'+id, product_id:id, variant_id:null, stock,
        minimum_stock:10, updated_at:new Date().toISOString() });
    });
    src.accessories.forEach((p, i) => {
      products.push({
        id:p.id, sku:'SLM-' + String(p.id).toUpperCase(), name:p.name,
        category_id:catBySlug('home-' + p.cat), price:p.price,
        offer_price:null, image_url:p.img || '', description:p.desc, is_active:true
      });
      inventory.push({ id:'i'+p.id, product_id:p.id, variant_id:null,
        stock:[15, 3, 0, 22, 9, 31][i % 6], minimum_stock:10,
        updated_at:new Date().toISOString() });
    });

    /* deterministic sample orders across the last 60 days */
    const NAMES = [
      ['Priya Murugan','9843012001','Dharmapuri'], ['Suresh Kumar','9843012002','Krishnagiri'],
      ['Anitha Lakshmi','9843012003','Salem'],     ['Ravi Shankar','9843012004','Hosur'],
      ['Meena Devi','9843012005','Uthangarai'],    ['Karthik R','9843012006','Tiruppattur'],
      ['Lakshmi N','9843012007','Bargur'],         ['Vijay Anand','9843012008','Krishnagiri']
    ];
    const customers = NAMES.map((n, i) => ({
      id:'cu'+(i+1), full_name:n[0], phone:n[1], email:'', city:n[2],
      address:'—', state:'Tamil Nadu', is_active:true,
      created_at:new Date(Date.now() - (70-i*4)*864e5).toISOString()
    }));

    const STATUS = ['delivered','delivered','shipped','packed','processing','confirmed','new','cancelled'];
    const PAY    = ['cod','cod','upi','online'];
    const orders = [], items = [], bills = [];
    let seed = 20260821;
    const rnd = () => (seed = (seed*1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

    for (let i = 0; i < 64; i++) {
      const day = Math.floor(rnd() * 60);
      const when = new Date(Date.now() - day*864e5 - Math.floor(rnd()*20)*36e5);
      const cust = customers[Math.floor(rnd()*customers.length)];
      const st   = STATUS[Math.floor(rnd()*STATUS.length)];
      const id   = 'o'+(i+1);
      const n    = 1 + Math.floor(rnd()*3);
      let subtotal = 0;
      for (let k = 0; k < n; k++) {
        const pr = products[Math.floor(rnd()*products.length)];
        const v  = variants.filter(x => x.product_id === pr.id);
        const chosen = v.length ? v[Math.floor(rnd()*v.length)] : null;
        const price = chosen ? chosen.price : pr.price;
        const qty = 1 + Math.floor(rnd()*3);
        subtotal += price*qty;
        items.push({ id:id+'-'+k, order_id:id, product_id:pr.id,
          product_name:pr.name, variant_label:chosen ? chosen.label : null,
          unit_price:price, quantity:qty, subtotal:price*qty });
      }
      const delivery = subtotal > 500 ? 0 : 40;
      const total = subtotal + delivery;
      orders.push({
        id, order_number:'SLM-'+String(1000+i).padStart(6,'0'),
        customer_id:cust.id, customer_name:cust.full_name, customer_phone:cust.phone,
        delivery_address:`${cust.city}, Tamil Nadu`,
        status:st, payment_method:PAY[Math.floor(rnd()*PAY.length)],
        payment_status:st==='delivered' ? 'paid' : (st==='cancelled' ? 'refunded' : 'pending'),
        subtotal, discount:0, delivery_charge:delivery, total,
        source:'website', placed_at:when.toISOString()
      });
      if (st !== 'cancelled') {
        bills.push({ id:'b'+(i+1), bill_number:'SLB-'+String(1000+i).padStart(6,'0'),
          order_id:id, amount:total, status:st==='delivered'?'paid':'issued',
          issued_at:when.toISOString() });
      }
    }

    const reviews = [
      { id:'r1', customer_name:'Priya Murugan', location:'Dharmapuri, Tamil Nadu', rating:5,
        body:'The Ragi Malt is absolutely divine! My children love it every morning. You can taste the difference of real, homemade goodness. Will never go back to store-bought.',
        status:'approved', created_at:new Date(Date.now()-12*864e5).toISOString() },
      { id:'r2', customer_name:'Suresh Kumar', location:'Krishnagiri, Tamil Nadu', rating:5,
        body:'I ordered the Murungai Malt and Sambar Powder together. The quality and freshness is unmatched. WhatsApp ordering was so simple and delivery was prompt.',
        status:'approved', created_at:new Date(Date.now()-26*864e5).toISOString() },
      { id:'r3', customer_name:'Anitha Lakshmi', location:'Salem, Tamil Nadu', rating:5,
        body:'The Nut Laddu is a healthy treat for my elderly parents. Pure ingredients, no artificial flavours, and it tastes exactly like what my grandmother used to make!',
        status:'approved', created_at:new Date(Date.now()-40*864e5).toISOString() }
    ];

    const offers = [];
    const ai = [
      { id:'k1', section:'business', question:'Who are you?',
        answer:'Sri Lakshmi Mart makes homemade organic foods in Uthangarai, Krishnagiri District, Tamil Nadu. FSSAI 22425103000163.',
        is_published:true, sort_order:1 },
      { id:'k2', section:'contact', question:'How do I contact you?',
        answer:'WhatsApp or call +91 73052 76415.', is_published:true, sort_order:1 },
      { id:'k3', section:'delivery', question:'Do you deliver?',
        answer:'Delivery charges and timelines are confirmed for your location when the order is acknowledged on WhatsApp.',
        is_published:true, sort_order:1 }
    ];

    const settings = {
      id:1, business_name:'Sri Lakshmi Mart', phone:'+91 73052 76415',
      whatsapp:'917305276415', email:'', fssai:'22425103000163',
      address:'Uthangarai, Krishnagiri District, Tamil Nadu, India',
      minimum_order:0, delivery_charge:40, cod_enabled:true, low_stock_alerts:true
    };

    const notifications = orders.slice(0, 4).map((o, i) => ({
      id:'n'+i, kind:'new_order', title:'New order '+o.order_number,
      body:o.customer_name+' · ₹'+o.total, entity_id:o.id,
      is_read:i > 1, created_at:o.placed_at
    }));

    return { cats, products, variants, inventory, customers, orders, items,
             bills, reviews, offers, ai, settings, notifications };
  })();

  /* ---------------- helpers ---------------- */
  const clone = o => JSON.parse(JSON.stringify(o));
  const byId = (arr, id) => arr.find(x => x.id === id);

  function inventoryStatus(row) {
    if (row.stock <= 0) return 'out_of_stock';
    if (row.stock <= row.minimum_stock) return 'low_stock';
    return 'available';
  }

  /* ---------------- catalogue ---------------- */
  async function categories() {
    if (!live()) return [];

    const [d, e] = await SB.run(c =>
      c.from('categories')
        .select('*')
        .order('name')
    );

    if (e) {
      console.error('Categories load failed:', e);
      return [];
    }

    return d || [];
  }

  async function products() {
    if (!live()) return [];

    const [d, e] = await SB.run(c =>
      c.from('products')
        .select('*')
        .order('name')
    );

    if (e) {
      console.error('Products load failed:', e);
      return [];
    }

    return d || [];
  }

  async function variants(productId) {
    if (!live()) return [];
    const [d, e] = await SB.run(c => c.from('product_variants').select('*').eq('product_id', productId).order('name'));
    if (e) { console.error('Variants load failed:', e); return []; }
    return d || [];
  }

  async function saveProduct(p) {
    if (live()) {
      const [d, e] = await SB.run(c => p.id
        ? c.from('products').update(p).eq('id', p.id).select().single()
        : c.from('products').insert(p).select().single());
      return e ? { ok:false, error:e.message } : { ok:true, data:d };
    }
    if (p.id) Object.assign(byId(DEMO.products, p.id) || {}, p);
    else { p.id = 'p' + Date.now(); DEMO.products.push(p);
           DEMO.inventory.push({ id:'i'+p.id, product_id:p.id, variant_id:null,
             stock:0, minimum_stock:10, updated_at:new Date().toISOString() }); }
    return { ok:true, data:p, demo:true };
  }

  async function deleteProduct(id) {
    if (live()) {
      const [, e] = await SB.run(c => c.from('products').delete().eq('id', id));
      return e ? { ok:false, error:e.message } : { ok:true };
    }
    const i = DEMO.products.findIndex(p => p.id === id);
    if (i > -1) DEMO.products.splice(i, 1);
    return { ok:true, demo:true };
  }

  /* ---------------- inventory ---------------- */
  async function inventory() {
    if (!live()) return [];
    const [d, e] = await SB.run(c => c.from('inventory_status').select('*').order('product_name'));
    if (e) { console.error('Inventory load failed:', e); return []; }
    return d || [];
  }

  async function stockMove(productId, quantity, kind, note) {
    if (live()) {
      const [d, e] = await SB.run(c => c.from('inventory_transactions')
        .insert({ product_id:productId, quantity, kind, note }).select().single());
      return e ? { ok:false, error:e.message } : { ok:true, data:d };
    }
    const row = DEMO.inventory.find(r => r.product_id === productId);
    if (row) { row.stock = Math.max(0, row.stock + quantity);
               row.updated_at = new Date().toISOString(); }
    DEMO.transactions = DEMO.transactions || [];
    DEMO.transactions.unshift({ id:'t'+Date.now(), product_id:productId, kind,
      quantity, balance_after:row ? row.stock : null, note,
      created_at:new Date().toISOString() });
    return { ok:true, demo:true };
  }

  async function stockHistory(productId) {
    if (!live()) return [];
    const [d, e] = await SB.run(c => c.from('inventory_transactions').select('*').eq('product_id', productId).order('created_at', { ascending:false }).limit(50));
    if (e) { console.error('Stock history load failed:', e); return []; }
    return d || [];
  }

  /* ---------------- orders ---------------- */
  async function orders() {
    if (!live()) return [];
    const [d, e] = await SB.run(c => c.from('orders').select('*').order('placed_at', { ascending:false }).limit(500));
    if (e) { console.error('Orders load failed:', e); return []; }
    return d || [];
  }

  async function orderItems(orderId) {
    if (!live()) return [];
    const [d, e] = await SB.run(c => c.from('order_items').select('*').eq('order_id', orderId));
    if (e) { console.error('Order items load failed:', e); return []; }
    return d || [];
  }

  async function setOrderStatus(id, status) {
    if (live()) {
      const [, e] = await SB.run(c => c.from('orders').update({ status }).eq('id', id));
      return e ? { ok:false, error:e.message } : { ok:true };
    }
    const o = byId(DEMO.orders, id);
    if (o) o.status = status;
    return { ok:true, demo:true };
  }

  /* ---------------- bills ---------------- */
  async function bills() {
    if (!live()) return [];
    const [d, e] = await SB.run(c => c.from('bills').select('*').order('issued_at', { ascending:false }).limit(500));
    if (e) { console.error('Bills load failed:', e); return []; }
    return d || [];
  }

  /* ---------------- customers ---------------- */
  async function customers() {
    if (!live()) return [];
    const [d, e] = await SB.run(c => c.from('customers').select('*').order('name'));
    if (e) { console.error('Customers load failed:', e); return []; }
    return d || [];
  }

  /** Order totals per customer, computed rather than stored. */
  async function customerStats() {
    const [cs, os] = await Promise.all([customers(), orders()]);
    return cs.map(c => {
      const mine = os.filter(o => o.customer_id === c.id && o.status !== 'cancelled');
      return {
        ...c,
        total_orders: mine.length,
        total_spent:  mine.reduce((s, o) => s + Number(o.total || 0), 0),
        last_order:   mine.length ? mine.map(o => o.placed_at).sort().pop() : null
      };
    });
  }

  /* ---------------- reviews / offers / ai / settings ---------------- */
  async function reviews() {
    if (!live()) return [];
    const [d, e] = await SB.run(c => c.from('reviews').select('*').order('created_at', { ascending:false }));
    if (e) { console.error('Reviews load failed:', e); return []; }
    return d || [];
  }
  async function setReviewStatus(id, status) {
    if (live()) {
      const [, e] = await SB.run(c => c.from('reviews').update({ status }).eq('id', id));
      return e ? { ok:false, error:e.message } : { ok:true };
    }
    const r = byId(DEMO.reviews, id); if (r) r.status = status;
    return { ok:true, demo:true };
  }

  async function offers() {
    if (!live()) return [];
    const [d, e] = await SB.run(c => c.from('offers').select('*').order('starts_on', { ascending:false }));
    if (e) { console.error('Offers load failed:', e); return []; }
    return d || [];
  }
  async function saveOffer(o) {
    if (live()) {
      const [d, e] = await SB.run(c => o.id
        ? c.from('offers').update(o).eq('id', o.id).select().single()
        : c.from('offers').insert(o).select().single());
      return e ? { ok:false, error:e.message } : { ok:true, data:d };
    }
    if (o.id) Object.assign(byId(DEMO.offers, o.id) || {}, o);
    else { o.id = 'of' + Date.now(); DEMO.offers.push(o); }
    return { ok:true, demo:true };
  }
  async function deleteOffer(id) {
    if (live()) {
      const [, e] = await SB.run(c => c.from('offers').delete().eq('id', id));
      return e ? { ok:false, error:e.message } : { ok:true };
    }
    const i = DEMO.offers.findIndex(o => o.id === id);
    if (i > -1) DEMO.offers.splice(i, 1);
    return { ok:true, demo:true };
  }

  async function aiKnowledge() {
    if (!live()) return [];
    const [d, e] = await SB.run(c => c.from('ai_knowledge').select('*').order('section').order('sort_order'));
    if (e) { console.error('AI knowledge load failed:', e); return []; }
    return d || [];
  }
  async function saveKnowledge(k) {
    if (live()) {
      const [d, e] = await SB.run(c => k.id
        ? c.from('ai_knowledge').update(k).eq('id', k.id).select().single()
        : c.from('ai_knowledge').insert(k).select().single());
      return e ? { ok:false, error:e.message } : { ok:true, data:d };
    }
    if (k.id) Object.assign(byId(DEMO.ai, k.id) || {}, k);
    else { k.id = 'k' + Date.now(); DEMO.ai.push(k); }
    return { ok:true, demo:true };
  }
  async function deleteKnowledge(id) {
    if (live()) {
      const [, e] = await SB.run(c => c.from('ai_knowledge').delete().eq('id', id));
      return e ? { ok:false, error:e.message } : { ok:true };
    }
    const i = DEMO.ai.findIndex(k => k.id === id);
    if (i > -1) DEMO.ai.splice(i, 1);
    return { ok:true, demo:true };
  }

  async function settings() {
    if (!live()) return null;
    const [d, e] = await SB.run(c => c.from('business_settings').select('*').eq('id', 1).maybeSingle());
    if (e) { console.error('Business settings load failed:', e); return null; }
    return d || null;
  }
  async function saveSettings(s) {
    if (live()) {
      const [, e] = await SB.run(c => c.from('business_settings')
        .update(s).eq('id', 1));
      return e ? { ok:false, error:e.message } : { ok:true };
    }
    Object.assign(DEMO.settings, s);
    return { ok:true, demo:true };
  }

  async function notifications() {
    if (!live()) return [];
    const [d, e] = await SB.run(c => c.from('notifications').select('*').order('created_at', { ascending:false }).limit(30));
    if (e) { console.error('Notifications load failed:', e); return []; }
    return d || [];
  }
  async function markNotificationsRead() {
    if (live()) { await SB.run(c => c.from('notifications').update({ is_read:true }).eq('is_read', false)); }
    else DEMO.notifications.forEach(n => n.is_read = true);
    return { ok:true };
  }

  /* ---------------- derived reporting ----------------
     Computed from orders so every screen agrees, and so the same
     code works whether the rows came from Supabase or demo mode. */
  function inRange(list, from, to) {
    const f = from ? new Date(from + 'T00:00:00').getTime() : -Infinity;
    const t = to   ? new Date(to   + 'T23:59:59').getTime() :  Infinity;
    return list.filter(o => {
      const d = new Date(o.placed_at).getTime();
      return d >= f && d <= t;
    });
  }

  async function summary(from, to) {
    const [os, items, inv, cs] = await Promise.all([
      orders(), allItems(), inventory(), customers()
    ]);
    const scoped = inRange(os, from, to).filter(o => o.status !== 'cancelled');
    const ids = new Set(scoped.map(o => o.id));
    const units = items.filter(i => ids.has(i.order_id))
                       .reduce((s, i) => s + Number(i.quantity || 0), 0);
    const sales = scoped.reduce((s, o) => s + Number(o.total || 0), 0);
    return {
      orders: scoped.length,
      sales,
      units,
      avg: scoped.length ? sales / scoped.length : 0,
      customers: cs.length,
      products: (await products()).length,
      lowStock: inv.filter(r => r.status === 'low_stock').length,
      outOfStock: inv.filter(r => r.status === 'out_of_stock').length,
      pending: inRange(os, from, to).filter(o =>
        ['new','confirmed','processing','packed','shipped'].includes(o.status)).length,
      completed: inRange(os, from, to).filter(o => o.status === 'delivered').length,
      cancelled: inRange(os, from, to).filter(o => o.status === 'cancelled').length
    };
  }

  async function allItems() {
    if (!live()) return [];
    const [d, e] = await SB.run(c => c.from('order_items').select('*').limit(5000));
    if (e) { console.error('Order items load failed:', e); return []; }
    return d || [];
  }

  /** Sales and orders per day, gap-filled so charts have no holes. */
  async function series(from, to) {
    const os = (await orders()).filter(o => o.status !== 'cancelled');
    const scoped = inRange(os, from, to);
    const map = {};
    scoped.forEach(o => {
      const d = o.placed_at.slice(0, 10);
      (map[d] = map[d] || { sales:0, orders:0 });
      map[d].sales += Number(o.total || 0);
      map[d].orders += 1;
    });
    const out = [];
    const start = new Date(from + 'T00:00:00'), end = new Date(to + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = d.toISOString().slice(0, 10);
      out.push({ day:k, sales:(map[k] || {}).sales || 0, orders:(map[k] || {}).orders || 0 });
    }
    return out;
  }

  async function topProducts(from, to, limit) {
    const [os, items, prods] = await Promise.all([orders(), allItems(), products()]);
    const ids = new Set(inRange(os, from, to).filter(o => o.status !== 'cancelled').map(o => o.id));
    const agg = {};
    items.filter(i => ids.has(i.order_id)).forEach(i => {
      const k = i.product_id || i.product_name;
      (agg[k] = agg[k] || { name:i.product_name, units:0, revenue:0, id:i.product_id });
      agg[k].units += Number(i.quantity || 0);
      agg[k].revenue += Number(i.subtotal || 0);
    });
    return Object.values(agg).sort((a, b) => b.revenue - a.revenue).slice(0, limit || 10);
  }

  async function topCategories(from, to) {
    const [cats, prods, tops] = await Promise.all([categories(), products(), topProducts(from, to, 999)]);
    const catOf = id => (prods.find(p => p.id === id) || {}).category_id;
    const name = id => (cats.find(c => c.id === id) || {}).name || 'Uncategorised';
    const agg = {};
    tops.forEach(t => {
      const cid = catOf(t.id);
      const k = name(cid);
      (agg[k] = agg[k] || { name:k, units:0, revenue:0 });
      agg[k].units += t.units; agg[k].revenue += t.revenue;
    });
    return Object.values(agg).sort((a, b) => b.revenue - a.revenue);
  }

  return {
    live, inventoryStatus, inRange,
    categories, products, variants, saveProduct, deleteProduct,
    inventory, stockMove, stockHistory,
    orders, orderItems, setOrderStatus, allItems,
    bills, customers, customerStats,
    reviews, setReviewStatus,
    offers, saveOffer, deleteOffer,
    aiKnowledge, saveKnowledge, deleteKnowledge,
    settings, saveSettings,
    notifications, markNotificationsRead,
    summary, series, topProducts, topCategories
  };
})();
