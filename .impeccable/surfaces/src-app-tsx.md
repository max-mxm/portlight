---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/components/ServicesPanel.tsx","src/components/ProcessesPanel.tsx"]
---

# Portlight app shell

Scope: the whole window (Overview, Servers, Docker, To review, System & tools, Processes, History, Settings, dialogs, ⌘K). Mode: Operate. Dark-first (used at night beside a dark terminal and editor), light must follow macOS at the same finish.

Pinned: square corners everywhere; Monday palette (violet #6161ff, mint #00ca72, yellow #ffcc00, pink #fb275d) as the base; fonts free. Failure modes named by the user: generic, losing personality.

Comps (code-rendered, synthetic data): guide `.impeccable/mocks/decision/assigned.png`; simplified view `.impeccable/mocks/simple-{overview,processes}-{dark,light}.png`. The dataviz re-validated variant (`grille-*.png`, ink now line, washes) was shown and declined: the user kept the palette of the first comps.

Simplified view (user-requested, same world): a setting `simpleView` and a top-bar toggle. Quick glance, less visual noise: compact title row, compact service rows with an age meter that fills to the review threshold and turns yellow past it; Processes as a one-line strip of Mac figures and a list with a thin CPU bar, no history.

## Direction contract

THESIS: Every service is a channel on a programme guide: its port is the channel number, its lifetime a programme running up to a violet “now” line. Refuses the category default of stat cards over a table.

OWN-WORLD: Navy ground #0e1024, rail #181b34. Square colour idents carry the port (mint = server, violet = container, yellow = past the review threshold). Time blocks on one shared axis; colour lives only in idents, blocks and meters, text stays ink. Violet is the container identity, the now line, selection and focus. Yellow is reserved for status (past the review threshold, memory pressure, paused refresh), with an ink edge in light mode; network exposure is an outlined square, projects take non-status hues. Heat ramp: one mint hue from navy, relative to one core. Kernel in a muted violet-gray. Archivo condensed for headings and names, JetBrains Mono for ports, PIDs, figures. Dense tabular figures, no ornament around measurements.

STORY: The developer sees which port is held, by which project, since when, and whether it outlived the review threshold, then stops it from the row or ⌘K with the usual confirmation.

FIRST VIEWPORT: Rail 244 px left (narrower below 1050 px) (brand, ⌘K, views with counts, projects). Main: title, filter chips (All, Servers, Docker, To review) with collapse, search and sort in the list toolbar row; Refresh stays in the title row because it is global to every view, then the guide: port ident · service furniture (name, kind and real start time, command) · a timeline of the review threshold × 1.25 (10 h for the 8 h default) with the threshold line and the now line · Stop. Project group rows with Stop group. Legend under the guide. Processes: a 2 min CPU step chart (programs/kernel) with memory meter and sensor strip, then application rows with 60-cell CPU heat strips on the same now line.

FORM: Broadcast programme guide (EPG), position 7 of the grounded list, seed key fcd53e40. Raises: data density (Ikeda), one colour owns live state (Metro), length is exact duration (Labanotation), colour quarantined to marks (Lexicon), fixed per-row furniture with real start time (character catalog).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
