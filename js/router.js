/* ============================================================
   SHELL + ROUTER
   Sidebar, header, notifications, hash routing.
   ============================================================ */
window.Shell = (function () {
  const { $, $$, esc } = UI;

  const NAV = [
    { id:'dashboard',    label:'Dashboard',    icon:'bi-grid-1x2' },
    { id:'orders',       label:'Orders',       icon:'bi-receipt' },
    { id:'bills',        label:'Bills',        icon:'bi-file-earmark-text' },
    { id:'customers',    label:'Customers',    icon:'bi-people' },
    { id:'products',     label:'Products',     icon:'bi-box-seam' },
    { id:'inventory',    label:'Inventory',    icon:'bi-boxes' },
    { id:'categories',   label:'Categories',   icon:'bi-tags' },
    { id:'offers',       label:'Offers',       icon:'bi-percent' },
    { id:'reviews',      label:'Reviews',      icon:'bi-star' },
    { id:'reports',      label:'Reports',      icon:'bi-clipboard-data' },
    { id:'analytics',    label:'Analytics',    icon:'bi-graph-up' },
    { id:'ai-knowledge', label:'AI Knowledge', icon:'bi-robot' },
    { id:'settings',     label:'Settings',     icon:'bi-gear' }
  ];

  let collapsed = localStorage.getItem('slm-admin-rail') === '1';

  function sidebarHTML() {
    return `
      <div class="rail-head">
        <img src="assets/mark-128.png" alt="" width="34" height="34">
        <div class="rail-brand">
          <b>Sri Lakshmi Mart</b>
          <span>Admin</span>
        </div>
      </div>
      <nav class="rail-nav" aria-label="Sections">
        ${NAV.map(n => `
          <a class="rail-item" href="#/${n.id}" data-nav="${n.id}">
            <span class="rail-ico"><i class="bi ${n.icon}"></i></span>
            <span class="rail-txt">${n.label}</span>
            <span class="rail-tip">${n.label}</span>
          </a>`).join('')}
      </nav>
      <div class="rail-foot">
        <div class="rail-me">
          <span class="avatar" id="railAvatar">A</span>
          <span class="rail-txt">
            <b id="railName">—</b>
            <small id="railRole">—</small>
          </span>
        </div>
        <button class="rail-item" id="railLogout">
          <span class="rail-ico"><i class="bi bi-box-arrow-right"></i></span>
          <span class="rail-txt">Log out</span>
          <span class="rail-tip">Log out</span>
        </button>
        <button class="rail-item rail-collapse" id="railToggle" aria-label="Collapse sidebar">
          <span class="rail-ico"><i class="bi bi-chevron-double-left"></i></span>
          <span class="rail-txt">Collapse</span>
        </button>
      </div>`;
  }

  function applyCollapsed() {
    document.body.classList.toggle('rail-collapsed', collapsed);
    localStorage.setItem('slm-admin-rail', collapsed ? '1' : '0');
  }

  async function renderNotifications() {
    const list = await DB.notifications();
    const unread = list.filter(n => !n.is_read).length;
    const dot = $('#notifDot');
    if (dot) dot.style.display = unread ? '' : 'none';
    if (dot) dot.textContent = unread > 9 ? '9+' : unread;
    const box = $('#notifList');
    if (!box) return;
    box.innerHTML = list.length ? list.map(n => `
      <div class="notif ${n.is_read ? '' : 'unread'}">
        <i class="bi ${{
          new_order:'bi-receipt', low_stock:'bi-exclamation-triangle',
          out_of_stock:'bi-x-octagon', new_review:'bi-star'
        }[n.kind] || 'bi-bell'}"></i>
        <div>
          <b>${esc(n.title)}</b>
          ${n.body ? `<span>${esc(n.body)}</span>` : ''}
          <small>${UI.dateTime(n.created_at)}</small>
        </div>
      </div>`).join('')
      : `<div class="notif-empty">Nothing new. Alerts appear here when an order
         arrives or stock runs low.</div>`;
  }

  function mount() {
    $('#rail').innerHTML = sidebarHTML();
    applyCollapsed();

    $('#railToggle').addEventListener('click', () => { collapsed = !collapsed; applyCollapsed(); });
    $('#railLogout').addEventListener('click', async () => {
      if (await UI.confirmBox('Log out?', 'You will need to sign in again.', 'Log out'))
        Auth.signOut();
    });

    $('#menuBtn').addEventListener('click', () => {
      document.body.classList.add('drawer-open');
    });
    $('#scrim').addEventListener('click', () => document.body.classList.remove('drawer-open'));
    $('#rail').addEventListener('click', e => {
      if (e.target.closest('a')) document.body.classList.remove('drawer-open');
    });

    // notifications
    const bell = $('#notifBtn');
    bell.addEventListener('click', async () => {
      const open = document.body.classList.toggle('notif-open');
      bell.setAttribute('aria-expanded', String(open));
      if (open) { await renderNotifications(); await DB.markNotificationsRead(); }
      else renderNotifications();
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('#notifPanel') && !e.target.closest('#notifBtn'))
        document.body.classList.remove('notif-open');
    });

    // profile menu
    const pm = $('#profileBtn');
    pm.addEventListener('click', e => {
      e.stopPropagation();
      const open = document.body.classList.toggle('profile-open');
      pm.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', () => document.body.classList.remove('profile-open'));

    if (!DB.live()) $('#demoBar').hidden = false;
    renderNotifications();
  }

  function setProfile(p) {
    if (!p) return;
    const initials = (p.full_name || 'A').split(/\s+/).map(x => x[0]).slice(0,2).join('').toUpperCase();
    $('#railAvatar').textContent = initials;
    $('#railName').textContent = p.full_name;
    $('#railRole').textContent = UI.label(p.role);
    $('#topAvatar').textContent = initials;
    $('#topName').textContent = p.full_name;
    $('#topRole').textContent = UI.label(p.role);
  }

  function markActive(id) {
    $$('.rail-item[data-nav]').forEach(a =>
      a.classList.toggle('active', a.getAttribute('data-nav') === id));
    const item = NAV.find(n => n.id === id);
    $('#pageTitle').textContent = item ? item.label : 'Dashboard';
    document.title = `${item ? item.label : 'Dashboard'} · Sri Lakshmi Mart Admin`;
  }

  /* ---------------- router ---------------- */
  const ROUTES = {};
  const register = (id, fn) => { ROUTES[id] = fn; };

  async function render() {
    const raw = (location.hash || '#/dashboard').replace(/^#\//, '');
    const [id, ...rest] = raw.split('/');
    const view = $('#view');
    const page = ROUTES[id] || ROUTES.dashboard;
    markActive(ROUTES[id] ? id : 'dashboard');
    view.innerHTML = '<div class="loading"><span class="spin"></span></div>';
    try {
      await page(view, rest);
    } catch (err) {
      console.error(err);
      view.innerHTML = UI.empty('bi-exclamation-triangle', 'Could not load this page',
        err.message || 'Something went wrong.');
    }
    view.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  return { mount, setProfile, render, register, NAV, renderNotifications };
})();
