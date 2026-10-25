# Beehive web app

Static HTML/CSS/JS. No build step. Deploy this folder (Vercel: Root Directory `beehive-demo`, Framework **Other**).

- **Live mode:** sign in with a Supabase account (demo logins in the main README). Requires the migrations and `supabase/seed_demo.sql`.
- **Offline demo:** "Explore the offline demo instead" on the sign-in screen. Uses browser storage only.

`config.js` holds the Supabase URL, the publishable key (public by design) and the optional Copilot Studio token endpoint. Never put a secret / service_role key here.

Do not enter real child medical information. SMS/email delivery and reading dates from certificate photos are simulated.
