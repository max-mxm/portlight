---
name: Portlight
description: Local, under control. A programme guide for the ports, processes and containers of one Mac.
colors:
  violet: "#6161ff"
  violet-hover: "#4b4be6"
  mint: "#00ca72"
  yellow: "#ffcc00"
  pink: "#fb275d"
  pink-hover: "#ff658d"
  ink: "#111226"
  white: "#ffffff"
  project-cyan: "#00d2d2"
  project-lavender: "#9d9dff"
  project-gray: "#c7c9dc"
  sidebar: "#181b34"
  sidebar-ground: "#0e1024"
  sidebar-text: "#ffffff"
  sidebar-text-muted: "#c7c9dc"
  sidebar-text-subtle: "#d3d5e9"
  sidebar-label: "#b8bbd2"
  sidebar-hover: "#23264a"
  sidebar-selected: "#30334e"
  sidebar-edge: "#60647e"
  sidebar-input-edge: "#2b2f52"
  backdrop: "#181b34cc"
  ground: "#0e1024"
  surface: "#0e1024"
  raise: "#151838"
  head: "#181b34"
  text: "#f4f3ff"
  muted: "#a9acc9"
  quiet: "#8d90b3"
  line: "#2b2f52"
  rule: "#23264a"
  accent-soft: "#24245c"
  accent-text: "#b7b7ff"
  focus: "#b7b7ff"
  status-green: "#00ca72"
  status-amber: "#ffcc00"
  status-amber-bg: "#2a2714"
  danger: "#ff92ae"
  danger-bg: "#3a1a2c"
  now: "#6161ff"
  server-block: "#0f3b31"
  container-block: "#24245c"
  tool-block: "#23264a"
  meter: "#a9acc9"
  programs: "#00ca72"
  kernel: "#4b538a"
  heat-0: "#171a3c"
  heat-1: "#0f3b31"
  heat-2: "#0b6a4b"
  heat-3: "#009a59"
  heat-4: "#00ca72"
  heat-0-ink: "#f4f3ff"
  heat-3-ink: "#111226"
  heat-4-ink: "#111226"
  ground-light: "#f6f5f0"
  surface-light: "#fbfaf6"
  raise-light: "#efeee8"
  head-light: "#efeee8"
  text-light: "#111226"
  muted-light: "#4f5274"
  quiet-light: "#5e6185"
  line-light: "#cfd0da"
  rule-light: "#e3e3e8"
  accent-soft-light: "#e9e8ff"
  accent-text-light: "#3434b7"
  focus-light: "#3434b7"
  status-green-light: "#00864b"
  status-amber-light: "#805300"
  status-amber-bg-light: "#fff5c2"
  danger-light: "#ac1640"
  danger-bg-light: "#ffe2e9"
  now-light: "#514ae7"
  server-block-light: "#d3f3e3"
  container-block-light: "#e2e1ff"
  tool-block-light: "#e3e3e8"
  meter-light: "#55587a"
  programs-light: "#00a35e"
  kernel-light: "#8d90b3"
  heat-0-light: "#e6e6eb"
  heat-1-light: "#bfeed6"
  heat-2-light: "#7ddcaa"
  heat-3-light: "#1fb36f"
  heat-4-light: "#007f45"
  heat-4-ink-light: "#ffffff"
typography:
  display:
    fontFamily: "Archivo Variable, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 84"
  display-simple:
    fontFamily: "Archivo Variable, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 84"
  brand:
    fontFamily: "Archivo Variable, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    letterSpacing: "-1.2px"
  headline:
    fontFamily: "Archivo Variable, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.3
  dialog-title:
    fontFamily: "Archivo Variable, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.3
  group-name:
    fontFamily: "Archivo Variable, sans-serif"
    fontSize: "14px"
    fontWeight: 800
    fontVariation: "\"wdth\" 85"
  title:
    fontFamily: "Archivo Variable, sans-serif"
    fontSize: "14.5px"
    fontWeight: 700
    lineHeight: 1.3
    fontVariation: "\"wdth\" 92"
  body:
    fontFamily: "Archivo Variable, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  body-control:
    fontFamily: "Archivo Variable, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  body-meta:
    fontFamily: "Archivo Variable, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  label:
    fontFamily: "Archivo Variable, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.4px"
  mono-ident:
    fontFamily: "JetBrains Mono Variable, monospace"
    fontSize: "14px"
    fontWeight: 700
    fontFeature: "\"tnum\" 1"
  mono-figure:
    fontFamily: "JetBrains Mono Variable, monospace"
    fontSize: "19px"
    fontWeight: 700
    fontFeature: "\"tnum\" 1"
  mono-value:
    fontFamily: "JetBrains Mono Variable, monospace"
    fontSize: "13px"
    fontWeight: 400
    fontFeature: "\"tnum\" 1"
  mono-axis:
    fontFamily: "JetBrains Mono Variable, monospace"
    fontSize: "10.5px"
    fontWeight: 500
    fontFeature: "\"tnum\" 1"
rounded:
  none: "0px"
spacing:
  hairline: "1px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  row: "14px"
  panel: "16px"
  dialog: "24px"
  page: "30px"
  page-wide: "44px"
components:
  ident-server:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.ink}"
    typography: "{typography.mono-ident}"
    rounded: "{rounded.none}"
    padding: "0 6px"
    height: "34px"
    width: "56px"
  ident-container:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.white}"
    typography: "{typography.mono-ident}"
    rounded: "{rounded.none}"
    padding: "0 6px"
    height: "34px"
    width: "56px"
  ident-review:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    typography: "{typography.mono-ident}"
    rounded: "{rounded.none}"
    padding: "0 6px"
    height: "34px"
    width: "56px"
  ident-tool:
    backgroundColor: "{colors.tool-block}"
    textColor: "{colors.text}"
    typography: "{typography.mono-ident}"
    rounded: "{rounded.none}"
    padding: "0 6px"
    height: "34px"
    width: "56px"
  block-server:
    backgroundColor: "{colors.server-block}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "0 9px"
    height: "28px"
  block-container:
    backgroundColor: "{colors.container-block}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "0 9px"
    height: "28px"
  block-review:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 9px"
    height: "28px"
  now-chip:
    backgroundColor: "{colors.now}"
    textColor: "{colors.white}"
    typography: "{typography.mono-axis}"
    rounded: "{rounded.none}"
    padding: "2px 6px"
  stop-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-meta}"
    rounded: "{rounded.none}"
    padding: "6px 8px"
    height: "34px"
    width: "83px"
  stop-button-hover:
    backgroundColor: "{colors.pink}"
    textColor: "{colors.ink}"
  button-primary:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    padding: "11px 22px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.violet-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "11px 18px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.accent-soft}"
  button-danger:
    backgroundColor: "{colors.pink}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "11px 18px"
    height: "44px"
  button-danger-hover:
    backgroundColor: "{colors.pink-hover}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "38px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.body-control}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "32px"
  chip-active:
    textColor: "{colors.text}"
  view-toggle-on:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "30px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.sidebar-text-muted}"
    rounded: "{rounded.none}"
    padding: "8px 10px"
    height: "38px"
  nav-item-hover:
    backgroundColor: "{colors.sidebar-hover}"
    textColor: "{colors.white}"
  nav-item-active:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.white}"
  input-field:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    typography: "{typography.mono-value}"
    rounded: "{rounded.none}"
    padding: "10px 12px"
  search-box:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "42px"
  dialog-header:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.white}"
    typography: "{typography.dialog-title}"
    rounded: "{rounded.none}"
    padding: "20px 24px"
  heat-cell-hot:
    backgroundColor: "{colors.heat-4}"
    textColor: "{colors.heat-4-ink}"
    typography: "{typography.mono-value}"
    rounded: "{rounded.none}"
    height: "26px"
    width: "54px"
---

# Design System: Portlight

## Overview

**Creative North Star: "The Programme Guide"**

Every service is a channel on a broadcast programme guide. Its port is the channel number, shown as a square colour ident; its lifetime is a programme block running along one shared time axis up to a violet "now" line. The Processes view uses the same grammar: each application is a row whose last two minutes of CPU run as a strip of heat cells into the same now line. The world refuses the category default of stat cards over a table: counts live in filter chips, measurements live in rows and strips.

The system is dark-first (used at night beside a dark terminal and editor) and the light theme follows macOS at the same finish. Density is high and tabular: fixed per-row furniture, mono figures, no ornament around measurements. Colour is quarantined to marks (idents, blocks, keys, meters, the now line, stop squares); text stays ink or secondary gray. Every box is square, every contour is 1px, and there are no offset shadows. The human rationale, in French, lives in `docs/design-decisions.md`; product truth lives in `PRODUCT.md`. This file is the agent-facing system record and does not repeat them.

Two views share one vocabulary: the **programme guide** (default) and the **simplified view**, switched by the `simpleView` setting and by the "Simplified view" toggle in the top bar. The simplified view is the same world with less furniture, never a second style.

**Key Characteristics:**
- Square everything: `border-radius: 0` on every element and pseudo-element, including redrawn checkboxes, selects and Lucide icon caps.
- Four Monday hues with strict jobs: mint server, violet container and now line and selection and focus, yellow status only, pink stop only.
- A navy rail (`sidebar`) that anchors navigation in both themes.
- Archivo Variable with condensed widths for headings and names; JetBrains Mono Variable for ports, PIDs, figures, durations and commands.
- One shared time axis per view; length on the axis is exact duration.
- Flat surfaces separated by tonal steps (`raise`, `head`) and 1px lines.

## Colors

A navy-and-cream ground carrying four saturated Monday hues that each own exactly one meaning.

### Primary
- **Monday Violet** (`violet`): Docker container identity (ident and block), the "now" line and its time chip (`now`, a deeper violet in light mode), the active nav item, selected rows and pressed chips (as a 3px underline or a 5px left inset), the dialog header band, checked checkboxes, text selection, and the focus family (`focus`, lavender in dark, deep violet in light). The primary button is violet with an ink edge.

### Secondary
- **Monday Mint** (`mint`): the development server identity (ident, the 2px left edge of a server block, legend key), the "local" access square, the live-refresh square, the selected-project outline in the rail, and the single hue of the CPU heat ramp (`heat-0` to `heat-4`) and of the programs area in the CPU chart (`programs`).

### Tertiary
- **Monday Yellow** (`yellow`): status only. Past the review threshold (ident, block, age meter, threshold line in dark, the "To review" chip key and nav count), memory pressure, a degraded thermal state, paused or stale refresh (`status-amber`), and the yellow left rule of wider stop scopes. Always paired with a word. In light mode every yellow mark carries a 1px ink edge to stand off the cream.
- **Monday Pink** (`pink`): stop only. The filled square icon in Stop, Quit and Stop group, the Stop button hover fill, and the destructive confirm button (`button-danger`), always with ink text and an ink edge.

### Neutral
- **Night Navy** (`ground`, `sidebar-ground`): the dark ground and the ⌘K trigger well in the rail.
- **Rail Navy** (`sidebar`, also dark `head`): the sidebar in both themes, table headings and the axis band in dark.
- **Raised Navy** (`raise`): project group rows and empty-state wells in dark.
- **Cream Paper** (`ground-light`, `surface-light`, `raise-light`): light ground, panels, group rows and headings.
- **Ink** (`ink`, `text-light`): light-mode text, and the text and edge on every saturated mark (mint, yellow, pink).
- **Moon White** (`text`): dark-mode text.
- **Slate Grays** (`muted`, `quiet` and their light pairs): secondary text, metadata, commands, placeholders.
- **Hairlines** (`line`, `rule`): 1px contours and row rules respectively.
- **Muted Violet-Gray** (`kernel`): the unattributed macOS kernel, in the chart and as a desaturated heat strip.
- **Project hues** (`mint`, `project-cyan`, `project-lavender`, `project-gray`): project squares in the rail; they never borrow yellow or pink.

### Named Rules
**The One Job Rule.** Each Monday hue has one meaning. Mint is a server, violet is a container or "now" or selection or focus, yellow is a status that needs a look, pink is stop. A new feature reuses a meaning or uses a neutral; it never paints a hue for decoration.

**The Ink Text Rule.** Text stays `text`, `muted` or `quiet`. It never takes a series colour. On mint, yellow and pink the text is `ink`; on violet it is white.

**The Fact, Not Alarm Rule.** Network exposure is an outlined square (a 1.5px inset stroke in `currentColor`), next to the filled mint "local" square. It is never yellow or pink.

**The Ink Edge Rule.** In light mode, yellow marks (ident, block, keys, age meter) carry a 1px `ink` edge; the review threshold line turns ink.

## Typography

**Display Font:** Archivo Variable (with sans-serif), width axis used
**Body Font:** Archivo Variable (with sans-serif)
**Label/Mono Font:** JetBrains Mono Variable (with monospace), tabular figures

Both are bundled through Fontsource (`@fontsource-variable/archivo/standard.css` for weight and width, `@fontsource-variable/jetbrains-mono/wght.css`); no network font request.

**Character:** A condensed, heavy grotesque for names gives the broadcast-listing voice; a mono for every number keeps the columns of ports, PIDs and figures exact.

### Hierarchy
- **Display** (800, 34px, 1.05, width 84%): the page title; 26px in the simplified view, where the subtitle is hidden.
- **Brand** (700, 28px, -1.2px): the "Portlight" wordmark in the rail, with a 9px mono tagline.
- **Headline** (700, 19px, 1.3): panel titles; dialog titles at 22px on the violet band.
- **Group name** (800, 14px, width 85%): project group rows of the guide.
- **Title** (700, 14.5px, 1.3, width 92%): service names, which open the details.
- **Body** (400, 15px, 1.6): page subtitles, notices, empty states; 13px for controls (600), 12px for row metadata.
- **Label** (700, 11px, 0.4px, uppercase): column headings and figure-strip captions.
- **Mono ident** (700, 14px; 12.5px under 900px): the port ident and the CPU ident (12.5px).
- **Mono figure** (700, 19px): simplified figure strip values; 14px in the sensor strip, 15px for the current CPU.
- **Mono axis** (500, 10.5px): tick hours, the now chip, durations on blocks (11.5px) and commands.

### Named Rules
**The Mono Number Rule.** Every port, PID, duration, percentage, byte count, time and command is JetBrains Mono with tabular figures. Words are Archivo.

**The Condensed Name Rule.** Width compression is for headings and names only (84%, 85%, 92%); body text stays at normal width.

## Layout

A fixed navy rail on the left (244px; 218px under 1050px; 194px under 900px; stacked on top under 680px) and a main column with a 60px top bar that doubles as the macOS window drag region. The macOS window buttons sit over the rail in a 54px sticky band; the rail scrolls rather than squeezing projects. Main content is capped at 1600px with 34px 30px padding (44px from 1450px, 28px 22px under 1050px).

Page order: title row (title, subtitle, Refresh with ⌘R), then a panel whose toolbar holds the filter chips (All, Servers, Docker, To review with counts), search and sort, then the list.

**Programme guide rows** use one grid: ident (74px) · service furniture (min 170px) · track (flexible) · actions (108px). Rows are 62px; table heading 46px with the hour axis inside it. The window spans the review threshold times 1.25 (default threshold 8 h, so 10 h), clamped 2 to 210 h, with ticks on round local hours (about five). Under 1050px the command and resource figures drop; under 900px only the first tick label remains and the threshold and now chips shorten. A track under 260px (container query) drops the block's name before its duration.

**Simplified rows** use ident (120px) · name (flexible) · age meter (210px) · actions (108px), 46px tall.

**Processes**: a load band (CPU step chart over two minutes, then a 270px memory column; single column under 900px), a sensor strip, then application rows: check (34px) · CPU ident (66px) · name · 60-cell heat strip · memory (92px) · actions (112px). The simplified Processes view replaces the band with a one-line figure strip and the heat strip with a thin CPU bar.

Rhythm is compact and uneven by role: 14px row gutters, 16px panel toolbars, 24px dialog padding, 8 to 12px gaps between controls.

## Elevation & Depth

Flat. Depth comes from tonal steps (`ground` → `raise` → `head`, or the cream equivalents) and 1px contours (`line` for boxes, `rule` for row separators). Dialogs are a bordered box over a navy backdrop (`backdrop`), with `box-shadow: none`. Inset strokes are used as edges, not depth: the 2px mint left edge of server blocks, the 3px violet underline of pressed chips, the 5px violet left bar of a selected process row, the 1px ink edge of yellow in light mode, the 1.5px outline of the network square.

### Named Rules
**The Flat Ledger Rule.** No offset or decorative shadows, no blur, no layout motion on hover. If something needs to stand out, change its tone or its 1px contour.

## Shapes

Square everywhere, binding. A global rule sets `border-radius: 0` on every element and its `::before` / `::after`. Controls WebKit rounds by default are redrawn: checkboxes are 17px squares (violet fill and a white square-cornered tick when checked, ink edge), selects drop native chrome and use a solid triangle caret drawn from two gradients, Lucide icons use square line caps and miter joins. Status keys, legend keys, project squares and live dots are 8 to 10px solid squares; the now line is a 2px vertical bar; meters are flat bars (age meter 6px, memory meter 10px with a 1px text-colour outline, CPU bar 5px).

## Components

### Port Ident (signature)
The channel number. A solid square tile (min 56px × 34px, mono 14px bold) in the service's tone: mint server, violet container, yellow past the threshold, `tool-block` gray for tools and macOS services. A web port is a button that opens the browser (underline on hover); a non-web port is static. Extra ports follow as small 1px-outlined mono tags, dashed when not web. In the simplified view the ident shrinks to a 10px square of the same tone before the plain port number.

### Programme Block and Track (signature)
The service's lifetime on the shared axis: a 28px bar from its start to the now line. Server blocks use `server-block` with a 2px mint left edge, containers `container-block`, past-threshold blocks solid yellow with ink text, tools `tool-block`. A block that started before the window shows a left-pointing triangle and the real start time; a block too short for its label puts its duration outside, to its left. Each track repeats the hour ticks (1px `rule`), the threshold line (1px yellow; ink in light) and the 2px now line. The text is duplicated for screen readers.

### Now Line and Chip
A 2px `now` bar on the right edge of every track, every heat strip and the CPU chart, with a violet chip (white mono 10.5px bold) giving the scan time in the heading and the current CPU in the chart.

### Buttons
- **Shape:** square (0px), 1px contour.
- **Stop:** neutral at rest (`surface`, `line` edge, 34px, 12px semibold) with a filled pink square icon; on hover it fills pink with ink text and an ink edge. Label names the action (Stop, Quit, Stop group, Protected when disabled).
- **Primary:** violet with white text and an ink edge, 44px; hover `violet-hover`.
- **Danger (confirm stop):** pink with ink text and ink edge, 44px; hover `pink-hover`.
- **Secondary:** `surface` with `line` edge; hover `accent-soft`.
- **Outline (Refresh):** transparent with a 1px text-colour edge, 700 weight, kbd hint split by a 1px rule.
- **Icon button:** 32 × 34px, transparent edge that appears on hover with `accent-soft`.
- **Focus:** 3px `focus` outline at 3px offset; white on violet surfaces (dialog header, active nav).

### Chips
- **Style:** 32px, 1px `line` edge, transparent, muted 13px semibold, mono count in text colour.
- **State:** pressed chips take a text-colour edge and a 3px violet inset underline. "To review" carries a yellow 8px key (ink-edged in light).
- **View toggle:** the top-bar "Simplified view" button, 30px; on it takes a violet edge and `accent-soft` fill.

### Cards / Containers
- **Corner Style:** square (0px).
- **Background:** `surface` panels on `ground`; group rows `raise`; headings `head`.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px `line`; row separators 1px `rule`. Notices add a 1px yellow or pink left rule over `status-amber-bg` / `danger-bg`.
- **Internal Padding:** 14 to 16px toolbars, 24px dialogs and settings.

### Inputs / Fields
- **Style:** 1px `line` edge on `ground`, square, mono 14px text, 10px 12px padding. The search box is 42px with a leading icon and ⌘F hint.
- **Focus:** the shared 3px focus outline.
- **Disabled:** 55% opacity, default cursor.

### Navigation
The navy rail: brand, a ⌘K "Quick action" well (`sidebar-ground` with `sidebar-input-edge`), mono uppercase section labels, 38px nav items with mono counts (the To review count sits on a yellow tab with ink text). Hover `sidebar-hover`; active is solid violet with white bold text. Projects list as 10px hue squares; the selected project gets a mint 1px outline on `sidebar-selected`. The bottom holds "This Mac" with the live square, then EN | FR and System / Light / Dark segmented switches (1px `sidebar-edge`, violet when pressed).

### Heat Strip and CPU Ident (Processes)
Sixty 1px-gapped cells, one per 2 s sample, ending at the now line; the CPU ident is a 54 × 26px cell carrying the current value. One mint ramp, graded relative to one core: below 1 %, under 0.4 core, under one core, under two cores, two cores and more (`heat-0` to `heat-4`, ink or white text per step). The kernel row uses the same scale desaturated to 15 %. Approximate values are prefixed with `≈`.

### CPU Chart and Figure Strips
A 118px step chart: programs (`programs`) stacked under kernel (`kernel`), 0 / 50 / 100 gridlines, the now line and an end label. Memory sits beside it as a 28px figure, a 10px outlined meter against the total, and pressure with a yellow key when not normal. Sensor and figure strips are bordered rows of equal cells split by 1px `rule`; a missing sensor shows "—" with "not exposed by this Mac", never an estimate.

### Age Meter (simplified view)
A 6px flat bar filling toward the review threshold in `meter` gray, solid yellow once past it, with the mono duration and a yellow key (ink-edged meter in light).

### Dialogs
Native `<dialog>`, 500px (680px wide), 1px `line` box on `surface`, a solid violet header band with white title and a white-edged close button, over the navy backdrop. Confirmations list exact targets and the equivalent command in a mono box on `ground`.

## Do's and Don'ts

### Do:
- **Do** keep `border-radius: 0` on every new element, pseudo-element and native control; redraw any control WebKit rounds.
- **Do** colour a service by the One Job Rule: mint server, violet container, yellow past the review threshold, `tool-block` gray for tools.
- **Do** put every number, port, PID, duration and command in JetBrains Mono with tabular figures.
- **Do** place time-based marks on the view's shared axis and end them at the 2px violet now line.
- **Do** pair every colour state with a word or icon, and give yellow a 1px ink edge in light mode.
- **Do** separate surfaces with tonal steps (`raise`, `head`) and 1px `line` / `rule` contours.
- **Do** build a new view in both the programme guide and the simplified view, with the same tokens.
- **Do** keep text in `text`, `muted` or `quiet`; ink on mint, yellow and pink; white on violet.

### Don't:
- **Don't** round anything, including checkboxes, selects, keys, meters, icons or dialog corners.
- **Don't** use offset shadows, glow or blur; contours are 1px.
- **Don't** use yellow for anything but status, or pink for anything but stop.
- **Don't** show network exposure as a warning colour; it is an outlined square.
- **Don't** put stat cards or coloured count tiles above a list; counts live in filter chips.
- **Don't** colour text with a series hue, or give projects yellow or pink squares.
- **Don't** estimate a missing measurement; show "—" and say it is not exposed.
