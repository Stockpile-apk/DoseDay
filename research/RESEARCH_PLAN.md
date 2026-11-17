# RESEARCH_PLAN.md: Reference research for the injectable/intake tracker (replaces the research part of BUILD_PLAN S6)

Owner: Rick. Goal: a verified, fully sourced reference dataset for the app. This is research only: no app code, no UI.
Version 2 (2026-11-15): added Section 2A, the Review Pack: a readable, downloadable copy of every pass, organized so Rick can review the research himself without opening JSON.
Today's date for "current status" checks: use the real current date (late Nov 2026). Do NOT trust training knowledge for approval status, doses, or brand availability; verify everything with live sources.

## 0. MODEL AND SETUP
- **Best model for R1, R2, R3, R5: Claude Opus 5.5.** Strongest sustained multi-source reasoning at a lower usage cost than the top tier. Claude Fable 5.2 is the highest tier, but it has extra biology safeguards that could block or dilute peptide/pharmacology research, and it uses more of your limit. Only try it if Opus comes back thin.
- **R4 (nutrition and targets): Sonnet 5.5 is fine.** Less sensitive, cheaper.
- Turn web search ON. If your app has a Research option, use it for R2 and R3.
- One NEW chat per pass. Attach this file. Say: "Run pass R1." (then R2, and so on).
- Each pass ends by delivering its output file(s) to Rick, plus its Review Pack (Section 2A): the review page first, then the zip. Rick keeps them; Section 6 of BUILD_PLAN merges and validates the JSON later.

## 1. RULES FOR EVERY PASS
1. Minimal chat. No recaps. No pasting the dataset into chat. Work in files; final reply 5 lines or fewer: files delivered, counts, gaps.
2. Search first. Never write a dose, status, date, or warning from memory. Every claim needs a source in the `sources` list. If you cannot verify it, put it in `openQuestions`, not in the data.
3. Source hierarchy (use the highest available): (a) Health Canada: Drug Product Database, product monographs, Notice of Compliance, Drug and Health Product Register, advisories; (b) FDA labels (DailyMed), EMA EPARs; (c) peer-reviewed trials (NEJM, Lancet, JAMA, Nature Medicine, Diabetes Care) and registries (ClinicalTrials.gov); (d) major guidelines (Obesity Canada, ADA, Endocrine Society, ASMBS, Dietitians of Canada, Health Canada DRIs). Avoid blogs, forums, clinics' marketing pages, and vendor sites entirely. Never cite or link anywhere that sells these products.
4. Record for each source: title, publisher, URL, publication or revision date, date accessed. When sources conflict, record both and flag it. Prefer the newest primary source.
5. Dose information rules (non-negotiable):
   - Products approved in Canada: use the current product monograph: starting dose, titration steps, maximum dose, missed-dose rules, storage, discard-after-first-use. Quote numbers exactly.
   - Products NOT approved in Canada: include dose information ONLY if reported in published human clinical trials, citing the trial, population, regimen, duration, and outcome context, and labelled `basis: "trial"`. If no published human dosing exists, write `"No established human dose"`. Do NOT include community, "research chemical", forum, or vendor protocols. Do NOT include sourcing, purity, or purchasing information.
   - Every entry includes a plain-language `evidenceLevel` (for example "Approved, extensive trials", "Phase 3 published", "Phase 2 only", "Animal and very limited human data").
6. No medical recommendations. Describe what labels and trials say. Never write "you should take".
7. If a claimed Canadian approval or "soon to be approved" cannot be confirmed by Health Canada sources, report it as unconfirmed with what was found. Do not repeat rumours.
8. Save progress to `research-notes.md` as you go, so nothing is lost if the usage limit hits mid-pass. If cut off, the next chat resumes from that file.
9. A pass is not done until its Review Pack (Section 2A) is built from the final JSON, passes the checks in 2A, and is delivered. If the usage limit is close, build the Review Pack from the entries finished so far, marked PARTIAL, before stopping.

## 2. OUTPUT SCHEMA (JSON entry; one array per pass file)
```
{
  "id": "semaglutide",
  "names": { "generic": "semaglutide", "brands": ["Ozempic","Wegovy","Rybelsus"] },
  "class": "GLP-1 receptor agonist",
  "route": ["subcutaneous","oral"],
  "status": "approved_ca | approved_elsewhere | investigational | not_approved_limited_evidence",
  "statusDetail": { "healthCanada": "...", "fda": "...", "other": "...", "checkedOn": "YYYY-MM-DD", "sourceIds": ["s1"] },
  "indications": ["..."],
  "mechanism": "one line",
  "products": [ { "brand": "", "din": "", "strengths": [], "device": "", "monographUrl": "", "monographDate": "" } ],
  "doseInfo": [ { "basis": "monograph | trial", "population": "", "regimen": "", "maxDose": "", "durationOrContext": "", "sourceIds": [] } ],
  "missedDose": { "text": "", "windowHours": null, "sourceIds": [] },
  "storage": { "unopened": "", "inUse": "", "discardAfterDays": null, "sourceIds": [] },
  "commonSideEffects": [], "warnings": [], "contraindications": [], "interactions": [],
  "nutritionNotes": [], "evidenceLevel": "",
  "sources": [ { "id": "s1", "title": "", "publisher": "", "url": "", "publishedOrRevised": "", "accessed": "YYYY-MM-DD", "type": "monograph | label | trial | guideline | regulator" } ],
  "lastReviewed": "YYYY-MM-DD",
  "openQuestions": []
}
```
Validate every output file with a small Node script (valid JSON, required fields present, every `sourceIds` entry exists, every URL present, no empty doseInfo for approved products).

## 2A. REVIEW PACK (Rick's downloadable copy, every pass)
The JSON is for the app. Rick reviews the research himself, so every pass also delivers a readable copy he can open on his Android phone or laptop.

### What to deliver (as downloadable files, in this order)
1. `R#_review.html`: the one file to open. A single self-contained page: no internet needed, no external scripts, fonts or images. Opens offline in Chrome on Android or any laptop browser, and prints or saves to PDF cleanly (print view expands everything).
2. `R#_pack.zip`: everything from the pass, in numbered folders so it sorts in reading order:
```
R1_Approved_in_Canada/            (R2_Investigational, R3_Other_peptides, R4_Nutrition_and_targets)
  00_OPEN_ME_review.html
  01_data/            ref_R#_*.json
  02_sources/         sources_R#.md
  03_reports/         r3_status_report.md, ref_R4_targets.md (only passes that have one)
  04_working_notes/   research-notes.md, validate.js, build_review.js
```

### Build rules
- Generate the page from the pass's final JSON and sources file with a script (`build_review.js`). Never hand-write it, and never add a fact that is not in the data. Rebuild after every JSON fix.
- Footer on every page: source file name, generated date, entry count, source count, and a short fingerprint (SHA-256, first 12 characters) of the JSON it was built from.
- Header line on every page: "Reference only. Describes what product labels and published trials report. Not medical advice."
- Same wording rule as the data: describe, never instruct ("the monograph lists", never "take").

### Page layout (same order every pass)
1. Header: pass name, date checked, counts (entries, sources, open questions), PARTIAL flag if applicable.
2. **Needs your attention** (top of page): every open question, source conflict, unconfirmed status, and "No established human dose" item in the pass, each linked to its entry. This is Rick's review to-do list.
3. **Quick-compare table**: one row per entry: name (brands), type/class, used for, Canada status, US status, evidence level, last reviewed. Filter chips by use (for example Type 2 diabetes, Weight management, Other). Tap a row to jump to the entry.
4. **Entries, grouped by type** (grouping per pass below). Each entry is a collapsible card, closed by default, with the same sections in the same order:
   At a glance (status, used for, evidence level, mechanism, WADA status for R3) → Products and devices (brand, DIN, strengths, pen or device) → Dose information (table; every row labelled **Monograph** or **Trial**, with population, regimen, max dose, source) → Missed dose → Storage → Side effects → Warnings and contraindications → Interactions → Nutrition notes → Open questions → Sources.
5. **All sources**: numbered list with title, publisher, published or revised date, accessed date, clickable link.

### Readability rules
- Every number has a tappable source tag next to it (for example [s3]) that jumps to the source.
- Status badges use colour plus a text label (never colour alone): Approved in Canada / Approved elsewhere / Investigational / Not approved, limited evidence.
- Search box that filters entries; Expand all and Collapse all buttons.
- Phone first: one column, large tap targets, readable without zooming; wide tables scroll sideways instead of shrinking.

### Grouping per pass
- **R1:** by drug class (for example GLP-1 receptor agonist, GIP/GLP-1 dual agonist). Each card's "Used for" lists the use per brand (for example Ozempic: type 2 diabetes; Wegovy: weight management).
- **R2:** by regulatory stage (recently approved / under review / Phase 3 / Phase 2), then by mechanism (oral GLP-1, amylin, dual, triple agonist). Each card shows the status per regulator with dates as a small timeline.
- **R3:** the dated status report summary first (confirmed vs rumoured). Then entries by status (approved for a specific use / not approved with some human trials / animal or very limited human data). Each card adds three boxes at the top: **Proven**, **Unproven**, **Unknown**.
- **R4:** by topic in this order: weight-loss rate (Rick's tiers and the evidence-based bounds side by side) → energy and calorie floors → protein → fluids, fibre and GI problems → micronutrients (one DRI table: nutrient, men and women, RDA or AI, UL, source) → when to contact a healthcare provider. Every number shows its confidence note.
- **R5:** see R5 below.

### Checks (add to the validation script)
- The review page exists, its fingerprint matches the current JSON, and every entry `id` in the JSON appears in it.
- Every `sourceIds` tag on the page links to a source in the list.
- The page loads nothing from the internet (the only URLs allowed are the source links).
- The zip opens and contains the folder layout above.

## 3. PASSES

### R1: Products approved in Canada (Opus 5.5)
Output: `ref_R1_approved.json`, `sources_R1.md`, plus Review Pack `R1_review.html` and `R1_pack.zip`.
Scope: every incretin/GLP-1-class injectable or oral product approved by Health Canada for diabetes or weight management. Start list: semaglutide (Ozempic, Wegovy, Rybelsus), tirzepatide (Mounjaro, and Zepbound or other weight-management brand if approved in Canada), liraglutide (Victoza, Saxenda), dulaglutide (Trulicity, check if still marketed), exenatide (check). Confirm the actual current list via the Health Canada Drug Product Database and Notice of Compliance database; add any approved product you find and drop any not approved.
For each: DINs, strengths, devices (pen types, doses per pen, needle info), monograph titration schedule and maximum doses per indication, missed-dose instructions, storage and in-use discard times, contraindications and boxed warnings, common and serious side effects, hydration/eating guidance from the monograph, drug interactions (including oral medication absorption notes), and special populations in one line each.
Done when: every approved product has a current monograph source with revision date.

### R2: Investigational and pending incretin-class drugs (Opus 5.5)
Output: `ref_R2_investigational.json`, `sources_R2.md`, plus Review Pack `R2_review.html` and `R2_pack.zip`.
Scope: retatrutide, cagrilintide and CagriSema, survodutide, mazdutide, orforglipron, higher-dose semaglutide formulations, and any others you find that are in Phase 3, under review, or recently approved by Health Canada, FDA, or EMA. First step: find out the CURRENT regulatory status of each (including any new approvals since your training data) from regulator sources and the sponsors' formal regulatory announcements.
For each: status per regulator with dates, trial programme names and phases, doses used in the published human trials (basis `trial`, with the trial citation and population), reported efficacy and adverse event findings in one or two lines, and what is still unpublished. Anything approved in Canada gets the full R1 treatment instead.
Done when: every entry has a status date and a primary source; unpublished doses are marked "No established human dose".

### R3: Other peptides people ask about (Opus 5.5)
Output: `ref_R3_peptides.json`, `sources_R3.md`, `r3_status_report.md`, plus Review Pack `R3_review.html` and `R3_pack.zip`.
Scope: first, search Health Canada sources for any actual decisions, consultations, or notices about peptide products (including compounding policy changes or pending approvals) and write a short, dated `r3_status_report.md` of what is actually confirmed versus rumoured. Then, for commonly discussed peptides (for example BPC-157, TB-500/thymosin beta-4, CJC-1295, ipamorelin, tesamorelin, sermorelin, AOD-9604, semax, GHK-Cu, NAD+ products, and others you find are widely discussed), record: regulatory status in Canada/US (approved indication if any, or "not approved"), WADA status where relevant, what human clinical evidence exists (counts and types of studies, not just claims), published human trial doses with citations where they exist, otherwise "No established human dose", and known safety concerns or unknowns. Include a plain `evidenceLevel`.
Rules recap: no community protocols, no sourcing, no vendor links. If a peptide is approved for something (for example tesamorelin), use the monograph like R1.
Done when: every entry states clearly what is proven, what is unproven, and what is unknown, with sources.

### R4: Nutrition, hydration, targets, and the weight-loss rate thresholds (Sonnet 5.5 is fine)
Output: `ref_R4_nutrition.json`, `ref_R4_targets.md`, `sources_R4.md`, plus Review Pack `R4_review.html` and `R4_pack.zip`.
Scope:
1. Rate of weight loss: find what current guidelines and trials say about safe/typical weekly loss rates (kg and % of body weight), lean-mass loss, gallstone and other risks with rapid loss, and what GLP-1/GIP trials actually saw per week. Rick's planned app tiers are: under 0.75%/wk slow notice; 1.0-1.5% target; 1.75% warning; 2.0%+ strong warning. Report neutrally how these compare to the evidence and propose evidence-based default tier bounds with citations, and say plainly if any of Rick's numbers look high or low.
2. Energy: confirm Mifflin-St Jeor and activity multipliers, sourced calorie floors for unsupervised adults, how to handle BMI of 30 or higher.
3. Protein: current guidance for protein intake during weight loss and during GLP-1 therapy (g/kg and which body weight to use), with the strength of evidence.
4. Fluids, fibre, and the common problems on GLP-1 therapy (nausea, constipation, low appetite, dehydration): what sources recommend.
5. Micronutrients: Health Canada Dietary Reference Intakes (RDA/AI/UL) for adult men and women for the common supplements (multivitamin ingredients, vitamin D, B12, iron, calcium, magnesium, potassium, omega-3 where DRI exists), plus what guidelines say about micronutrient risk on reduced intake and after weight loss.
6. Warning signs that warrant contacting a healthcare provider (dehydration, severe vomiting/abdominal pain, gallbladder symptoms, pancreatitis symptoms, hypoglycemia where relevant), phrased from the sources.
Done when: every number in `ref_R4_targets.md` has a citation and a confidence note.

### R5: Independent verification (Opus 5.5, a FRESH chat so it is not grading its own work)
Input: Rick attaches all `ref_*.json` and `sources_*.md` files.
Output: `verification_report.md`, corrected JSON files (`*_verified.json`), plus the final combined Review Pack: `REVIEW_ALL.html` and `DoseDay_Research_Pack_<YYYY-MM-DD>.zip`.
Tasks: re-open the primary source for every dose, status, date, max dose, missed-dose rule, storage rule, and DRI number and confirm it matches the data; fix errors; flag anything unverifiable; check no entry contains community protocols, sourcing, or vendor links; check wording never gives instructions to take a dose; list conflicts between sources; list what has changed since `lastReviewed`. Re-run the validation script.
Final Review Pack (built from the `_verified.json` files, same rules as Section 2A):
- `REVIEW_ALL.html`: one page with tabs at the top: **Approved in Canada | Investigational | Other peptides | Nutrition and targets | Verification**. Each tab uses its pass's grouping from 2A. The Verification tab shows the counts (checked, fixed, unresolved), a "What changed" table (entry, field, old value → new value, source), and the unresolved list. Corrected items carry a "Corrected in R5" badge in their card.
- Zip layout:
```
DoseDay_Research_<YYYY-MM-DD>/
  00_OPEN_ME_REVIEW_ALL.html
  01_Approved_in_Canada/       R1 review page, verified JSON, sources
  02_Investigational/          same
  03_Other_peptides/           same, plus r3_status_report.md
  04_Nutrition_and_targets/    same, plus ref_R4_targets.md
  05_Verification/             verification_report.md
  06_For_the_build/            all *_verified.json and sources_*.md (exactly what the S6 build chat needs)
  99_Working_notes/            research-notes.md, validate.js, build_review.js
```
Done when: the report lists counts of items checked, fixed, and unresolved, the `_verified.json` files validate, and the final Review Pack passes the 2A checks.

## 4. HANDOFF TO THE BUILD
Rick attaches the `*_verified.json` files and `sources_*.md` (all in the final pack's `06_For_the_build/` folder) to the S6 build chat. S6 then only merges them into `www/data/reference.json`, validates, and writes `docs/sources.md`. No research is repeated there. The review pages are for Rick only; S6 does not need them.

## 5. WHEN TO REFRESH
Re-run only the affected pass for changed entries when: Health Canada approves something new, a monograph is revised, or a new peptide decision is announced. Each entry's `lastReviewed` date drives the app's "last reviewed" label. A re-run rebuilds that pass's Review Pack; then re-run R5 on the changed entries so `REVIEW_ALL.html` and the final zip are rebuilt too.
