/* ============================================================
   AUTHENTICATION

   Supabase Auth when configured. Without it the app runs in a
   clearly-marked demo session so the interface can be reviewed —
   that path is never a substitute for real security, and every
   protected read still goes through RLS on the server.
   ============================================================ */
window.Auth = (function () {
  const KEY = 'slm-admin-demo-session';
  let profile = null;

  async function currentUser() {
    if (SB.live()) {
      const c = SB.get();
      const { data } = await c.auth.getUser();
      return data && data.user ? data.user : null;
    }
    try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; }
  }

  /** The admins row for the signed-in user — this is what grants access. */
  async function loadProfile() {
    const user = await currentUser();
    if (!user) return (profile = null);
    if (SB.live()) {
      const [row] = await SB.run(c => c.from('admins')
        .select('*').eq('user_id', user.id).single());
      profile = row || null;
      return profile;
    }
    profile = { full_name:user.name || 'Demo Admin', email:user.email || 'demo@local',
                role:'owner', is_active:true, demo:true };
    return profile;
  }

  const getProfile = () => profile;

  async function signIn(email, password) {
    if (SB.live()) {
      const c = SB.get();
      const { data, error } = await c.auth.signInWithPassword({ email, password });
      if (error) return { ok:false, error:error.message };
      const [row] = await SB.run(x => x.from('admins')
        .select('*').eq('user_id', data.user.id).single());
      if (!row || !row.is_active) {
        await c.auth.signOut();
        return { ok:false, error:'This account is not an active administrator.' };
      }
      await SB.run(x => x.from('admins')
        .update({ last_login:new Date().toISOString() }).eq('id', row.id));
      profile = row;
      return { ok:true };
    }
    // demo sign-in: any address, so the UI can be opened without a backend
    if (!email) return { ok:false, error:'Enter an email address.' };
    sessionStorage.setItem(KEY, JSON.stringify({ email, name:'Demo Admin' }));
    await loadProfile();
    return { ok:true, demo:true };
  }

  async function signOut() {
    if (SB.live()) await SB.get().auth.signOut();
    sessionStorage.removeItem(KEY);
    profile = null;
    location.href = 'login.html';
  }

  async function resetPassword(email) {
    if (!SB.live()) return { ok:false, error:'Connect Supabase to enable password reset.' };
    const { error } = await SB.get().auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + '/login.html'
    });
    return error ? { ok:false, error:error.message } : { ok:true };
  }

  async function changePassword(next) {
    if (!SB.live()) return { ok:false, error:'Connect Supabase to change the password.' };
    const { error } = await SB.get().auth.updateUser({ password: next });
    return error ? { ok:false, error:error.message } : { ok:true };
  }

  /** Redirect to login unless a valid admin session exists. */
  async function requireAuth() {
    const p = await loadProfile();
    if (!p || !p.is_active) { location.replace('login.html'); return null; }
    return p;
  }

  return { signIn, signOut, requireAuth, loadProfile, getProfile,
           currentUser, resetPassword, changePassword };
})();
