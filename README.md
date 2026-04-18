# MapLogger – Suite (Builder + Analyser)

Version **1.0.3** (April 15, 2026)

MapLogger Suite is a small, fully in‑browser toolkit:

- **Builder** turns your existing map pages into a ready‑to‑run usability study.
- **Analyser** loads the resulting CSV logs (one CSV per participant) and produces summary statistics and charts.
- **CartoLogger Extension** analyses CSV exports from the CartoLogger tool using a transformed interaction model (`parameter`, `zoom`, `map`, `pan`, `click`, `projection`) and sequence reconstruction.

Everything runs locally in your browser.

> **Case-study note (CartoLogger tab):**
> The current CartoLogger workflow is tailored to one case study (IPAtlas). It can be adapted for other studies/workflows; if you need that, please contact the author via the project repository: https://github.com/VanicekTomas/maplogger-builder

## What’s in this folder

- `index.html` – the Builder interface
- `app.js` – the Builder logic (reads ZIP, prepares pages, creates the download)
- `style.css` – Builder styling
- `suite.js` – tab switching (Builder / Analyser)
- `analyser.js` – CSV parsing + statistics + charts
- `cartologger.js` – CartoLogger CSV parsing + IPAtlas task_ID converter + transformed interaction model + charts
- `client/`
  - `maplogger-client.js` – logging + task flow used in the study
  - `maplogger.css` – styles for the study toolbar/modals

## Quick start

1) Open `index.html` in this folder in your browser (e.g., `MapLogger/index.html`).
2) Add your project as a single ZIP (it should include at least one `.html` file and any assets your pages use).
3) Add tasks (one per bubble). You can drag to reorder.
4) Optional: add a short welcome message (shown once at the very start).
5) Click **Create ZIP**.
6) Unzip the result and open the study entry page:
   - If your ZIP contained `index.html`, the study entry page is `ml-host.html`.
   - Otherwise, the study entry page is `index.html`.

Everything is generated locally in your browser. No server is needed for building, but some browsers block `fetch()` from `file://` (see Troubleshooting).

## Using the Analyser

1) Open the **Analyser** tab.
2) Upload one or more participant CSV files (e.g., `P01.csv`, `P02.csv`, …).
3) Review the overview cards and charts:
  - event type breakdown
  - interactions per participant
  - interactions over time (binned)
  - per-task interactions and duration (when task end durations are available)
  - interaction attributes (element tag/id/text, mouse button, wheel zoom direction, key/code, modifier keys)
  - participant event timeline (chronological “what happened when”) for a single selected participant
4) Optional: use the **Heatmap** section to visualise where participants interacted most (x/y + viewport size) and overlay a background image.
5) Optional: click **Download summary** to export a compact CSV of participant-level metrics.

### Heatmap (x/y + viewport)

If your CSV logs contain `x`, `y`, `viewport_w`, `viewport_h`, the analyser can render a heatmap of interaction hotspots.

- You can switch between viewport groups if participants used different window sizes.
- You can upload a background image (e.g., a screenshot of the tested UI) and the heatmap will be rendered on top.

### “i” helper + export

- Each chart has an **info** button (“i”) describing what the visualisation represents and what to look for (British English).
- Each chart and the heatmap can be exported as a **PNG** (rendered at “300 DPI” via high-resolution export) with a **20 px** margin around the visual.

### Interpretation (copy-ready)

The analyser generates a short interpretation text that updates based on:

- the current participant selection (aggregate vs single participant)
- event filters (click/wheel/keydown etc.) and meta-event inclusion
- current time bin size

It is designed to be pasted into an academic report (always review wording and align with your study design).

Tip: the **Load sample data** button works when served via `http://localhost/...` (some browsers block `fetch()` from `file://`).

## Using the CartoLogger Extension

1) Open the **CartoLogger** tab.
2) Upload one or more CartoLogger CSV files (e.g., `U01.csv`, `U02.csv`, …), or use **Load CartoLogger sample data**.
3) Data is automatically converted for IPAtlas randomised tasks:
  - `session` is normalised to `participant_ID`
  - a new `task_ID` column is computed from the last `url_change` in each source task
  - task mapping is based on `id=...` in URL (`povrch-zeme`→1, `podnebne-pasy`/`biomy`→2, …, `objevne-cesty`→8)
  - unresolved mappings are listed in diagnostics with `participant_ID` and source `task`
4) Review transformed outputs (task_ID-based):
  - event type distribution for CartoLogger logs
  - pointer click targets (derived from `pointerdown` selectors, including extended UI-control categories to reduce `other`)
  - interactions over time
  - per-task_ID interaction, zoom, and duration summary (mean duration as red points)
  - map usage duration by task_ID (derived from `id=...` in URL; all map IDs are shown)
  - map transition matrix (`from map` → `to map`) built from consecutive `url_change` events within task_ID
  - time to first action by task_ID (mean/median/P75), with configurable first-action definition
  - interaction sequence reconstruction (chart + chronological stream) for a selected participant
  - sequence chart supports horizontal pan by left mouse drag and zoom only with mouse wheel
5) Optional controls:
  - use task_ID range filtering (e.g., task_ID `0` to `8`)
  - choose first-action definition for the time-to-first-action chart:
    - pointerdown only
    - pointerdown or zoom
    - pointerdown, zoom, or url_change
    - any non-projection event
  - export one merged converted CSV for all loaded participants

Source tool: https://github.com/misavojte/CartoLogger

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
  - Fix: run the Suite through a local static server (e.g. VS Code “Live Server”) and open it via `http://localhost:.../MapLogger/index.html`.

- **Toolbar not visible in the unzipped study**:
  - Make sure you opened the study entry page (`ml-host.html` or `index.html`), not one of the injected pages.

- **CSV does not download**:
  - Check the browser console for errors and ensure scripts in `client/` are present.

## Licence

This Builder and the generated ZIP include a `LICENSE` file with the MIT licence for MapLogger.
