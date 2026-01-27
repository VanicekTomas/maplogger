# MapLogger – Builder

MapLogger Builder is a small, fully in‑browser tool that turns your existing map pages into a ready‑to‑run usability study. You upload a ZIP, write a few tasks, and download a new ZIP you can open or host straight away.

## What’s in this folder

- `index.html` – the Builder interface
- `app.js` – the Builder logic (reads ZIP, prepares pages, creates the download)
- `style.css` – Builder styling
- `client/`
  - `maplogger-client.js` – logging + task flow used in the study
  - `maplogger.css` – styles for the study toolbar/modals

## Quick start

1) Open `builder/index.html` in your browser.
2) Add your project as a single ZIP (it should include at least one `.html` file and any assets your pages use).
3) Add tasks (one per bubble). You can drag to reorder.
4) Optional: add a short welcome message (shown once at the very start).
5) Click **Create ZIP**.
6) Unzip the result and open the study entry page:
   - If your ZIP contained `index.html`, the study entry page is `ml-host.html`.
   - Otherwise, the study entry page is `index.html`.

Everything is generated locally in your browser. No server is needed for building, but some browsers block `fetch()` from `file://` (see Troubleshooting).

## What the Builder generates

The output ZIP uses a simple “Host + pages” setup:

- **Host entry page** (one HTML file)
  - Shows the task bar (Next →, Finish) and an iframe.
  - Lets the participant click **Start** and chooses which page to load first.
  - Collects events from the pages and writes the CSV log.

- **Your pages** (all HTML files from your ZIP)
  - Each HTML file gets a small injection in `<head>` so it can log events.
  - Pages themselves do not show the toolbar; they run inside the Host’s iframe.

The Builder UI also shows a small preview of the first task label and the overall flow.

## Naming

The Output name you enter is used for:

1. ZIP file name: `<outputName>.zip`
2. Default CSV file name inside the study: `<outputName>.csv`
3. Internal session grouping key (derived from the Output name)

## CSV log (overview)

Each interaction becomes one row in a CSV. You’ll see:

- timestamps (local + UTC)
- current task number/label
- event type (click, keydown, wheel, etc.)
- basic element info (tag/id/classes/text)
- pointer coordinates and viewport size (when relevant)

When the participant presses **Finish**, they enter a participant ID. The study then:

1) rewrites `session_id` in all existing rows to that participant ID,
2) adds final end events,
3) downloads a CSV named `<participantID>.csv`.

## Output ZIP contents

The ZIP contains:

- all your original files (kept in the same folder structure),
- updated HTML files (with logging injection),
- the Host entry page (`ml-host.html` or `index.html`),
- `client/` (MapLogger client + CSS),
- `LICENSE` and a short `README.md`.

## Troubleshooting

- **“Could not load the MapLogger client files …”** when opening the Builder from the file system:
  - Some browsers block `fetch('client/...')` on `file://` URLs.
  - Fix: run the Builder through a local static server (e.g. VS Code “Live Server”) and open it via `http://localhost:.../builder/index.html`.

- **Toolbar not visible in the unzipped study**:
  - Make sure you opened the study entry page (`ml-host.html` or `index.html`), not one of the injected pages.

- **CSV does not download**:
  - Check the browser console for errors and ensure scripts in `client/` are present.

## Licence

This Builder and the generated ZIP include a `LICENSE` file with the MIT licence for MapLogger.
