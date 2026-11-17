# R6 brief: prescription hormones (DoseDay reference library)

Read research/RESEARCH_PLAN.md sections 1 and 2 first and follow them exactly. Key rules:
- Search first. Never write a dose, status, date, DIN or warning from memory. Every claim cites a source in that entry's `sources`.
  Anything you cannot verify goes in `openQuestions`, not in the data.
- Source order: Health Canada (Drug Product Database, product monographs at pdf.hres.ca, advisories) > FDA labels / EMA > peer-reviewed trials > major guidelines (Endocrine Society, CUA).
- No vendor, clinic, pharmacy, price, purity or sourcing information. No community or bodybuilding protocols.
- Describe, never instruct ("the monograph lists", never "take").
- Off-label use (for example clomiphene, hCG or anastrozole in men) gets NO dose rows. Write one line in `indications` or `warnings` saying the
  Canadian monograph does not include that use, and cite the monograph's actual indications. Do not cite forums or clinic sites for off-label doses.
- Canadian focus. `checkedOn` and `accessed` = the date you fetched (2026-11-17).

Access (the shell cannot reach Health Canada; use WebFetch):
- DPD by brand: https://health-products.canada.ca/api/drug/drugproduct/?lang=en&type=json&brandname=NAME
- DPD by code: .../api/drug/drugproduct/?lang=en&type=json&id=CODE ; status: .../api/drug/status/?lang=en&type=json&id=CODE ;
  ingredients: .../api/drug/activeingredient/?lang=en&type=json&id=CODE (the ingredientname= search is currently failing; search by brand instead)
- Product monograph: find the PM link via the DPD web page https://health-products.canada.ca/dpd-bdpp/info?lang=eng&code=CODE (the page lists
  "Product Monograph/Veterinary Labelling" with a pdf.hres.ca URL and date). Monograph PDFs: https://pdf.hres.ca/dpd_pm/000NNNNN.PDF
  When you WebFetch a PDF, ask for the exact sentences you need (dose, titration, max, missed dose, storage, contraindications, serious warnings),
  and quote numbers exactly. If the fetch tool summarizes, ask again for the verbatim text of that section.
- Do not run parallel WebFetch calls against the same host; go one at a time.

Output: one JSON array file per assignment (path given in your task), entries in the RESEARCH_PLAN schema plus these fields:
  "group": "Hormones and related", "usedFor": [plain short uses], "specialPopulations": [], "deviceNotes": [],
  "missedDose": {"text": "", "windowHours": null, "minHoursBeforeNextDose": null, "minHoursBetweenDoses": null, "sourceIds": []},
  "wada": "" (World Anti-Doping status in one line, cite the WADA Prohibited List page if you state it).
Every `sourceIds` value must exist in that entry's `sources`. `status` is one of approved_ca | approved_elsewhere | investigational |
not_approved_limited_evidence. Entries that are approved in Canada need at least one doseInfo row with basis "monograph".
Validate with: node research/r6/check.mjs <yourfile.json>
Also write a short log research/r6/notes_<name>.md (DINs and drug codes found, PM numbers and dates, anything unresolved).
Final report: 8 lines max (entries, source count, open questions, anything you could not verify).
