# Darty Golf

A mobile-first scorer for the darts game Golf. Play holes 1–18 (or a quick front nine), throw up to three darts per hole, and remember: only the latest dart counts.

## Features

- Solo and team modes
- Authentic last-dart-counts mulligan mechanic
- Seven-result house scoring system
- Live scorecard, par tracking, winners and ties
- Automatic recovery of the current round on the scoring device
- Google Sheets persistence backend ready for Apps Script deployment
- GitHub Pages deployment workflow

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

See `apps-script/README.md` to connect the provided Darty Golf Google Sheet.
