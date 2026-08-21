/* ============================================================
   SUPABASE CLIENT

   Thin wrapper so no page imports the SDK directly. If the
   project is not configured, every call resolves to null and
   db.js falls back to demo data — the UI never crashes because
   a backend is missing.
   ============================================================ */
window.SB = (function () {
  let client = null, ready = false;

  function init() {
    if (ready) return client;
    ready = true;
    if (!CONFIG.isConfigured()) return (client = null);
    if (!window.supabase || !window.supabase.createClient) {
      console.warn('[SB] Supabase SDK did not load; running in demo mode.');
      return (client = null);
    }
    client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'slm-admin-auth' }
    });
    return client;
  }

  const get = () => (ready ? client : init());
  const live = () => !!get();

  /** Run a query builder, returning [data, error] rather than throwing. */
  async function run(build) {
    const c = get();
    if (!c) return [null, new Error('offline')];
    try {
      const { data, error } = await build(c);
      if (error) return [null, error];
      return [data, null];
    } catch (e) {
      return [null, e];
    }
  }

  return { init, get, live, run };
})();
