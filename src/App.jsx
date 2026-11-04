import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, Calendar, Clock, Shield, LogOut, Check, X, RefreshCw, 
  Search, Settings, UserPlus, Key, AlertCircle, ChevronLeft, 
  ChevronRight, Edit3, Trash2, ShieldAlert, CheckCircle, Info, Lock, Sun, Moon,
  Utensils, ClipboardList, Plus, Minus
} from 'lucide-react';
import * as db from './db';

// --- DATA LAYER: Supabase (see src/db.js) ---

// --- BST HELPER FUNCTIONS (UTC+6) ---
const getBSTDateObj = (dateString) => {
  const date = dateString ? new Date(dateString) : new Date();
  // Format as BST string representation
  return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
};

const getBSTFormattedNow = () => {
  const now = new Date();
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    dateStyle: 'full',
    timeStyle: 'medium'
  }).format(now);
};

const getBSTYMD = (date = new Date()) => {
  const bstStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
  return bstStr; // Returns YYYY-MM-DD
};

// Last selectable date for users: end of NEXT month (BST), as YYYY-MM-DD
const getMaxSelectableYMD = () => {
  const [y, m] = getBSTYMD().split('-').map(Number); // m = current month (1-12)
  const last = new Date(y, m + 1, 0); // day 0 of the month after next = last day of next month
  const mm = String(last.getMonth() + 1).padStart(2, '0');
  const dd = String(last.getDate()).padStart(2, '0');
  return `${last.getFullYear()}-${mm}-${dd}`;
};

// Check if meal toggle is locked for current user at current BST time
const isMealLocked = (mealDateYMD, mealType, settings) => {
  const nowBST = getBSTDateObj();
  const todayYMD = getBSTYMD(nowBST);

  // Historical date check (past days are locked)
  if (mealDateYMD < todayYMD) return true;

  // Meal date object
  const [mYear, mMonth, mDay] = mealDateYMD.split('-').map(Number);
  
  if (mealType === 'Lunch') {
    // Lunch deadline: Previous calendar day at set time (default 23:59)
    const [h, m] = (settings?.lunchDeadline || '23:59').split(':').map(Number);
    const deadlineDate = new Date(mYear, mMonth - 1, mDay - 1, h, m, 59);
    if (nowBST > deadlineDate) return true;
  } else if (mealType === 'Dinner') {
    // Dinner deadline: Same calendar day at set time (default 14:00)
    const [h, m] = (settings?.dinnerDeadline || '14:00').split(':').map(Number);
    const deadlineDate = new Date(mYear, mMonth - 1, mDay, h, m, 59);
    if (nowBST > deadlineDate) return true;
  }

  // Only the current month and the next month can be selected
  if (mealDateYMD > getMaxSelectableYMD()) return true;

  return false;
};

// --- DATE HELPERS ---
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// '2026-11-04' -> '4 November 2026'
const formatDateLong = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Add/subtract days from a YYYY-MM-DD string
const shiftYMD = (ymd, delta) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

// All days of a month (month0 = 0..11)
const getMonthDays = (year, month0) => {
  const days = [];
  const date = new Date(year, month0, 1);
  while (date.getMonth() === month0) {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    days.push({
      dateStr: `${date.getFullYear()}-${mm}-${dd}`,
      dayNumber: dd,
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
    });
    date.setDate(date.getDate() + 1);
  }
  return days;
};

// Live clock in Bangladesh time, e.g. "10:23 AM"
function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(now);
  return <span>{time}</span>;
}

// --- MAIN REACT APP COMPONENT ---
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [viewMode, setViewMode] = useState('login'); // 'login', 'user_dashboard', 'admin_dashboard'
  const [notification, setNotification] = useState(null);

  // Sync / Realtime state trigger
  const [dbTick, setDbTick] = useState(0);
  const triggerSync = () => setDbTick(prev => prev + 1);

  // Load Seed & Check Local Session
  useEffect(() => {
    // Restore Supabase login session
    db.getSessionProfile().then((u) => {
      if (u) {
        setCurrentUser(u);
        setViewMode(u.role === 'admin' ? 'admin_dashboard' : 'user_dashboard');
      }
    });

    // Realtime: any data change anywhere refreshes every open screen
    const unsubscribe = db.subscribeChanges(() => triggerSync());
    return () => unsubscribe();
  }, []);

  const showNotify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const notifyDbUpdate = () => {
    triggerSync();
  };

  const handleLogout = async () => {
    await db.signOut();
    setCurrentUser(null);
    setViewMode('login');
    showNotify('Logged out successfully', 'info');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans antialiased selection:bg-emerald-100 selection:text-emerald-800">
      {/* Top Banner Navigation & Quick Demo Controls */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Sun className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Meal Hisab
              </h1>
              <p className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                <Clock className="w-3 h-3 text-emerald-600" /> <LiveClock />
              </p>
            </div>
          </div>

          {/* Quick Demo Role Switcher & User Control */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-sm font-semibold text-slate-700">{currentUser.fullName}</span>
                  <span className="text-xs text-slate-500 capitalize">{currentUser.role} • Flat {currentUser.flatNumber}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 transition flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" /> Logout
                </button>
              </div>
            ) : (
              <span className="text-xs font-medium text-slate-400">Meal Management System</span>
            )}
          </div>
        </div>
      </header>

      {/* Floating Notifications */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce-short">
          <div className={`px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border text-sm font-medium ${
            notification.type === 'error' 
              ? 'bg-rose-50 border-rose-200 text-rose-800' 
              : notification.type === 'info'
              ? 'bg-sky-50 border-sky-200 text-sky-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            {notification.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-500" /> : <CheckCircle className="w-5 h-5 text-emerald-500" />}
            {notification.msg}
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {viewMode === 'login' && (
          <LoginPortal 
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              setViewMode(user.role === 'admin' ? 'admin_dashboard' : 'user_dashboard');
              showNotify(`Welcome back, ${user.fullName}`);
            }} 
          />
        )}

        {viewMode === 'user_dashboard' && currentUser && (
          <UserPortal 
            currentUser={currentUser} 
            dbTick={dbTick} 
            notifyDbUpdate={notifyDbUpdate} 
            showNotify={showNotify}
          />
        )}

        {viewMode === 'admin_dashboard' && currentUser?.role === 'admin' && (
          <AdminPortal 
            currentUser={currentUser} 
            dbTick={dbTick} 
            notifyDbUpdate={notifyDbUpdate}
            showNotify={showNotify} 
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white/70 py-4 text-center">
        <p className="text-xs font-medium text-slate-500">
          Meal Hisab 2026. Developed by <span className="font-bold text-slate-700">Mhb Rana</span>
        </p>
      </footer>
    </div>
  );
}

// ==========================================
// 1. AUTHENTICATION / LOGIN COMPONENT
// ==========================================
function LoginPortal({ onLoginSuccess }) {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const user = await db.signIn(loginId, password);
      onLoginSuccess(user);
    } catch (err) {
      setError(err.message || 'Login failed.');
    }
    setIsSubmitting(false);
  };

  // Quick Preset Selector for Demo
  const fillPreset = (id, pwd) => {
    setLoginId(id);
    setPassword(pwd);
  };

  return (
    <div className="max-w-md mx-auto my-12">
      <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100 shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Portal Access</h2>
          <p className="text-xs text-slate-500 mt-1">Sign in to manage your daily meals</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Login ID / User ID
            </label>
            <input
              type="text"
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="e.g., admin or usr101"
              className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-600/30 transition transform active:scale-98"
          >
            {isSubmitting ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 2. USER PORTAL COMPONENT
// ==========================================
function UserPortal({ currentUser, dbTick, notifyDbUpdate, showNotify }) {
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' | 'password'
  const [settings, setSettings] = useState(null);
  const [currentMonthDate, setCurrentMonthDate] = useState(() => new Date());
  const [userMeals, setUserMeals] = useState({});
  const [userGuests, setUserGuests] = useState({}); // key: date_mealType -> guest record
  const [guestDate, setGuestDate] = useState('');
  const [guestMealType, setGuestMealType] = useState('Lunch');
  const [guestQty, setGuestQty] = useState(1);
  const [passwordForm, setPasswordForm] = useState({ oldPwd: '', newPwd: '', confirmPwd: '' });

  // Load System Settings
  useEffect(() => {
    db.fetchSettings().then(setSettings).catch(() => {});
  }, [dbTick]);

  // Load User Meal selections for displayed month
  useEffect(() => {
    const year = currentMonthDate.getFullYear();
    const month = String(currentMonthDate.getMonth() + 1).padStart(2, '0');
    db.fetchMyMeals(currentUser.id, `${year}-${month}`)
      .then((records) => {
        const mealMap = {};
        records.forEach((r) => {
          mealMap[`${r.date}_${r.mealType}`] = r;
        });
        setUserMeals(mealMap);
      })
      .catch(() => {});
  }, [currentUser.id, currentMonthDate, dbTick]);

  // Load this user's guest meal orders
  useEffect(() => {
    db.fetchMyGuestMeals(currentUser.id)
      .then((records) => {
        const map = {};
        records.forEach((r) => {
          map[`${r.date}_${r.mealType}`] = r;
        });
        setUserGuests(map);
      })
      .catch(() => {});
  }, [currentUser.id, dbTick]);

  // Toggle meal state (ON/OFF) with validation
  const handleToggleMeal = async (dateStr, mealType, currentVal) => {
    if (isMealLocked(dateStr, mealType, settings)) {
      showNotify('Deadline passed for this meal selection.', 'error');
      return;
    }

    const newVal = currentVal === 'ON' ? 'OFF' : 'ON';
    try {
      await db.upsertMeal(currentUser.id, dateStr, mealType, newVal);
      notifyDbUpdate();
      showNotify(`${mealType} for ${dateStr} updated to ${newVal}`);
    } catch (err) {
      showNotify(err.message, 'error');
    }
  };

  // ----- Guest meals -----
  const existingGuestQty = userGuests[`${guestDate}_${guestMealType}`]?.quantity || 0;
  useEffect(() => {
    setGuestQty(existingGuestQty > 0 ? existingGuestQty : 1);
  }, [guestDate, guestMealType, existingGuestQty]);

  const guestLocked = !guestDate || isMealLocked(guestDate, guestMealType, settings);

  const handleSaveGuestMeal = async (qty, date = guestDate, mealType = guestMealType) => {
    if (!date) {
      showNotify('Please select a date first.', 'error');
      return;
    }
    if (isMealLocked(date, mealType, settings)) {
      showNotify('Deadline passed for this meal. Guest meal cannot be changed.', 'error');
      return;
    }
    try {
      await db.upsertGuestMeal(currentUser.id, date, mealType, qty);
      notifyDbUpdate();
      showNotify(
        qty === 0
          ? `Guest ${mealType} for ${date} cancelled`
          : `Guest ${mealType} for ${date}: ${qty} guest meal(s) saved`
      );
    } catch (err) {
      showNotify(err.message, 'error');
    }
  };

  const guestList = useMemo(
    () =>
      Object.values(userGuests)
        .filter((g) => g.quantity > 0)
        .sort((a, b) => b.date.localeCompare(a.date) || a.mealType.localeCompare(b.mealType)),
    [userGuests]
  );

  // Monthly summary (regular ON meals + guest meals) for the displayed month
  const monthSummary = useMemo(() => {
    const prefix = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`;
    let lunch = 0, dinner = 0, guestLunch = 0, guestDinner = 0;
    Object.values(userMeals).forEach((m) => {
      if (m.selection !== 'ON') return;
      if (m.mealType === 'Lunch') lunch++;
      else dinner++;
    });
    Object.values(userGuests).forEach((g) => {
      if (!g.date.startsWith(prefix)) return;
      if (g.mealType === 'Lunch') guestLunch += g.quantity;
      else guestDinner += g.quantity;
    });
    const guest = guestLunch + guestDinner;
    return { lunch, dinner, guestLunch, guestDinner, guest, total: lunch + dinner + guest };
  }, [userMeals, userGuests, currentMonthDate]);

  // Password change submission
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPwd !== passwordForm.confirmPwd) {
      showNotify('New passwords do not match.', 'error');
      return;
    }
    if (passwordForm.newPwd.length < 6) {
      showNotify('Password must be at least 6 characters.', 'error');
      return;
    }
    try {
      await db.changeMyPassword(currentUser.userId, passwordForm.oldPwd, passwordForm.newPwd);
      showNotify('Password updated successfully!');
      setPasswordForm({ oldPwd: '', newPwd: '', confirmPwd: '' });
      setActiveTab('calendar');
    } catch (err) {
      showNotify(err.message, 'error');
    }
  };

  // Days in selected Month
  const monthDays = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const date = new Date(year, month, 1);
    const days = [];

    while (date.getMonth() === month) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

      days.push({ dateStr, dayNumber: dd, dayName });
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [currentMonthDate]);

  // Three month tabs: previous (view only), current, next
  const monthTabs = [-1, 0, 1].map((offset) => {
    const base = new Date();
    const date = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    return {
      offset,
      date,
      name: date.toLocaleDateString('en-US', { month: 'long' }),
      year: date.getFullYear(),
      tag: offset < 0 ? 'View only' : offset === 0 ? 'Current' : 'Next',
    };
  });
  const isViewingPreviousMonth =
    currentMonthDate.getFullYear() * 12 + currentMonthDate.getMonth() <
    new Date().getFullYear() * 12 + new Date().getMonth();

  return (
    <div className="space-y-6">
      {/* User Header Profile Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xl">
            {currentUser.fullName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{currentUser.fullName}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 capitalize">
                {currentUser.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              User ID: <span className="font-bold text-slate-700">{currentUser.userId}</span> • Flat No: <span className="font-bold text-slate-700">{currentUser.flatNumber}</span>
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'calendar' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" /> Meal Calendar
          </button>
          <button
            onClick={() => setActiveTab('guest')}
            className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'guest' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Utensils className="w-4 h-4" /> Guest Meal
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'password' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Key className="w-4 h-4" /> Password
          </button>
        </div>
      </div>

      {activeTab === 'calendar' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Calendar Header & Month Navigation */}
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {currentMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <p className="text-xs text-slate-500">
                Deadlines (BST): Lunch (Prev day {settings?.lunchDeadline || '23:59'}) | Dinner (Same day {settings?.dinnerDeadline || '14:00'})
              </p>
            </div>

            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              {monthTabs.map((t) => {
                const active =
                  currentMonthDate.getFullYear() === t.date.getFullYear() &&
                  currentMonthDate.getMonth() === t.date.getMonth();
                return (
                  <button
                    key={t.offset}
                    onClick={() => setCurrentMonthDate(t.date)}
                    className={`px-3 py-1.5 rounded-lg text-center transition ${
                      active ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block text-xs font-bold">{t.name}</span>
                    <span className={`block text-[10px] font-medium ${active ? 'text-slate-300' : 'text-slate-400'}`}>
                      {t.tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {isViewingPreviousMonth && (
            <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-100 text-xs font-semibold text-amber-700 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" /> Previous month is view only. Meals can be selected for the current and next month only.
            </div>
          )}

          {/* Monthly Summary (regular + guest meals) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-5 border-b border-slate-100">
            <div className="p-4 rounded-2xl border border-slate-200 bg-white">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Lunch (ON)</span>
              <span className="text-2xl font-extrabold text-slate-800">{monthSummary.lunch}</span>
            </div>
            <div className="p-4 rounded-2xl border border-slate-200 bg-white">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Dinner (ON)</span>
              <span className="text-2xl font-extrabold text-slate-800">{monthSummary.dinner}</span>
            </div>
            <div className="p-4 rounded-2xl border border-violet-300 bg-violet-50">
              <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wider block">Guest Meals</span>
              <span className="text-2xl font-extrabold text-violet-700">{monthSummary.guest}</span>
              <span className="text-[10px] font-semibold text-violet-600 block">
                Lunch {monthSummary.guestLunch} · Dinner {monthSummary.guestDinner}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 text-white">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Total Meals</span>
              <span className="text-2xl font-extrabold">{monthSummary.total}</span>
              <span className="text-[10px] font-medium text-slate-400 block">incl. guest meals</span>
            </div>
          </div>

          {/* Meal Calendar Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-6">Date & Day</th>
                  <th className="py-3 px-6 text-center">Lunch</th>
                  <th className="py-3 px-6 text-center">Dinner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {monthDays.map(({ dateStr, dayNumber, dayName }) => {
                  const lunchKey = `${dateStr}_Lunch`;
                  const dinnerKey = `${dateStr}_Dinner`;

                  const lunchRecord = userMeals[lunchKey];
                  const dinnerRecord = userMeals[dinnerKey];

                  const lunchVal = lunchRecord?.selection || 'OFF';
                  const dinnerVal = dinnerRecord?.selection || 'OFF';

                  const lunchLocked = isMealLocked(dateStr, 'Lunch', settings);
                  const dinnerLocked = isMealLocked(dateStr, 'Dinner', settings);

                  const isToday = getBSTYMD() === dateStr;
                  const lunchGuest = userGuests[`${dateStr}_Lunch`]?.quantity || 0;
                  const dinnerGuest = userGuests[`${dateStr}_Dinner`]?.quantity || 0;

                  return (
                    <tr key={dateStr} className={`hover:bg-slate-50/80 transition ${isToday ? 'bg-amber-50/40' : ''}`}>
                      {/* Date Column */}
                      <td className="py-3.5 px-6 font-medium">
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isToday ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {dayNumber}
                          </span>
                          <div>
                            <span className="text-slate-800 font-semibold block">{dayName}</span>
                            <span className="text-[10px] text-slate-400 font-normal">{dateStr}</span>
                          </div>
                        </div>
                      </td>

                      {/* Lunch Toggle Column */}
                      <td className={`py-3.5 px-6 text-center ${lunchGuest > 0 ? 'bg-violet-50/70' : ''}`}>
                        <div className="inline-flex flex-col items-center">
                          <button
                            disabled={lunchLocked}
                            onClick={() => handleToggleMeal(dateStr, 'Lunch', lunchVal)}
                            className={`relative px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs ${
                              lunchVal === 'ON'
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20'
                                : 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20'
                            } ${lunchLocked ? 'opacity-40 cursor-not-allowed shadow-none' : 'active:scale-95 cursor-pointer'}`}
                          >
                            {lunchVal === 'ON' ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            {lunchVal}
                          </button>

                          {/* Lock / Admin Changed Badges */}
                          {lunchRecord?.changedByAdmin && (
                            <span className="mt-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                              Changed by admin
                            </span>
                          )}
                          {lunchLocked && !lunchRecord?.changedByAdmin && (
                            <span className="mt-1 text-[9px] font-medium text-slate-400">Deadline passed</span>
                          )}
                          {lunchGuest > 0 && (
                            <span className="mt-1 text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-md border border-violet-300">
                              +{lunchGuest} Guest Meal{lunchGuest > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Dinner Toggle Column */}
                      <td className={`py-3.5 px-6 text-center ${dinnerGuest > 0 ? 'bg-violet-50/70' : ''}`}>
                        <div className="inline-flex flex-col items-center">
                          <button
                            disabled={dinnerLocked}
                            onClick={() => handleToggleMeal(dateStr, 'Dinner', dinnerVal)}
                            className={`relative px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs ${
                              dinnerVal === 'ON'
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20'
                                : 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20'
                            } ${dinnerLocked ? 'opacity-40 cursor-not-allowed shadow-none' : 'active:scale-95 cursor-pointer'}`}
                          >
                            {dinnerVal === 'ON' ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            {dinnerVal}
                          </button>

                          {/* Lock / Admin Changed Badges */}
                          {dinnerRecord?.changedByAdmin && (
                            <span className="mt-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                              Changed by admin
                            </span>
                          )}
                          {dinnerLocked && !dinnerRecord?.changedByAdmin && (
                            <span className="mt-1 text-[9px] font-medium text-slate-400">Deadline passed</span>
                          )}
                          {dinnerGuest > 0 && (
                            <span className="mt-1 text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-md border border-violet-300">
                              +{dinnerGuest} Guest Meal{dinnerGuest > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Guest Meal View */}
      {activeTab === 'guest' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs max-w-xl mx-auto space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Utensils className="w-4 h-4 text-violet-600" /> Order Guest Meal
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Same deadlines as regular meals (BST): Lunch (Prev day {settings?.lunchDeadline || '23:59'}) | Dinner (Same day {settings?.dinnerDeadline || '14:00'})
              </p>
            </div>

            {/* Step 1: date */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">1. Select Date</label>
              <input
                type="date"
                value={guestDate}
                min={getBSTYMD()}
                max={getMaxSelectableYMD()}
                onChange={(e) => setGuestDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
              />
              {guestDate && (
                <p className="text-xs text-slate-500 mt-1 font-medium">{formatDateLong(guestDate)}</p>
              )}
            </div>

            {/* Step 2: Lunch or Dinner */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">2. Choose Meal</label>
              <div className="grid grid-cols-2 gap-3">
                {['Lunch', 'Dinner'].map((type) => {
                  const typeLocked = !guestDate || isMealLocked(guestDate, type, settings);
                  const selected = guestMealType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={typeLocked}
                      onClick={() => setGuestMealType(type)}
                      className={`py-3 rounded-xl text-sm font-bold border transition flex flex-col items-center ${
                        selected && !typeLocked
                          ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      } ${typeLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {type}
                      {guestDate && typeLocked && (
                        <span className="text-[10px] font-medium">Deadline passed</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: number of guest meals */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">3. Number of Guest Meals</label>
              <div className="inline-flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  disabled={guestLocked || guestQty <= 1}
                  onClick={() => setGuestQty((q) => Math.max(1, q - 1))}
                  className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 disabled:opacity-40"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center text-lg font-extrabold text-violet-700">{guestQty}</span>
                <button
                  type="button"
                  disabled={guestLocked || guestQty >= 10}
                  onClick={() => setGuestQty((q) => Math.min(10, q + 1))}
                  className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {existingGuestQty > 0 && (
                <p className="text-xs text-violet-700 font-semibold mt-2">
                  Already ordered: {existingGuestQty} guest meal(s) for {guestMealType} on {guestDate}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={guestLocked}
                onClick={() => handleSaveGuestMeal(guestQty)}
                className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {existingGuestQty > 0 ? 'Update Guest Meal' : 'Order Guest Meal'}
              </button>
              {existingGuestQty > 0 && (
                <button
                  type="button"
                  disabled={guestLocked}
                  onClick={() => handleSaveGuestMeal(0)}
                  className="py-3 px-5 bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold rounded-xl text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Cancel Guest Meal
                </button>
              )}
            </div>
          </div>

          {/* My guest orders */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden max-w-xl mx-auto">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800">My Guest Meal Orders</h3>
            </div>
            {guestList.length === 0 ? (
              <p className="p-6 text-xs text-slate-500 text-center">No guest meals ordered yet.</p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Meal</th>
                    <th className="py-2.5 px-4 text-center">Guests</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {guestList.map((g) => {
                    const rowLocked = isMealLocked(g.date, g.mealType, settings);
                    return (
                      <tr key={g.id} className="bg-violet-50/40">
                        <td className="py-2.5 px-4 font-semibold text-slate-700">{formatDateLong(g.date)}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-600">{g.mealType}</td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-md border border-violet-300">
                            +{g.quantity}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {rowLocked ? (
                            <span className="text-[10px] text-slate-400">Locked</span>
                          ) : (
                            <button
                              onClick={() => handleSaveGuestMeal(0, g.date, g.mealType)}
                              className="text-[11px] font-bold text-rose-600 hover:underline"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Change Password View */}
      {activeTab === 'password' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs max-w-md mx-auto">
          <h3 className="text-base font-bold text-slate-800 mb-4">Security Settings</h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={passwordForm.oldPwd}
                onChange={(e) => setPasswordForm({ ...passwordForm, oldPwd: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={passwordForm.newPwd}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPwd: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={passwordForm.confirmPwd}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPwd: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition"
            >
              Update Password
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. ADMIN PORTAL COMPONENT
// ==========================================
function AdminPortal({ currentUser, dbTick, notifyDbUpdate, showNotify }) {
  const [adminTab, setAdminTab] = useState('dashboard'); // 'dashboard' | 'users' | 'meals' | 'audit' | 'settings'
  const [usersList, setUsersList] = useState([]);
  const [allMeals, setAllMeals] = useState([]);
  const [settings, setSettings] = useState({ lunchDeadline: '23:59', dinnerDeadline: '14:00', selectionWindowDays: 30, timezone: 'Asia/Dhaka' });
  const [auditLogs, setAuditLogs] = useState([]);

  // Admin Modals
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ userId: '', fullName: '', flatNumber: '', password: 'user123' });
  const [searchQuery, setSearchQuery] = useState('');

  // Selected date for Admin Meal Override View
  const [selectedAdminDate, setSelectedAdminDate] = useState(getBSTYMD());

  // Overview date (admin can look at past / future days)
  const [overviewDate, setOverviewDate] = useState(getBSTYMD());

  // User Summary tab
  const [allGuestMeals, setAllGuestMeals] = useState([]);
  const [summaryUserId, setSummaryUserId] = useState('');
  const [summaryYear, setSummaryYear] = useState(() => Number(getBSTYMD().slice(0, 4)));
  const [summaryMonth, setSummaryMonth] = useState(() => Number(getBSTYMD().slice(5, 7)) - 1); // 0-11

  // Admin changes own password
  const [adminPwdForm, setAdminPwdForm] = useState({ oldPwd: '', newPwd: '', confirmPwd: '' });
  const handleAdminChangePassword = async (e) => {
    e.preventDefault();
    if (adminPwdForm.newPwd !== adminPwdForm.confirmPwd) {
      showNotify('New passwords do not match.', 'error');
      return;
    }
    if (adminPwdForm.newPwd.length < 8) {
      showNotify('Admin password must be at least 8 characters.', 'error');
      return;
    }
    try {
      await db.changeMyPassword(currentUser.userId, adminPwdForm.oldPwd, adminPwdForm.newPwd);
      showNotify('Admin password updated successfully!');
      setAdminPwdForm({ oldPwd: '', newPwd: '', confirmPwd: '' });
    } catch (err) {
      showNotify(err.message, 'error');
    }
  };

  // Load All Admin Data
  useEffect(() => {
    db.fetchUsers().then(setUsersList).catch(() => {});
    db.fetchAllMeals().then(setAllMeals).catch(() => {});
    db.fetchSettings().then(setSettings).catch(() => {});
    db.fetchAuditLogs().then(setAuditLogs).catch(() => {});
    db.fetchAllGuestMeals().then(setAllGuestMeals).catch(() => {});
  }, [dbTick]);

  // Log Audit Action
  const logAuditAction = async (targetUserId, action, oldValue, newValue) => {
    await db.addAuditLog({
      adminId: currentUser.userId,
      targetUserId,
      action,
      oldValue,
      newValue,
      timestamp: getBSTFormattedNow()
    });
  };

  // Stats Calculations
  const stats = useMemo(() => {
    const activeUsers = usersList.filter(u => u.role === 'user' && u.status === 'active');
    const todayMeals = allMeals.filter(m => m.date === overviewDate);

    let lunchOn = 0, lunchOff = 0, dinnerOn = 0, dinnerOff = 0;
    let guestLunch = 0, guestDinner = 0;
    const answeredUsers = new Set();
    allGuestMeals.forEach(g => {
      if (g.date !== overviewDate) return;
      if (g.mealType === 'Lunch') guestLunch += g.quantity;
      else guestDinner += g.quantity;
    });

    todayMeals.forEach(m => {
      answeredUsers.add(m.userId);
      if (m.mealType === 'Lunch') {
        if (m.selection === 'ON') lunchOn++;
        else lunchOff++;
      }
      if (m.mealType === 'Dinner') {
        if (m.selection === 'ON') dinnerOn++;
        else dinnerOff++;
      }
    });

    const pendingCount = activeUsers.length - answeredUsers.size;

    return {
      totalActive: activeUsers.length,
      lunchOn,
      lunchOff,
      dinnerOn,
      dinnerOff,
      guestLunch,
      guestDinner,
      pendingCount: pendingCount < 0 ? 0 : pendingCount
    };
  }, [usersList, allMeals, allGuestMeals, overviewDate]);

  // ----- User Summary (read-only monthly view) -----
  const userOptions = usersList.filter(u => u.role === 'user');
  const summaryUser = userOptions.find(u => u.userId === summaryUserId) || userOptions[0] || null;
  const summaryPrefix = `${summaryYear}-${String(summaryMonth + 1).padStart(2, '0')}`;
  const summaryDays = useMemo(() => getMonthDays(summaryYear, summaryMonth), [summaryYear, summaryMonth]);

  const userSummary = useMemo(() => {
    if (!summaryUser) return null;
    const meals = {};
    allMeals.forEach(m => {
      if (m.userId === summaryUser.userId && m.date.startsWith(summaryPrefix)) {
        meals[`${m.date}_${m.mealType}`] = m;
      }
    });
    const guests = {};
    allGuestMeals.forEach(g => {
      if (g.userId === summaryUser.userId && g.date.startsWith(summaryPrefix) && g.quantity > 0) {
        guests[`${g.date}_${g.mealType}`] = g;
      }
    });
    let lunch = 0, dinner = 0, guestLunch = 0, guestDinner = 0;
    Object.values(meals).forEach(m => {
      if (m.selection !== 'ON') return;
      if (m.mealType === 'Lunch') lunch++;
      else dinner++;
    });
    Object.values(guests).forEach(g => {
      if (g.mealType === 'Lunch') guestLunch += g.quantity;
      else guestDinner += g.quantity;
    });
    const guest = guestLunch + guestDinner;
    return { meals, guests, lunch, dinner, guestLunch, guestDinner, guest, total: lunch + dinner + guest };
  }, [summaryUser, summaryPrefix, allMeals, allGuestMeals]);

  const shiftSummaryMonth = (delta) => {
    const d = new Date(summaryYear, summaryMonth + delta, 1);
    setSummaryYear(d.getFullYear());
    setSummaryMonth(d.getMonth());
  };

  // Create New User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    const userId = newUserForm.userId.trim();
    if (usersList.some(u => u.userId.toLowerCase() === userId.toLowerCase())) {
      showNotify('User ID already exists!', 'error');
      return;
    }

    try {
      await db.adminCall({
        action: 'create',
        userId,
        fullName: newUserForm.fullName.trim(),
        flatNumber: newUserForm.flatNumber.trim(),
        password: newUserForm.password
      });
      await logAuditAction(userId, 'USER_CREATED', 'None', `Created flat ${newUserForm.flatNumber.trim()}`);
      notifyDbUpdate();
      showNotify(`User ${newUserForm.fullName.trim()} added successfully`);
      setIsAddUserOpen(false);
      setNewUserForm({ userId: '', fullName: '', flatNumber: '', password: 'user123' });
    } catch (err) {
      showNotify(err.message, 'error');
    }
  };

  // Toggle User Activation Status (Deactivate / Activate)
  const handleToggleUserStatus = async (user) => {
    const newStatus = user.status === 'active' ? 'deactivated' : 'active';
    try {
      await db.setUserStatus(user.id, newStatus);
      await logAuditAction(user.userId, 'STATUS_CHANGED', user.status, newStatus);
      notifyDbUpdate();
      showNotify(`User ${user.fullName} is now ${newStatus}`);
    } catch (err) {
      showNotify(err.message, 'error');
    }
  };

  // Permanently Delete User Account and Meal History
  const handleDeleteUser = async (user) => {
    const confirmed = window.confirm(`Are you sure you want to permanently delete user "${user.fullName}" (${user.userId})? This will also remove all associated meal records.`);
    if (!confirmed) return;

    try {
      await db.adminCall({ action: 'delete', id: user.id });
      await logAuditAction(user.userId, 'USER_DELETED', `Full Name: ${user.fullName}`, 'Permanently Removed');
      notifyDbUpdate();
      showNotify(`User ${user.fullName} has been permanently deleted.`, 'info');
    } catch (err) {
      showNotify(err.message, 'error');
    }
  };

  // Reset Password for User
  const handleResetUserPassword = async (user) => {
    const newPwd = prompt(`Enter new password for ${user.fullName} (min 6 characters):`, '123456');
    if (!newPwd) return;

    try {
      await db.adminCall({ action: 'reset_password', id: user.id, password: newPwd });
      await logAuditAction(user.userId, 'PASSWORD_RESET', '***', '***');
      notifyDbUpdate();
      showNotify(`Password reset for ${user.fullName}`);
    } catch (err) {
      showNotify(err.message, 'error');
    }
  };

  // Admin Override User Meal
  const handleAdminMealOverride = async (userId, mealType, currentSelection) => {
    const target = usersList.find(u => u.userId === userId);
    if (!target) return;
    const newSel = currentSelection === 'ON' ? 'OFF' : 'ON';

    try {
      await db.upsertMeal(target.id, selectedAdminDate, mealType, newSel);
      await logAuditAction(userId, 'MEAL_OVERRIDE', currentSelection || 'NONE', `${mealType}:${newSel}`);
      notifyDbUpdate();
      showNotify(`Admin override applied: ${mealType} set to ${newSel}`);
    } catch (err) {
      showNotify(err.message, 'error');
    }
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await db.saveSettings(settings);
      await logAuditAction('SYSTEM', 'SETTINGS_UPDATED', 'Previous Config', JSON.stringify(settings));
      notifyDbUpdate();
      showNotify('Deadline settings updated successfully');
    } catch (err) {
      showNotify(err.message, 'error');
    }
  };

  // Filtered User list
  const filteredUsers = useMemo(() => {
    return usersList.filter(u => 
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.flatNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [usersList, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Admin Navigation Bar */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap gap-2">
        <button
          onClick={() => setAdminTab('dashboard')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            adminTab === 'dashboard' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Shield className="w-4 h-4" /> Overview
        </button>
        <button
          onClick={() => setAdminTab('users')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            adminTab === 'users' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" /> Users Management
        </button>
        <button
          onClick={() => setAdminTab('meals')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            adminTab === 'meals' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" /> Meal Override & History
        </button>
        <button
          onClick={() => setAdminTab('summary')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            adminTab === 'summary' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ClipboardList className="w-4 h-4" /> User Summary
        </button>
        <button
          onClick={() => setAdminTab('audit')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            adminTab === 'audit' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Info className="w-4 h-4" /> Audit Logs
        </button>
        <button
          onClick={() => setAdminTab('settings')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            adminTab === 'settings' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-4 h-4" /> System Settings
        </button>
        <button
          onClick={() => setAdminTab('password')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            adminTab === 'password' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Key className="w-4 h-4" /> My Password
        </button>
      </div>

      {/* 1. ADMIN DASHBOARD OVERVIEW */}
      {adminTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {overviewDate === getBSTYMD()
                  ? "Today's Real-Time Summary"
                  : overviewDate < getBSTYMD()
                    ? 'Past Day Summary'
                    : 'Upcoming Day Summary'}
              </h2>
              <p className="text-xs text-slate-500">
                {overviewDate === getBSTYMD() ? 'Live statistics' : 'Statistics'} for {overviewDate}
              </p>
            </div>

            {/* Date selector: shows e.g. "4 November 2026" */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs self-start md:self-auto">
              <button
                onClick={() => setOverviewDate(shiftYMD(overviewDate, -1))}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition"
                title="Previous day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="relative">
                <div className="px-3 py-1.5 text-sm font-bold text-slate-800 flex items-center justify-center gap-2 min-w-[11rem]">
                  <Calendar className="w-4 h-4 text-emerald-600" /> {formatDateLong(overviewDate)}
                </div>
                <input
                  type="date"
                  value={overviewDate}
                  onChange={(e) => e.target.value && setOverviewDate(e.target.value)}
                  onClick={(e) => {
                    try { e.currentTarget.showPicker(); } catch (_) { /* ignore */ }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Pick a date"
                />
              </div>
              <button
                onClick={() => setOverviewDate(shiftYMD(overviewDate, 1))}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition"
                title="Next day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {overviewDate !== getBSTYMD() && (
                <button
                  onClick={() => setOverviewDate(getBSTYMD())}
                  className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-md transition"
                >
                  Today
                </button>
              )}
            </div>

            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 self-start md:self-auto">
              ● Live Sync
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Active Users</span>
              <span className="text-3xl font-extrabold text-slate-800">{stats.totalActive}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-1">Lunch ON</span>
              <span className="text-3xl font-extrabold text-emerald-600">{stats.lunchOn}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-rose-500 uppercase tracking-wider block mb-1">Lunch OFF</span>
              <span className="text-3xl font-extrabold text-rose-500">{stats.lunchOff}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-1">Dinner ON</span>
              <span className="text-3xl font-extrabold text-emerald-600">{stats.dinnerOn}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-rose-500 uppercase tracking-wider block mb-1">Dinner OFF</span>
              <span className="text-3xl font-extrabold text-rose-500">{stats.dinnerOff}</span>
            </div>
          </div>

          {/* Guest meals + total meals to prepare for the selected date */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl border border-violet-300 bg-violet-50">
              <span className="text-xs font-bold text-violet-700 uppercase tracking-wider block mb-1">Guest Lunch</span>
              <span className="text-3xl font-extrabold text-violet-700">{stats.guestLunch}</span>
            </div>
            <div className="p-5 rounded-2xl border border-violet-300 bg-violet-50">
              <span className="text-xs font-bold text-violet-700 uppercase tracking-wider block mb-1">Guest Dinner</span>
              <span className="text-3xl font-extrabold text-violet-700">{stats.guestDinner}</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 text-white">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1">Total Lunch</span>
              <span className="text-3xl font-extrabold">{stats.lunchOn + stats.guestLunch}</span>
              <span className="text-[10px] text-slate-400 block">ON + guests</span>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900 text-white">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1">Total Dinner</span>
              <span className="text-3xl font-extrabold">{stats.dinnerOn + stats.guestDinner}</span>
              <span className="text-[10px] text-slate-400 block">ON + guests</span>
            </div>
          </div>

          {/* Pending Response Notice */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" /> Pending Submissions {overviewDate === getBSTYMD() ? 'Today' : 'for this date'}: {stats.pendingCount} User(s)
            </h3>
            <p className="text-xs text-slate-500">
              Users who haven't explicitly set their meal choices for this date will default to OFF when deadlines expire.
            </p>
          </div>
        </div>
      )}

      {/* 2. USER MANAGEMENT */}
      {adminTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search name, ID, flat..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <button
              onClick={() => setIsAddUserOpen(true)}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
            >
              <UserPlus className="w-4 h-4" /> Add New User
            </button>
          </div>

          {/* Add User Modal */}
          {isAddUserOpen && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white p-6 rounded-3xl max-w-md w-full shadow-2xl border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-800">Create New Resident Profile</h3>
                  <button onClick={() => setIsAddUserOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Unique User ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. usr106"
                      value={newUserForm.userId}
                      onChange={(e) => setNewUserForm({ ...newUserForm, userId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Abdullah Khan"
                      value={newUserForm.fullName}
                      onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Flat Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 6B"
                      value={newUserForm.flatNumber}
                      onChange={(e) => setNewUserForm({ ...newUserForm, flatNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Initial Password</label>
                    <input
                      type="text"
                      required
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddUserOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700"
                    >
                      Create Account
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* User List Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-6">Resident Details</th>
                    <th className="py-3 px-6">Flat</th>
                    <th className="py-3 px-6">Role</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-6 font-medium">
                        <span className="text-slate-800 font-bold block">{user.fullName}</span>
                        <span className="text-[10px] text-slate-400">ID: {user.userId}</span>
                      </td>
                      <td className="py-3.5 px-6 font-semibold text-slate-700">{user.flatNumber}</td>
                      <td className="py-3.5 px-6 capitalize">{user.role}</td>
                      <td className="py-3.5 px-6">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          user.status === 'active' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {user.status}
                        </span>
                        {user.deactivatedAt && (
                          <span className="block text-[9px] text-rose-500 mt-0.5">
                            Auto-cleanup scheduled in 30d
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right space-x-2">
                        {user.role !== 'admin' && (
                          <>
                            <button
                              onClick={() => handleResetUserPassword(user)}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                            >
                              Reset Pwd
                            </button>
                            <button
                              onClick={() => handleToggleUserStatus(user)}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
                                user.status === 'active'
                                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              {user.status === 'active' ? 'Deactivate' : 'Reactivate'}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition"
                              title="Permanently remove user"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. MEAL OVERRIDE & MANAGEMENT */}
      {adminTab === 'meals' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-800">Admin Meal Override Control</h3>
              <p className="text-xs text-slate-500">Modify selections for any date regardless of deadlines</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500">Select Date:</label>
              <input
                type="date"
                value={selectedAdminDate}
                onChange={(e) => setSelectedAdminDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-6">User</th>
                  <th className="py-3 px-6">Flat</th>
                  <th className="py-3 px-6 text-center">Lunch ({selectedAdminDate})</th>
                  <th className="py-3 px-6 text-center">Dinner ({selectedAdminDate})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {usersList.filter(u => u.role === 'user').map(user => {
                  const lunchRecord = allMeals.find(m => m.userId === user.userId && m.date === selectedAdminDate && m.mealType === 'Lunch');
                  const dinnerRecord = allMeals.find(m => m.userId === user.userId && m.date === selectedAdminDate && m.mealType === 'Dinner');

                  const lunchVal = lunchRecord?.selection || 'OFF';
                  const dinnerVal = dinnerRecord?.selection || 'OFF';

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-6 font-semibold text-slate-800">{user.fullName} ({user.userId})</td>
                      <td className="py-3.5 px-6 font-medium text-slate-600">{user.flatNumber}</td>
                      
                      {/* Lunch Toggle */}
                      <td className="py-3.5 px-6 text-center">
                        <button
                          onClick={() => handleAdminMealOverride(user.userId, 'Lunch', lunchVal)}
                          className={`px-4 py-1.5 rounded-xl font-bold text-xs transition ${
                            lunchVal === 'ON' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                          }`}
                        >
                          {lunchVal} {lunchRecord?.changedByAdmin ? '(Admin Override)' : ''}
                        </button>
                      </td>

                      {/* Dinner Toggle */}
                      <td className="py-3.5 px-6 text-center">
                        <button
                          onClick={() => handleAdminMealOverride(user.userId, 'Dinner', dinnerVal)}
                          className={`px-4 py-1.5 rounded-xl font-bold text-xs transition ${
                            dinnerVal === 'ON' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                          }`}
                        >
                          {dinnerVal} {dinnerRecord?.changedByAdmin ? '(Admin Override)' : ''}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3b. USER SUMMARY (read-only) */}
      {adminTab === 'summary' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">User Meal Summary</h3>
              <p className="text-xs text-slate-500">Read-only monthly view of one user's meals and guest meals</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">User ID</label>
                <select
                  value={summaryUser?.userId || ''}
                  onChange={(e) => setSummaryUserId(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-slate-900"
                >
                  {userOptions.map(u => (
                    <option key={u.id} value={u.userId}>
                      {u.userId} — {u.fullName} (Flat {u.flatNumber})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Month</label>
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => shiftSummaryMonth(-1)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition"
                    title="Previous month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <select
                    value={summaryMonth}
                    onChange={(e) => setSummaryMonth(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg text-xs font-bold bg-transparent focus:outline-none"
                  >
                    {MONTH_NAMES.map((name, i) => (
                      <option key={name} value={i}>{name}</option>
                    ))}
                  </select>
                  <select
                    value={summaryYear}
                    onChange={(e) => setSummaryYear(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg text-xs font-bold bg-transparent focus:outline-none"
                  >
                    {Array.from({ length: 5 }, (_, i) => Number(getBSTYMD().slice(0, 4)) - 3 + i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => shiftSummaryMonth(1)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition"
                    title="Next month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {!summaryUser || !userSummary ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-200/80 text-center text-xs text-slate-500">
              No users found. Add a user first.
            </div>
          ) : (
            <>
              {/* Totals row for the month */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-1">Total Lunch (ON)</span>
                  <span className="text-3xl font-extrabold text-slate-800">{userSummary.lunch}</span>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-1">Total Dinner (ON)</span>
                  <span className="text-3xl font-extrabold text-slate-800">{userSummary.dinner}</span>
                </div>
                <div className="p-5 rounded-2xl border border-violet-300 bg-violet-50">
                  <span className="text-xs font-bold text-violet-700 uppercase tracking-wider block mb-1">Guest Meals</span>
                  <span className="text-3xl font-extrabold text-violet-700">{userSummary.guest}</span>
                  <span className="text-[10px] font-semibold text-violet-600 block">
                    Lunch {userSummary.guestLunch} · Dinner {userSummary.guestDinner}
                  </span>
                </div>
                <div className="p-5 rounded-2xl bg-slate-900 text-white">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1">Total Meals</span>
                  <span className="text-3xl font-extrabold">{userSummary.total}</span>
                  <span className="text-[10px] text-slate-400 block">
                    {MONTH_NAMES[summaryMonth]} {summaryYear} · incl. guest meals
                  </span>
                </div>
              </div>

              {/* Day-by-day table (read-only) */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-6">Date & Day</th>
                        <th className="py-3 px-6 text-center">Lunch</th>
                        <th className="py-3 px-6 text-center">Dinner</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {summaryDays.map(({ dateStr, dayNumber, dayName }) => {
                        const isToday = getBSTYMD() === dateStr;
                        const cells = ['Lunch', 'Dinner'].map(type => {
                          const rec = userSummary.meals[`${dateStr}_${type}`];
                          const guestQty = userSummary.guests[`${dateStr}_${type}`]?.quantity || 0;
                          return { type, val: rec?.selection || 'OFF', changed: rec?.changedByAdmin, guestQty };
                        });
                        const hasGuest = cells.some(c => c.guestQty > 0);
                        return (
                          <tr key={dateStr} className={`transition ${isToday ? 'bg-amber-50/40' : hasGuest ? 'bg-violet-50/40' : ''}`}>
                            <td className="py-3.5 px-6 font-medium">
                              <div className="flex items-center gap-3">
                                <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                                  isToday ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {dayNumber}
                                </span>
                                <div>
                                  <span className="text-slate-800 font-semibold block">{dayName}</span>
                                  <span className="text-[10px] text-slate-400 font-normal">{dateStr}</span>
                                </div>
                              </div>
                            </td>
                            {cells.map(c => (
                              <td key={c.type} className={`py-3.5 px-6 text-center ${c.guestQty > 0 ? 'bg-violet-50/70' : ''}`}>
                                <div className="inline-flex flex-col items-center">
                                  <span className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold ${
                                    c.val === 'ON' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                                  }`}>
                                    {c.val === 'ON' ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                                    {c.val}
                                  </span>
                                  {c.changed && (
                                    <span className="mt-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                                      Changed by admin
                                    </span>
                                  )}
                                  {c.guestQty > 0 && (
                                    <span className="mt-1 text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-md border border-violet-300">
                                      +{c.guestQty} Guest Meal{c.guestQty > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 4. AUDIT LOGS */}
      {adminTab === 'audit' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-800">System Audit Trail</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp (BST)</th>
                  <th className="py-3 px-4">Admin ID</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target User</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono text-slate-500">{log.timestamp}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{log.adminId}</td>
                    <td className="py-3 px-4 font-semibold text-emerald-700">{log.action}</td>
                    <td className="py-3 px-4 text-slate-600">{log.targetUserId}</td>
                    <td className="py-3 px-4 text-slate-500">{log.oldValue} ➔ {log.newValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. DEADLINE SETTINGS */}
      {adminTab === 'settings' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs max-w-lg mx-auto">
          <h3 className="text-base font-bold text-slate-800 mb-4">Deadline & Policy Settings</h3>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Lunch Deadline Time (Prev Day)
              </label>
              <input
                type="time"
                value={settings.lunchDeadline}
                onChange={(e) => setSettings({ ...settings, lunchDeadline: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold"
              />
              <p className="text-[11px] text-slate-400 mt-1">Default 23:59 (11:59 PM BST previous day)</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Dinner Deadline Time (Same Day)
              </label>
              <input
                type="time"
                value={settings.dinnerDeadline}
                onChange={(e) => setSettings({ ...settings, dinnerDeadline: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold"
              />
              <p className="text-[11px] text-slate-400 mt-1">Default 14:00 (02:00 PM BST same day)</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Timezone Verification
              </label>
              <input
                type="text"
                disabled
                value="Asia/Dhaka (UTC+6)"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 text-sm font-bold"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition"
            >
              Save Configuration
            </button>
          </form>
        </div>
      )}

      {/* 6. ADMIN OWN PASSWORD */}
      {adminTab === 'password' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs max-w-md mx-auto">
          <h3 className="text-base font-bold text-slate-800 mb-4">Change Admin Password</h3>
          <form onSubmit={handleAdminChangePassword} className="space-y-4">
            {[
              ['Current Password', 'oldPwd'],
              ['New Password (min 8 characters)', 'newPwd'],
              ['Confirm New Password', 'confirmPwd'],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  {label}
                </label>
                <input
                  type="password"
                  required
                  value={adminPwdForm[key]}
                  onChange={(e) => setAdminPwdForm({ ...adminPwdForm, [key]: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            ))}
            <button
              type="submit"
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition"
            >
              Update Password
            </button>
          </form>
        </div>
      )}
    </div>
  );
}