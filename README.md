# Meal Hisab

React + Vite + Tailwind frontend, Supabase (database/auth), GitHub Pages hosting.

## শুরু করার ধাপ (Quick start)

1. ফোল্ডারে `.env.local` ফাইল বানান (`.env.example` দেখুন):
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxx
   ```
2. Terminal এ (এই ফোল্ডারের ভেতরে, যেখানে package.json আছে):
   ```
   npm install
   npm run dev
   ```
3. ব্রাউজারে: http://localhost:5173/meal-app/

## Supabase (একবারই)
`supabase/schema.sql` → `supabase/guest_meals.sql` → SQL Editor এ Run।
Edge Function: `supabase/functions/admin-users/index.ts` (নাম `admin-users`)।

## Deploy
GitHub repo নাম `meal-app` হলে `vite.config.js` এর `base: '/meal-app/'` ঠিক আছে।
Repo → Settings → Secrets → Actions: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`।
Settings → Pages → Source: GitHub Actions।
