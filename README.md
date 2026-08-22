# Binder Builder

Chambers desk for Indian practice. One matter is the case file — parties, listing, tasks, notes, court orders. The binder is optional papers for a hearing.

Windows Phone–era Start tiles. Matters and PDFs stay on this device.

**Open in the browser:** [https://kopiticatalan.github.io/binder-builder/](https://kopiticatalan.github.io/binder-builder/)

**Mac app (court fetch works here):** [Download Binder Builder for Mac](https://kopiticatalan.github.io/binder-builder/Binder-Builder-for-Mac.zip)

Unzip, drag **Binder Builder** into Applications, then right-click → Open. Needs [Node.js LTS](https://nodejs.org). First launch installs the rest (a couple of minutes, online). Apple Silicon.

The public web page is a static preview. Bombay High Court / SAT / NCLT lookup, cause-list scan and order PDFs need the Mac app (or `npm run dev` on this repo).

## What it does

- **From court** — live lookup on Bombay High Court, SAT and NCLT (parties, next date, orders)
- **Orders** — download the PDFs onto this device; they drop into the binder
- **Cause lists** — scan published boards, add a listed case into the practice
- **Watch list** — surface matters where named firms appear
- **Docket** — parties, court, case number, next listing, stage, status, refresh
- **Board** — scraped lists plus diary dates; calendar (.ics) export
- **Tasks** — next steps across matters
- **Hearing notes and hearing brief** — on the docket
- **Binder** — cover, index, drop PDFs, merge, stamp, bookmarks, volume split
- **Hearing mode** — live PDF pages of starred authorities, pinpoints, speaking notes
- **Chronology and table of authorities** — export as Word
- **Limitation desk** — working calculator for common Indian windows (not legal advice)
- **Backup** — JSON (including original Matter Tracker `matters.json`) and zip

PDFs never leave the device except when you tap an optional AI action (clean caption, read cite, holding, draft brief).

## Run locally

```bash
npm install
npm run dev
```

That is the build that fetches High Court / SAT / NCLT records.

Mac `.app` from source:

```bash
npm run pack:mac
```

writes `public/Binder-Builder-for-Mac.zip`.
