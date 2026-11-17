# DoseDay session notes

Live: https://stockpile-apk.github.io/DoseDay/ (Pages from main, root; root index.html redirects to www/).
Plan: BUILD_PLAN_v2.md (kept outside the repo, in Rick's bundle). Code rules: docs/CONTRACT.md.

## Done (v0.7.0, 2026-11-17)
- S0 shell: PWA, offline service worker with "Update ready" prompt, IndexedDB, first-run disclaimer, backup/restore (JSON, optional photos), theme, larger text.
- S1 weight: log, kg/lb/stone, 7-day trend chart, 14-day slope, R4 tiers (red tier fixed), profile, suggested targets from R4 (Health Canada EER, protein 80-120 g at BMI 30+, water, fibre, calorie floors), goal blocked under BMI 18.5.
- S1b check-in: weight required, optional photos (resized, on device), measurements, compare + slider, tier banner with numbers.
- S2 meds: editor (schedules, titration, 3-field missed-dose rule, library link shown beside form only), log sheet (Home one-tap), history, side effects, site rotation, adherence/streak.
- S3 (PWA scope): in-app due checks + notifications while open, quiet hours, .ics calendar export (no doses in titles), honesty note.
- S4 food: favourites, manual entry, water, vitamins checklist, UL check, low-appetite mode, 7-day summary, low-intake notices.
- S5: syringe calculator (formulas shown, syringe picture, mg/mcg forced, warnings), inventory with discard/expiry/low badges, auto-decrement.
- S6: reference.json + targets.json built by tools/build-data.mjs from research/ (R1-R4, not yet R5-verified; prefers *_verified.json when present).
- S7: library (4 status badges, search, filters, detail in fixed order, source tags), nutrition topics, warning signs, mix-and-measure help.
- R6 (Rick chose option B, 2026-11-17): 8 prescription hormone entries from Canadian monographs in research/ref_R6_hormones.json (testosterone injection, topical, oral; hCG; clomiphene (no longer marketed in Canada: approved_elsewhere); anastrozole; somatropin; weekly GH). Off-label uses in men have no dose rows. Gym-only pages (MK-677, oxandrolone, nandrolone, SARMs, high-dose testosterone) stay out of the app. Build: research/r6/merge.mjs then tools/build-data.mjs.
- S7b: Commonly reported tab (peptides and blends from Rick's guide; risk first, one-time acknowledgment per entry, no vendors or prices, never fills forms; semaglutide/tirzepatide and the 13 hormone pages left out). Validator: tools/build-community-check.mjs.
- S8: Home dashboard order per plan, Warning signs button, weekly backup reminder, larger text, light/dark, optional PIN lock (PBKDF2 hash; not encryption; forgot PIN = erase and restore backup), printable Visit summary for appointments.

## Tests
- `npm test`: 257 unit tests (CI runs them on every push) (rate tiers at every boundary, targets, schedules incl. DST, calculator, calendar file, nutrition, units, shipped-data guards).
- `node tools/e2e.mjs`: 13 phone-size browser checks (log dose from Home, inventory decrement, weight, calculator, goal floor, backup round trip, calendar).
- `node tools/smoke.mjs "#/route" ... --seed --shot=shots`: every screen, fails on any JS error.

## Decisions (Claude's defaults, Rick can change)
- Red warning tier fixed; no dose-change wording anywhere.
- Calendar events never include a dose.
- Storage times from the mix sheet are labelled "not yet checked against a primary source".

## Known issues / next
- R6 open questions (42 across 8 entries) are in each entry's 'Not confirmed yet'; WADA text read from a hosted copy of the 2026 List (wada-ama.org blocks automated reading).
- R5 independent check not run; library shows "Not yet independently verified".
- S3 phone test: does a notification arrive with the app closed? If not, S3b (APK).
- S4b scale photo reader (needs 5 photos of Rick's scale), S3b APK, S9 store prep: later.
- Fingerprint unlock needs the APK (S3b).
