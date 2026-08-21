/* ============================================================
   CONFIGURATION

   Fill these in and the app talks to your Supabase project.
   Leave them empty and it runs in demo mode with clearly
   labelled sample data, so the interface can be reviewed before
   the backend exists.

   Only the ANON key belongs here. It is safe in the browser
   because Row Level Security decides what it may touch.
   NEVER put the service_role key in this file.
   ============================================================ */
window.CONFIG = {
  SUPABASE_URL:      'https://jyvsdwfpnnwtaqnahgce.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_JvK0KPv6I0nkRDwrfdOZmA_bMGkDv0v',

  APP_NAME:    'Sri Lakshmi Mart',
  APP_TAGLINE: 'Admin & Business Management',

  CURRENCY: '₹',
  LOCALE:   'en-IN',

  FALLBACK_WHATSAPP: '917305276415'
};

window.CONFIG.isConfigured = () =>
  !!(window.CONFIG.SUPABASE_URL && window.CONFIG.SUPABASE_ANON_KEY);
