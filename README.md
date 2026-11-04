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
- Google Sheets backend (Apps Script) that validates every game and blocks formula injection
- Deploys to GitHub Pages automatically on every push to `main`

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

## Deploying

Pushing to `main` runs `.github/workflows/deploy-pages.yml`, which builds the app and publishes it to GitHub Pages. There's nothing to build or commit by hand.

The Google Sheets backend is **not** deployed by GitHub. After changing `apps-script/Code.gs`, paste it into the Apps Script editor and publish a new version of the existing deployment (see `apps-script/README.md`).
