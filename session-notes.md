# DoseDay session notes

Live: https://stockpile-apk.github.io/DoseDay/ (Pages from main, root; root index.html redirects to www/).
Plan: BUILD_PLAN_v2.md (kept outside the repo, in Rick's bundle). Code rules: docs/CONTRACT.md.

## Done (v0.5.0, 2026-11-17)
- S0 shell: PWA, offline service worker with "Update ready" prompt, IndexedDB, first-run disclaimer, backup/restore (JSON, optional photos), theme, larger text.
- S1 weight: log, kg/lb/stone, 7-day trend chart, 14-day slope, R4 tiers (red tier fixed), profile, suggested targets from R4 (Health Canada EER, protein 80-120 g at BMI 30+, water, fibre, calorie floors), goal blocked under BMI 18.5.
- S1b check-in: weight required, optional photos (resized, on device), measurements, compare + slider, tier banner with numbers.
- S2 meds: editor (schedules, titration, 3-field missed-dose rule, library link shown beside form only), log sheet (Home one-tap), history, side effects, site rotation, adherence/streak.
- S3 (PWA scope): in-app due checks + notifications while open, quiet hours, .ics calendar export (no doses in titles), honesty note.
- S4 food: favourites, manual entry, water, vitamins checklist, UL check, low-appetite mode, 7-day summary, low-intake notices.
- S5: syringe calculator (formulas shown, syringe picture, mg/mcg forced, warnings), inventory with discard/expiry/low badges, auto-decrement.
- S6: reference.json + targets.json built by tools/build-data.mjs from research/ (R1-R4, not yet R5-verified; prefers *_verified.json when present).
- S7: library (4 status badges, search, filters, detail in fixed order, source tags), nutrition topics, warning signs, mix-and-measure help.
- S8 partly: Home dashboard order per plan, Warning signs button, backup reminder, larger text.

## Tests
- `npm test`: 257 unit tests (rate tiers at every boundary, targets, schedules incl. DST, calculator, calendar file, nutrition, units, shipped-data guards).
- `node tools/e2e.mjs`: 13 phone-size browser checks (log dose from Home, inventory decrement, weight, calculator, goal floor, backup round trip, calendar).
- `node tools/smoke.mjs "#/route" ... --seed --shot=shots`: every screen, fails on any JS error.

## Decisions (Claude's defaults, Rick can change)
- Red warning tier fixed; no dose-change wording anywhere.
- Calendar events never include a dose.
- Storage times from the mix sheet are labelled "not yet checked against a primary source".

## Known issues / next
- S7b Commonly reported tab: waiting on Rick's answer about the 13 hormone pages.
- R5 independent check not run; library shows "Not yet independently verified".
- S3 phone test: does a notification arrive with the app closed? If not, S3b (APK).
- S4b scale photo reader, S8 PIN lock, S9 store prep: later.
