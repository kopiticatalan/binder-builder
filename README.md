# Binder Builder

Court compilation for Indian practice. Cover, index, merged PDFs, pagination and bookmarks — built in the browser, stored on this device.

**Open the app:** [https://kopiticatalan.github.io/binder-builder/](https://kopiticatalan.github.io/binder-builder/)

Windows Phone–era Start tiles. Templates for NCLT, NCLAT, Bombay High Court, SAT and the Supreme Court.

## What it does

- **Cover and index** — cause title, parties, page ranges, optional hyperlinks
- **Papers** — drop PDFs, crop ranges, star authorities, kind tags
- **Build** — merge, stamp, bookmarks, optional volume split and divider sheets
- **Hearing mode** — full-screen deck of starred authorities with pinpoints and speaking notes
- **Chronology and table of authorities** — export as Word
- **Limitation desk** — working calculator for common Indian windows (not legal advice)
- **Backup zip** — take the matter to another machine

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

GitHub Pages build:

```bash
npm run build:pages
```
