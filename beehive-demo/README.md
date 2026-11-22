# Beehive web app

Static HTML/CSS/JS. No build step. Deploy this folder (Vercel: Root Directory `beehive-demo`, Framework **Other**).

- **Live mode:** sign in with a Supabase account (demo logins in the main README). Requires the migrations and `supabase/seed_demo.sql`.
- **Offline demo:** "Explore the offline demo instead" on the sign-in screen. Uses browser storage only.

`config.js` holds the Supabase URL and the publishable key (public by design). AI settings live in Vercel's environment variables. Never put a secret / service_role key here.

Do not enter real child medical information. SMS is simulated.

## Renewal emails (real)

The staff agent records its automatic renewal requests and follow-ups without sending them, so a check never emails the whole staff list. When the owner presses **Send reminder now** on a credential, beehive emails that reminder for real, with the educator's secure upload link, through `api/email.js` and [Resend](https://resend.com).

Set these in Vercel → Settings → Environment Variables, then redeploy:

| Variable | |
|---|---|
| `RESEND_API_KEY` | Required. Resend → API Keys. Never commit it. |
| `DEMO_EMAIL_TO` | Optional. Sends every email to this inbox instead of the educator's. Needed for the offline sample data (its educators aren't real), and for Resend's free plan without a verified domain, which only delivers to the address you signed up with. |
| `EMAIL_FROM` | Optional. e.g. `beehive <reminders@yourdomain.com>` once your domain is verified in Resend. Default `beehive <onboarding@resend.dev>`. |

Signed in, the email goes to the educator's address on file and the server reads the reminder back with the owner's session, so it can only send reminders from the owner's own centre. Without `RESEND_API_KEY`, reminders stay recorded-only and the owner is told why.

The owner can also add a renewed certificate on an educator's record (Staff → educator → **Add document**): beehive reads the photo or PDF in the browser and fills in the type, number and dates, and the register updates straight away.
