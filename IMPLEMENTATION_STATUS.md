# Implementation status

Updated 7 September 2026. The product specification is version 1.0.

Version 1 is implemented. The source, production build, and offline ZIP run locally.

Real camera work and the wider device matrix are still open. Those items are listed at the end.

## Phase 0: assets and compatibility

Completed:

- Created the React, TypeScript, and Vite repository.
- Pinned every dependency and added a Node 24 engine requirement.
- Set Vite to use relative production paths.
- Added explicit camera start, cancellation, and track cleanup.
- Built the classic vision worker with esbuild.
- Limited the worker to one frame at a time.
- Added session IDs, frame IDs, stale result checks, bitmap cleanup, and a two-second watchdog.
- Kept worker, model, and WebAssembly requests on the same origin.
- Blocked MediaPipe telemetry at the worker boundary.
- Bundled the Hand Landmarker model, WebAssembly files, fonts, licenses, and paper texture.
- Recorded 13 runtime assets with sizes and SHA-256 hashes.
- Added the seeded cosmos renderer and the Phase 0 lab.

Checked:

- The pinned SDK loaded its worker, model, and WebAssembly files in Playwright Chromium.
- The browser used a synthetic video source for this check.
- Deterministic rendering and camera cleanup tests passed.
- Real webcam accuracy remains untested.

## Phase 1: flowers and interface

Completed:

- Added the landing page, studio, inspector, seed area, and pointer gesture.
- Kept the drawing stage at 1024 by 768 logical units.
- Added rose letter, late summer, and ink garden palettes.
- Built separate cosmos, wild rose, and chamomile geometry.
- Added bounded cubic stems, leaves, veins, centers, pollen, and stable shape order.
- Kept the geometry engine pure and seeded.
- Added live P0 through P3 controls, tangents, blossom axes, and petal construction marks.
- Used one scene description for the live SVG and export renderers.
- Finished the cream and oxblood interface in a plain personal-site style.
- Used Arial and Times New Roman for the interface.
- Kept Newsreader in the generated keepsake.
- Used natural-width text actions, square fields, dotted rules, flat paper, and very little elevation.

Checked:

- Geometry and repeated SVG tests passed.
- The full screenshot set was rendered at 1440 by 900 and 1280 by 800.
- The current screenshots were reviewed for clipping and hierarchy.

## Phase 2: camera-free product

Completed:

- Added mouse and keyboard creation.
- Added a second flower gesture for petal width and bloom turn.
- Kept the stem and petal gestures in one undo and save transaction.
- Added Size, Width, and Turn controls for finished flowers.
- Added species arrow navigation.
- Added selection, movement, resizing, removal, and layer order.
- Limited each bouquet to seven flowers.
- Added transaction-based undo and redo with a 50-entry limit.
- Added recipient, sender, note, and date fields.
- Added Unicode-aware limits, calendar checks, and print-fit feedback.
- Rendered dedication text as text.
- Added IndexedDB stores for bouquets and settings.
- Added revisioned saves, a 500 ms delay, ordered writes, and storage error recovery.
- Added local archive cards, portrait thumbnails, deletion, opening, and recipe export.
- Added strict Zod schemas for drafts and gifts.
- Rejected oversized files, unknown fields, invalid values, duplicate IDs, and unsafe objects.
- Added collision-safe imports.
- Added canonical recipe files, safe filenames, and geometry fingerprints.
- Added 2400 by 3000 PNG export with an opaque paper background.
- Added safe SVG export from the validated scene graph.
- Added the finish page and camera-free recipient view.
- Added the formula panel with palettes, seeds, P0 through P3, and a fingerprint.

Checked:

- A three-flower gift moved between fresh browser contexts with the same fingerprint.
- The keyboard test covers creation, editing, personalization, history, and export.

## Phase 3: webcam controls

Completed:

- Shared press, move, release, suspend, and cancel events across every input mode.
- Routed bloom shaping through the same shared events.
- Added phase-aware recovery for a lost hand during petal shaping.
- Added aspect-correct pinch ratios and calibrated coordinates.
- Added dwell, hysteresis, re-arm timing, and frame-rate-independent filters.
- Added stable hand tracks with soft handedness matching.
- Kept short missing-frame tracks alive.
- Suspended ambiguous ownership.
- Added open-hand confirmation and a fresh-pinch recovery step after tracking loss.
- Connected hand planting and flower movement to the same scene controller.
- Cancelled active work on occlusion, mode changes, stale results, dialogs, resize, worker failure, and hidden tabs.
- Paused inference as soon as the tab became hidden.
- Released the worker and camera tracks after five hidden seconds.
- Added an explicit camera resume route.
- Drew 21 estimated landmarks, finger chains, pinch geometry, age, ratios, and a four-second plot.
- Added sensitivity settings, recalibration, geometry view, and clean view.
- Added the optional mirrored camera underlay.
- Cropped the underlay with the same active region used for landmark mapping.
- Cleared the underlay when the camera stopped.
- Excluded camera images from gifts and exports.

Checked:

- Ownership, jitter, loss, stale session, aspect ratio, crop, and cleanup tests passed.
- Ten automated camera cycles left no active tracks or workers.
- Comfort and thresholds still need real people and cameras.

## Phase 4: access and motion

Completed:

- Added stem and petal reveals.
- Added an 18 ms petal stagger and an 850 ms commit window.
- Kept the ordered recipient reveal within 1.2 seconds.
- Added reduced-motion behavior.
- Added clear empty, permission, storage, import, export, and worker error states.
- Added text labels, field labels, visible focus, and a polite live region.
- Added a screen-reader flower list and non-color state cues.
- Restored focus after dialogs.
- Kept primary targets at least 44 CSS pixels tall.
- Added a 272 px desktop inspector and narrow-layout controls.
- Kept scrolling available at high zoom.
- Preserved mouse and keyboard access after camera errors.

Checked:

- The complete keyboard flow passed.
- A 720 by 450 viewport covered the deterministic 200 percent zoom approximation.
- Native browser zoom was not automated.

## Phase 5: offline release

Completed:

- Kept every production asset relative and local.
- Added a read-only Node server bound to `127.0.0.1`.
- Limited the server to GET and HEAD.
- Added safe path decoding, port selection, MIME types, and cache rules.
- Added macOS, Linux, and Windows launch notes.
- Added architecture, privacy, asset, and license notes.
- Rewrote project notes and interface copy in short, plain sentences.
- Kept the working brief and generated test reports out of the repository and release.
- Built `love-parametrically-v1.0.0.zip`.
- Packed 23 files into a 17.01 MiB archive.
- Stayed below the 35 MiB target.
- Added an automatic GitHub Pages release from the `main` branch.
- Kept the hosted build under the same local-only runtime rules.

Checked:

- The production app passed from `/love-parametrically/`.
- All 22 packaged checksums passed after extraction.
- A clean extracted copy completed the keyboard creation and finish flow.
- The release smoke test made loopback requests only.
- The project prose passed the style scan.

## Checks run

Test host:

- macOS 15.6.1, build 24G90
- Apple Silicon
- AC power
- Playwright Chromium 153.0.8010.12
- Synthetic camera flags
- Node 22.23.1 and npm 10.9.8

The project asks for Node 24. This host only supplied Node 22. `npm ci` completed with the expected engine warning.

| Command | Result |
| --- | --- |
| `npm ci` | 103 packages installed. Audit found 0 vulnerabilities. |
| `npm run assets:verify` | 13 assets matched their size and SHA-256 values. |
| `npm run typecheck` | Passed. |
| `npm run test` | 8 files passed. 42 tests passed. |
| `npm run test:e2e` | 13 Playwright tests passed. |
| `npm run build` | Production build passed. |
| `npm run release` | Created the 17.01 MiB ZIP. |
| Extracted ZIP checks | 22 checksums and the local browser smoke passed. |
| Project prose scan | No em dashes, contrast slogans, or question-style headings found. |

Automated coverage includes:

- LP-01 through LP-22 contracts
- Camera denial and an unanswered permission prompt
- Storage failure and archive states
- Repeated camera cleanup
- Opaque 2400 by 3000 PNG output
- Safe SVG output
- Fingerprint matching after a fresh import
- Nested production paths
- Blocked external runtime traffic
- Server methods, MIME types, traversal handling, and cache rules
- Narrow-layout keyboard completion

## Device checks

| Environment | Status |
| --- | --- |
| Playwright Chromium 153 on this Mac | Camera-free flow, exports, synthetic camera paths, SDK loading, and packaging passed. |
| macOS Chrome with an integrated webcam | Real camera test still open. |
| macOS Safari | Test still open. |
| Windows 11 Chrome and Edge | Test still open. |
| Linux Chrome or Chromium | Test still open. |
| Firefox | Camera-free flow is supported. Camera mode still needs testing. |
| Laptop with no webcam | Mocked paths passed. Physical device test still open. |

## Remaining release checks

1. Run every command with a current Node 24 release.
2. Complete one consented real-hand session. Include setup, planting, occlusion, recovery, underlay alignment, ten restarts, and export.
3. Run the listed browser and operating system matrix.
4. Measure a 15-minute camera session. Record memory, latency, result rate, render rate, and archive growth.
5. Ask five first-time participants to make a flower. Record whether four finish within 90 seconds.
6. Record the optional demonstration after a real-camera run.
