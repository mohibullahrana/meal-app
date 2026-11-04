// Supabase Edge Function: admin-users
// Admin-only actions that need the service_role key (kept secret on the server).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const emailFor = (loginId: string) => `${loginId.trim().toLowerCase()}@meal-portal.app`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1) Who is calling?
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: caller } = await admin.auth.getUser(token);
    if (!caller?.user) return json({ error: 'Unauthorized' }, 401);

    // 2) Is the caller an active admin?
    const { data: me } = await admin
      .from('profiles').select('role,status').eq('id', caller.user.id).single();
    if (me?.role !== 'admin' || me?.status !== 'active') {
      return json({ error: 'Forbidden: admin only' }, 403);
    }

    const body = await req.json();

    // ---- CREATE USER ----
    if (body.action === 'create') {
      const userId = String(body.userId ?? '').trim();
      const password = String(body.password ?? '');
      if (!/^[A-Za-z0-9_]{3,30}$/.test(userId)) {
        return json({ error: 'User ID must be 3-30 letters, numbers or _' }, 400);
      }
      if (password.length < 6) {
        return json({ error: 'Password must be at least 6 characters' }, 400);
      }
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: emailFor(userId),
        password,
        email_confirm: true,
      });
      if (createErr) return json({ error: createErr.message }, 400);

      const { error: profErr } = await admin.from('profiles').insert({
        id: created.user.id,
        user_id: userId,
        full_name: String(body.fullName ?? '').trim(),
        flat_number: String(body.flatNumber ?? '').trim(),
        role: 'user',
      });
      if (profErr) {
        await admin.auth.admin.deleteUser(created.user.id); // rollback
        return json({ error: profErr.message }, 400);
      }
      return json({ ok: true });
    }

    // For delete / reset we need the target user
    const { data: target } = await admin
      .from('profiles').select('id,role').eq('id', body.id).single();
    if (!target) return json({ error: 'User not found' }, 404);
    if (target.role === 'admin') return json({ error: 'Cannot modify an admin here' }, 400);

    // ---- DELETE USER (profile + meals are removed by cascade) ----
    if (body.action === 'delete') {
      const { error } = await admin.auth.admin.deleteUser(target.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ---- RESET PASSWORD ----
    if (body.action === 'reset_password') {
      const password = String(body.password ?? '');
      if (password.length < 6) {
        return json({ error: 'Password must be at least 6 characters' }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(target.id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
