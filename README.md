# Darty Golf

A mobile-first scorer for the darts game Golf. Play holes 1–18 (or a quick front nine), throw up to three darts per hole, and remember: only the latest dart counts.

**Play:** https://manaiakalani-matt.github.io/darty-golf/

## Features

- Solo and group play (up to 8 players passing one phone)
- Authentic last-dart-counts mulligan mechanic
- Seven-result house scoring system, scored by tapping a dartboard
- Live scorecard, undo, winners and ties
- **Never loses a round:** every throw is saved on the phone, so a reload or crash offers "Resume round"
- **Never loses a result:** finished rounds wait on the phone until the Google Sheet confirms them, then upload automatically when the connection returns
- Records page with top-5 leaderboards for Front 9 and Full 18
- Cloudflare Worker + D1 database backend that checks every game before saving it
- App deploys to GitHub Pages, and the API to Cloudflare, automatically on push to `main`

## Local development

```bash
npm install
npm run dev
```

## Verify

```bash
npm test
npm run typecheck
npm run build
```

## Backend (Cloudflare)

The API lives in `worker/` and runs at `https://darty-golf-api.mattsdarts.workers.dev`. Rounds are stored in the `darty-golf` D1 database; the tables are defined in `migrations/`.

| Request | Does |
|---|---|
| `GET ?action=records` | Every finished round, newest first |
| `POST {"action":"saveGame","game":{…}}` | Checks and saves a finished round. Saving the same round twice changes nothing. |

Only the live site and local dev servers can call the API from a browser.

```bash
npx wrangler d1 migrations apply darty-golf --local   # once, to create the local database
npm run worker:dev                                    # local API on http://localhost:8787
npm run worker:test:integration                       # end-to-end checks against the local API
```

## Deploying

- **App:** pushing to `main` runs `deploy-pages.yml`, which builds the app and publishes it to GitHub Pages.
- **API:** pushing changes under `worker/`, `migrations/` or `wrangler.jsonc` to `main` runs `deploy-worker.yml`, which tests, applies new database migrations and deploys the Worker. This needs a `CLOUDFLARE_API_TOKEN` repository secret: a Cloudflare API token with **Workers Scripts: Edit** and **D1: Edit** on the account. Without it, the workflow skips the deploy and leaves a warning. To deploy by hand instead: `npx wrangler login`, then `npm run worker:deploy`.

## Google Sheets (previous backend)

Until 4 Nov 2026 rounds were saved to a Google Sheet through Apps Script (`apps-script/`). All 18 rounds were copied to Cloudflare with `scripts/import-from-sheets.mjs`, which checks every round hole by hole and is safe to run again. The Apps Script is no longer used by the app but is left running as a fallback.
