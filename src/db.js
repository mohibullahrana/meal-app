// Supabase data layer. Replaces the old IndexedDB code.
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

// Login ID -> internal email (users never see this)
const emailFor = (loginId) => `${loginId.trim().toLowerCase()}@meal-portal.app`;

const mapProfile = (p) => ({
  id: p.id,
  userId: p.user_id,
  fullName: p.full_name,
  flatNumber: p.flat_number,
  role: p.role,
  status: p.status,
  createdAt: p.created_at,
  deactivatedAt: p.deactivated_at,
});

const MEAL_COLS =
  'id, user_id, meal_date, meal_type, selection, changed_by_admin, updated_at, profiles(user_id)';
const mapMeal = (r) => ({
  id: r.id,
  uid: r.user_id,
  userId: r.profiles?.user_id,
  date: r.meal_date,
  mealType: r.meal_type,
  selection: r.selection,
  changedByAdmin: r.changed_by_admin,
  updatedAt: r.updated_at,
});

const GUEST_COLS = 'id, user_id, meal_date, meal_type, quantity, updated_at, profiles(user_id)';
const mapGuest = (r) => ({
  id: r.id,
  uid: r.user_id,
  userId: r.profiles?.user_id,
  date: r.meal_date,
  mealType: r.meal_type,
  quantity: r.quantity,
  updatedAt: r.updated_at,
});

const check = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

// ---------- AUTH ----------
async function fetchProfile(uid) {
  const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  return data ? mapProfile(data) : null;
}

export async function signIn(loginId, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailFor(loginId),
    password,
  });
  if (error) throw new Error('Invalid User ID or Password.');
  const profile = await fetchProfile(data.user.id);
  if (!profile) {
    await supabase.auth.signOut();
    throw new Error('Invalid User ID or Password.');
  }
  if (profile.status === 'deactivated') {
    await supabase.auth.signOut();
    throw new Error('This account has been deactivated. Please contact Admin.');
  }
  return profile;
}

export async function getSessionProfile() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const profile = await fetchProfile(data.session.user.id);
  if (!profile || profile.status === 'deactivated') {
    await supabase.auth.signOut();
    return null;
  }
  return profile;
}

export const signOut = () => supabase.auth.signOut();

export async function changeMyPassword(loginId, oldPwd, newPwd) {
  const { error: reauthErr } = await supabase.auth.signInWithPassword({
    email: emailFor(loginId),
    password: oldPwd,
  });
  if (reauthErr) throw new Error('Current password is incorrect.');
  const { error } = await supabase.auth.updateUser({ password: newPwd });
  if (error) throw new Error(error.message);
}

// ---------- READS ----------
export async function fetchSettings() {
  const r = check(await supabase.from('settings').select('*').eq('id', 1).single());
  return {
    lunchDeadline: r.lunch_deadline,
    dinnerDeadline: r.dinner_deadline,
    selectionWindowDays: r.selection_window_days,
    timezone: 'Asia/Dhaka',
  };
}

export async function fetchUsers() {
  const rows = check(await supabase.from('profiles').select('*').order('created_at'));
  return rows.map(mapProfile);
}

export async function fetchMyMeals(uid, monthPrefix) {
  const [y, m] = monthPrefix.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const rows = check(
    await supabase
      .from('meals')
      .select(MEAL_COLS)
      .eq('user_id', uid)
      .gte('meal_date', `${monthPrefix}-01`)
      .lte('meal_date', `${monthPrefix}-${String(lastDay).padStart(2, '0')}`),
  );
  return rows.map(mapMeal);
}

// Supabase returns max 1000 rows per request, so fetch in pages.
export async function fetchAllMeals() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = check(
      await supabase.from('meals').select(MEAL_COLS).order('id').range(from, from + 999),
    );
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out.map(mapMeal);
}

// Guest meals of one user (RLS: a user only sees their own rows)
export async function fetchMyGuestMeals(uid) {
  const rows = check(
    await supabase.from('guest_meals').select(GUEST_COLS).eq('user_id', uid).order('meal_date'),
  );
  return rows.map(mapGuest);
}

// All guest meals (admin only; RLS returns nothing for normal users)
export async function fetchAllGuestMeals() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = check(
      await supabase.from('guest_meals').select(GUEST_COLS).order('id').range(from, from + 999),
    );
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out.map(mapGuest);
}

export async function fetchAuditLogs() {
  const rows = check(
    await supabase.from('audit_logs').select('*').order('id', { ascending: false }).limit(200),
  );
  return rows.map((r) => ({
    id: r.id,
    adminId: r.admin_id,
    targetUserId: r.target_user_id,
    action: r.action,
    oldValue: r.old_value,
    newValue: r.new_value,
    timestamp: r.ts_label,
  }));
}

// ---------- WRITES ----------
export async function upsertMeal(uid, date, mealType, selection) {
  check(
    await supabase
      .from('meals')
      .upsert(
        { user_id: uid, meal_date: date, meal_type: mealType, selection },
        { onConflict: 'user_id,meal_date,meal_type' },
      ),
  );
}

// quantity 0 = cancelled
export async function upsertGuestMeal(uid, date, mealType, quantity) {
  check(
    await supabase
      .from('guest_meals')
      .upsert(
        { user_id: uid, meal_date: date, meal_type: mealType, quantity },
        { onConflict: 'user_id,meal_date,meal_type' },
      ),
  );
}

export async function addAuditLog({ adminId, targetUserId, action, oldValue, newValue, timestamp }) {
  check(
    await supabase.from('audit_logs').insert({
      admin_id: adminId,
      target_user_id: targetUserId,
      action,
      old_value: oldValue == null ? null : String(oldValue),
      new_value: newValue == null ? null : String(newValue),
      ts_label: timestamp,
    }),
  );
}

export async function setUserStatus(id, status) {
  check(
    await supabase
      .from('profiles')
      .update({
        status,
        deactivated_at: status === 'deactivated' ? new Date().toISOString() : null,
      })
      .eq('id', id),
  );
}

export async function saveSettings(s) {
  check(
    await supabase
      .from('settings')
      .update({
        lunch_deadline: s.lunchDeadline,
        dinner_deadline: s.dinnerDeadline,
        selection_window_days: s.selectionWindowDays,
      })
      .eq('id', 1),
  );
}

// Create / delete user, reset password -> Edge Function (needs the secret key)
export async function adminCall(body) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) {
    let msg = error.message;
    try {
      const j = await error.context.json();
      if (j?.error) msg = j.error;
    } catch (_) {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// ---------- REALTIME ----------
export function subscribeChanges(onChange) {
  const channel = supabase.channel('db-changes');
  ['meals', 'guest_meals', 'profiles', 'settings', 'audit_logs'].forEach((table) =>
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange),
  );
  channel.subscribe();
  return () => supabase.removeChannel(channel);
}
