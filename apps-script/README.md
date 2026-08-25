# Darty Golf Google Sheets service

The Darty Golf spreadsheet stores one row per completed game and one row per competitor/hole score.

1. Open the Darty Golf Google Sheet.
2. Choose **Extensions → Apps Script**.
3. Copy in `Code.gs` and `appsscript.json`.
4. Run `setupDartyGolf` once and approve access.
5. Deploy as a web app, executing as the owner and allowing anyone with the URL.
6. Put the `/exec` URL into `DARTY_GOLF_API_URL` in `src/services/golfApi.ts`.

The live app still works offline before this connection is made; its current round is saved on the scoring device.
