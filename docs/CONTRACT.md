# DoseDay code contract (read this before writing any view)

DoseDay is an offline phone web app (PWA) that tracks injectable medicines, weight, food, water and vitamins.
Vanilla JS ES modules, HTML, CSS. No framework, no bundler, no npm dependencies in the app. Everything the
browser loads lives in `www/`.

## Hard safety rules (apply to every screen)

1. The app NEVER recommends a dose and NEVER fills in a dose. Dose fields are always typed by the user.
   Reference text may show BESIDE a form, never inside an input.
2. Wording describes and never instructs: "the monograph lists", never "take". Never tell the user to raise,
   lower or adjust a dose. The only allowed action wording is "contact your prescriber", "ask your pharmacist"
   and urgent-care wording copied from the data.
3. Every reference or calculator screen ends with `infoLine()` ("Information only. Not medical advice...").
4. No vendor, clinic, price, purity or sourcing information anywhere.
5. Do not invent medical numbers. Numbers come from `www/data/reference.json` and `www/data/targets.json`
   or from what the user typed.
6. Plain language, Canadian spelling (fibre, colour, litre). Metric first.

## Conventions

- One view per file in `www/js/views/`. Keep each file under about 300 lines; split helpers into
  sibling files (for example `meds.js`, `meds-edit.js`) and import them.
- A view exports `export async function render(root, ctx)`. `root` is an empty `<div class="stack">` that the
  shell mounts after `render` resolves. Build DOM with `h()`; never set `innerHTML` with user data.
- `ctx = { path: string[], query: URLSearchParams, go(hash), refresh(), back(), setTitle(text), setAction(node) }`
  - URL `#/meds/edit/abc?x=1` gives view `meds`, `ctx.path = ['edit','abc']`, `ctx.query.get('x') === '1'`.
  - After saving data call `ctx.refresh()` (re-renders this route) or `ctx.go('#/meds')`.
  - `ctx.setAction(btn('Add', ...))` puts a button at the top right.
- Routes that exist (see `www/js/app.js`): home, meds, food, weight, more, checkin, profile, library, warning,
  mix, calc, inventory, reminders, settings. Sub-pages are path segments of your own route.
- Phone first: one column, tap targets at least 48 px, nothing needs more than one tap to log.
  Status is always colour AND text (use `badge(text, kind)`).
- Only touch the files you were assigned. Do not run git. Do not edit `app.js`, `ui.js`, `db.js`, `css/app.css`,
  the logic files or the data files; if you need a helper that is missing, write it inside your own file and
  say so in your final report.

## UI helpers: `www/js/ui.js`

```js
import { h, mount, clear, btn, card, badge, banner, field, input, numberInput, select, checkbox, kv, empty,
  sectionTitle, progress, item, segmented, fold, toast, sheet, confirmBox, infoLine, num, round } from '../ui.js';

h('div', {class:'row', onclick: fn, 'aria-label':'x'}, child, 'text', [list])   // element; null/false kids are skipped
btn('Save', onClick, 'primary')            // kinds: '', 'primary', 'danger', 'ghost', plus 'block', 'small'
card('Title', ...children)                 // section.card with an h2
badge('Approved in Canada', 'ok')          // kinds: '', 'ok', 'info', 'warn', 'danger'
banner('warn', 'Title', 'Text', ...more)   // kinds: '', 'ok', 'info', 'warn', 'danger'
field('Label', inputElement, 'optional hint')
input({value, placeholder, type:'date'|'time'|'text'})   numberInput({value, min, max, step, placeholder})
select([{value,label}] or ['a','b'], currentValue, props)
checkbox('Label', checked, onChange)       // returns a <label>; the input is label.querySelector('input')
kv('Label', 'value')                       // one label/value row
item({title, sub, right: node, onClick, href})   // tappable list row; wrap rows in h('div',{class:'list'}, ...)
segmented([{value,label}], current, onChange)    // tab switch
fold('Summary text', ...children)          // collapsed <details>
progress('Protein', 62, 100, 'g')
empty('Nothing here yet', btn(...))
toast('Saved', 'ok')                       // kinds: '', 'ok', 'warn', 'danger'
const s = sheet({title, body: node, actions: [btn(...)]});  s.close()    // bottom sheet / modal
await confirmBox('Delete this?', {okText:'Delete', danger:true})          // -> true/false
num(inputEl)                               // number or null (blank / not a number)
round(1.234, 1)
```

CSS classes you can use (defined in `css/app.css`): `stack`, `row`, `row wrap`, `grow`, `between`, `grid2`,
`muted`, `small`, `big`, `center`, `mt`, `hide`, `list`, `chips` + `chip` (+ `on`), `tblwrap` + `tbl` (tables that
scroll sideways), `kv`, `source`, `section-title`, `plain` (ul). Do not add a stylesheet; small one-off styles
may use `style: {...}` in `h()`.

## Storage: `www/js/db.js` (IndexedDB, on device only)

```js
import { db, uid, getSetting, setSetting, getProfile, saveProfile } from '../db.js';
await db.all('meds')                 await db.get('meds', id)
await db.put('meds', obj)            // adds id if missing, stamps updatedAt, returns the saved record
await db.del('meds', id)
await db.where('foodLog', 'date', '2026-11-16')          // exact match on an indexed field
await db.range('weights', 'date', '2026-10-01', '2026-11-16')
await getSetting('key', fallback)    await setSetting('key', value)
const profile = await getProfile();  await saveProfile({units:'lb'})
```

Stores and record shapes (indexed fields in brackets). Dates are local `'YYYY-MM-DD'`; date-times are ISO strings.

- `profile` (one record, use getProfile/saveProfile): `{sex:'male'|'female'|'', birthYear, heightCm, startKg, goalKg,
  activity:'inactive'|'low'|'active'|'very', units:'kg'|'lb'|'st', stillEscalating:boolean,
  tiers:{lowPct,fastPct,fastKg}, targets:{kcal,proteinG,waterMl,fibreG,deficit}}` (targets = user overrides)
- `weights` [date]: `{id, date, kg, note}`
- `checkins` [date]: `{id, date, weightKg, photoIds:[], waistCm, hipsCm, chestCm, energy:1-5, hunger:1-5, sleepH, flags:[], note}`
- `photos` [checkinId, date]: `{id, checkinId, date, pose:'front'|'side'|'back', blob}`
- `meds`: `{id, name, class, route, strength, strengthUnit, dose, doseUnit, active:true,
  schedule:{type:'weekly'|'daily'|'everyN'|'custom'|'asNeeded', everyN, weekdays:[0-6], time:'HH:MM', start, end},
  titration:[{from, dose}], missed:{windowHours, minHoursBeforeNextDose, minHoursBetweenDoses}, refId, notes}`
- `doses` [medId, scheduledAt]: `{id, medId, scheduledAt: ISO|null, takenAt: ISO, status:'taken'|'late'|'skipped',
  doseAmount, doseUnit, siteId, note}`  (`scheduledAt` must be `slot.scheduledAt.toISOString()` when logging a slot)
- `inventory` [medId]: `{id, medId, kind:'pen'|'vial', label, strength, total, remaining, unit:'doses'|'mg',
  openedDate, discardAfterDays, expiry, costCad, mixedDate, diluentMl, concMgMl}`
- `foods`: `{id, name, kcal, protein, carbs, fat, serving}`
- `foodLog` [date]: `{id, date, time:'HH:MM', foodId, name, qty, kcal, protein, carbs, fat}` (per-serving values; totals multiply by qty)
- `waterLog` [date]: `{id, date, time, ml}`
- `vitamins`: `{id, name, amount, unit, nutrientKey, time:'HH:MM', active:true}` (`nutrientKey` = a `dri[].key` or '')
- `vitaminLog` [date]: `{id, date, vitaminId, takenAt}`
- `sideEffects` [date]: `{id, date, type, severity:1-5, note, medId}`
- settings keys in use: `theme`, `bigText`, `disclaimerAck`, `sites` (array of `{id,label}`), `waterStepMl`, `lowAppetite`,
  `checkinDay` (0-6), `notify`.

## Other helpers

```js
import { todayISO, toISODate, parseISODate, atTime, addDays, daysBetween, fmtDate, fmtTime, fmtDateTime, relTime, nowTime, WEEKDAYS } from '../dates.js';
import { fmtWeight, fmtDelta, toKg, fromKg, UNIT_OPTIONS } from '../units.js';   // weights are stored in kg
import { notify, requestNotify, saveFile, pickFile, takePhoto, resizeImage } from '../platform.js';
```

Logic modules (pure, tested with Node; read the file header for details):

- `logic/schedule.js`: `SCHEDULE_TYPES, isDueOn, dueTimes, doseOn(med,date), timeline(med,doses,now,{daysBack,daysAhead}),
  nextDue(med,doses,now), lastTaken, hoursSinceLast, tooSoon(med,doses,now), adherence(med,doses,now,days), streak,
  DEFAULT_SITES, nextSite(sites, allDoses), describeSchedule(med)`.
  `timeline` slots: `{scheduledAt:Date, status:'taken'|'late'|'skipped'|'missed'|'overdue'|'due'|'upcoming', record, dose:{amount,unit}, cutoff:Date}`.
- `logic/calc.js`: `reconstitute({vialMg,diluentMl,dose,doseUnit}) -> {ok,errors,warnings,concMgMl,doseMg,drawMl,units,dosesPerVial,formulas}`,
  `unitsToDose({vialMg,diluentMl,units})`, `vialLife({vialMg,doseMg,dosesPerWeek})`, `fmt(n,dp)`.
- `logic/rate.js`: `tier(weights, endDate, tiers, {stillEscalating}) -> {key,label,kind,text,note,rate}`, `weeklyRate`, `trendWeight`, `weeksToGoal`.
- `logic/targets.js`: `suggest(profile, currentKg) -> {calories,protein,water,fibre,missing,bmi,...}`, `effective(profile, suggestion) -> {kcal,proteinG,waterMl,fibreG}`,
  `calorieLevel(kcal, sex) -> 'ok'|'warn'|'strong'`, `calorieFloors(sex)`, `ageFrom(birthYear)`.
- `logic/nutrition.js`: `dayTotals(entries)`, `waterTotal(entries)`, `weekSummary(logsByDate, targets)`, `driFor(row, sex, age)`, `overUpperLimit(supplements, dri, sex, age)`.

## Data files (fetch once per view: `await (await fetch('data/reference.json')).json()`)

`data/reference.json`: `{verified:false, checkedOn, passes:[{pass,title,groupOrder,useFilters,notes,openQuestions,count}], entries:[...]}`.
Entry fields (all passes): `id, pass:'R1'|'R2'|'R3', names:{generic, brands[]}, class, group, usedFor[], route[],
status:'approved_ca'|'approved_elsewhere'|'investigational'|'not_approved_limited_evidence',
statusDetail:{healthCanada, fda, other, checkedOn, sourceIds}, indications[], mechanism, products[{brand,din,strengths[],device,monographUrl,monographDate}],
doseInfo[{basis:'monograph'|'trial', population, regimen, maxDose, durationOrContext, sourceIds}],
missedDose:{text, windowHours, minHoursBeforeNextDose, minHoursBetweenDoses, sourceIds}, storage:{unopened,inUse,discardAfterDays,sourceIds},
commonSideEffects[], warnings[], contraindications[], interactions[], nutritionNotes[], evidenceLevel,
sources[{id,title,publisher,url,publishedOrRevised,accessed,type}], lastReviewed, openQuestions[]`.
R1 adds `deviceNotes, specialPopulations`. R2 adds `statusTimeline, trialProgramme, efficacySummary, unpublished`.
R3 adds `wada, humanEvidence[], proven[], unproven[], unknown[], safetyConcerns[]`. Fields may be missing, empty strings or empty
arrays: always guard. Array items are usually strings but may be objects; render objects as their values joined with ": ".

`data/targets.json`: `{verified:false, topics:[{id,topic,group,summary,items:[{label,value,population,confidence,note,sourceIds}],
tables:[{title,columns,rows,sourceIds,note}], statements[], sources[], openQuestions[]}], dri:[{key,name,unit,kind,men,women,ul,ulNote}]}`.
Topic ids: `weight-loss-rate, energy, protein, fluids-fibre-gi, micronutrients, warning-signs`.

## Testing your work

```
node tools/smoke.mjs "#/yourroute" "#/yourroute/sub" --seed --shot=shots
```
Opens each route in headless Chrome at phone size, prints the first text on the screen, saves screenshots, and
fails on any JavaScript error. `--seed` loads sample data from `tools/seed.mjs` (profile, 5 weeks of weights, one weekly
med with doses, foods, water, a vitamin, a vial). Look at your screenshots (Read the PNG) before you finish.
Pure logic can also be tested with `node --test tests/`.
