# Binder Builder

Chambers desk for Indian practice. One matter is the case file — parties, listing, tasks, notes, court orders. The binder is optional papers for a hearing.

Windows Phone–era Start tiles. Matters and PDFs stay on this device.

**Open in the browser:** [https://kopiticatalan.github.io/binder-builder/](https://kopiticatalan.github.io/binder-builder/)

**Mac app (court fetch works here):** [Download Binder Builder for Mac](https://kopiticatalan.github.io/binder-builder/Binder-Builder-for-Mac.zip)

Unzip, drag **Binder Builder** into Applications, then right-click → Open. Needs Python 3 (already on a Mac, or `xcode-select --install`). No Node. Apple Silicon.

The public web page is a static preview. Bombay High Court / SAT / NCLT lookup, cause-list scan, order PDFs and Finder folders need the Mac app.

## How it is laid out

- **Today** — first screen. Matters listed today, then the next five days. Add a listed case into my matters from there.
- **My matters** — every case on this device. One tap updates the folder with orders, opens the file in the app, or reveals it in Finder. Parties, case number, your next date, court website date, last date, and folder path are all on the card.
- **Lists** — scanned cause lists. My matters always flag even if the firm name is not on the board. Firms we watch is a one-line editor (defaults: Bharucha & Partners, Advani & Co., Advani Law LLP).
- **Add from court** — live lookup on Bombay High Court, SAT and NCLT (parties, next date, orders).
- **Add by hand** — blank matter when the website has nothing.
- **Binder** — papers for a hearing, captioned from this matter, or a loose compilation you title yourself.

## Dates

Your next date and your last date are yours. Court website next date and last order on court record come from the forum. Refresh updates the court fields. It does not overwrite a date you typed, unless you still had the previous court date. Use this copies a court date into yours.

## Orders

In the Mac app they write under **Desktop/Bombay HC matters / Petitioner v Respondent**, named `1 25082026 Petitioner v Respondent.pdf` by default (oldest = 1). Change the folder and the name on each matter, or the default in Settings.

## Also

- **Tasks** — next steps across matters
- **Hearing notes and hearing brief** — on the matter
- **Binder tools** — cover, index, drop PDFs, merge, stamp, bookmarks, volume split
- **Hearing mode** — live PDF pages of starred authorities, pinpoints, speaking notes
- **Chronology and table of authorities** — export as Word
- **Limitation desk** — working calculator for common Indian windows (not legal advice)
- **Backup** — JSON (including original Matter Tracker `matters.json`) and zip

PDFs never leave the device except when you tap an optional AI action (clean caption, read cite, holding, draft brief).

## Mac app from source

```bash
npm install
npm run pack:mac
```

writes `public/Binder-Builder-for-Mac.zip`. The `.app` is Python 3 + WKWebView. Court scrape uses the same High Court / SAT / NCLT paths as the original Matter Tracker.
