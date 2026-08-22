# Binder Builder

Chambers desk for Indian practice. One matter is the case file — parties, listing, tasks, notes. The binder is optional papers for a hearing.

**Open the app:** [https://kopiticatalan.github.io/binder-builder/](https://kopiticatalan.github.io/binder-builder/)

Windows Phone–era Start tiles. Nothing leaves this device.

## What it does

- **Docket** — parties, court, case number, next listing, stage, status
- **Board** — listings you diary’d, in date order; calendar (.ics) export
- **Tasks** — next steps across matters
- **Hearing notes and orders** — on the docket
- **Binder** — cover, index, drop PDFs, merge, stamp, bookmarks, volume split
- **Hearing mode** — live PDF pages of starred authorities, pinpoints, speaking notes
- **Chronology and table of authorities** — export as Word
- **Limitation desk** — working calculator for common Indian windows (not legal advice)
- **Backup zip** — take the matter to another machine

The board is your diary, not a scraped cause list. Court-website lookup is not on this public page.

PDFs never leave the device except when you tap an optional AI action (clean caption, read cite, holding, draft). AI actions need a server and are unavailable on the GitHub Pages build.

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

GitHub Pages build (this public site):

```bash
npm run build:pages
```
