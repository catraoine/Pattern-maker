# Maison Tracé

Sewing patterns drafted from your own measurements. Installable web app (PWA), hosted on Netlify.

## Crash reports, visit counts and sign-ups

The app sends one small request per visit (when the tab is hidden or closed) to `/.netlify/functions/report`, with
anonymous daily counts (visits; measured, styled, printed, photo, per garment) and any crash reports (at most five per
visit, each error once). No cookies, ids or IP addresses are stored. The "Be a fit tester" and "News" forms in the
footer post to `/.netlify/functions/signup`. Everything is kept in Netlify Blobs (stores `reports` and `signups`).

To read it all, set a read-out key:

1. In Netlify, open the site, then **Site configuration > Environment variables > Add a variable**.
2. Key `STATS_KEY`, value a long random string (for example from `openssl rand -hex 24`). Keep it private.
3. Redeploy (**Deploys > Trigger deploy**) so the function picks it up.
4. Open `https://<your-site>/.netlify/functions/report?key=<STATS_KEY>` (add `&days=90` for up to 90 days).

It returns JSON: `days` (daily totals), `crashes` (the latest 100 crash reports) and `signups` (`testers`, `news`).
Without `STATS_KEY` set, the read-out is refused.
