# R5 verification report: pass R1 (approved in Canada)

Checked 2026-11-17 by a separate session from the one that wrote R1. Every dose, maximum dose, missed-dose rule and storage rule in the 9 R1 entries was re-opened in the primary source and compared.

**Counts:** 9 entries checked · 1 corrected (status note added) · 0 dose, missed-dose or storage errors found · 1 source conflict resolved · 0 unresolved.

## What changed

| Entry | Field | Old | New | Source |
| --- | --- | --- | --- | --- |
| liraglutide-t2d (Victoza) | statusDetail.healthCanada, warnings | No mention of discontinuation | Discontinuation anticipated 2027-01-01 (DIN 02351064), business reasons | [Drug Shortages Canada report 240246](https://healthproductshortages.ca/shortage/240246) |
| all 9 | lastReviewed, verifiedR5 | 2026-11-15 | 2026-11-17 | this report |

## Checked and confirmed

| Entry | Monograph checked | Confirmed |
| --- | --- | --- |
| semaglutide-injection-t2d (Ozempic) | [Ozempic PM, authorized 2026-04-14](https://pdf.hres.ca/dpd_pm/00084255.PDF) (R1 cites the 2026-07-13 version) | 0.25 → 0.5 → 1 → 2 mg steps, 4 weeks each, max 2 mg; missed dose within 5 days; in use below 30 °C for 8 weeks |
| semaglutide-injection-weight (Wegovy) | [Wegovy PM, authorized 2026-10-02](https://pdf.hres.ca/dpd_pm/00086293.PDF) | Escalation to 2.4 mg at week 17; 1.7 mg for up to 4 weeks if not tolerated; adolescent rule; missed dose 48-hour rule and the more-than-2-missed rule; single-use pen 28 days below 30 °C; multi-use pen 8 weeks after first use |
| semaglutide-oral-t2d (Rybelsus) | [Rybelsus PM, authorized 2026-07-13](https://pdf.hres.ca/dpd_pm/00085311.PDF) | 3/7/14 mg and 1.5/4/9 mg steps, 30 days each; missed dose skipped; 15 to 30 °C |
| tirzepatide-t2d (Mounjaro) | [Mounjaro PM, authorized 2026-06-23](https://pdf.hres.ca/dpd_pm/00085122.PDF) and [Lilly Canada storage FAQ](https://www.lilly.com/en-CA/resources/faq/mounjaro-kwikpen/storage-mounjaro-kwikpen) | 2.5 mg start, 2.5 mg steps every 4 weeks, max 15 mg (paediatric max 10 mg, caution above 5 mg at 60 kg or less); missed dose within 4 days; 72-hour day change; KwikPen 30 days, discard after 4 doses |
| tirzepatide-weight (Zepbound) | [Zepbound PM, authorized 2026-06-11](https://pdf.hres.ca/dpd_pm/00084997.PDF) | Adults only; maintenance 5/10/15 mg (10/15 mg for sleep apnea); max 15 mg; missed dose within 4 days; 30 days up to 30 °C |
| liraglutide-t2d (Victoza) | [Victoza consumer information](https://www.novonordisk.ca/content/dam/nncorp/ca/en/products/victoza-consumer-information.pdf) | 0.6 → 1.2 → 1.8 mg; missed dose: next day as usual; 1 month after first use |
| liraglutide-weight (Saxenda) | [Saxenda PM, authorized 2025-09-10](https://pdf.hres.ca/dpd_pm/00081736.PDF) | Weekly steps to 3.0 mg; adolescent 2.4 mg rule; restart at 0.6 mg after more than 3 days; 30 days after first use |
| dulaglutide-t2d (Trulicity) | [Trulicity PM, revised 2024-07-05](https://pdf.hres.ca/dpd_pm/00076182.PDF) | 0.75 → 1.5 → 3 → 4.5 mg; missed dose if at least 72 hours to next; 14 days unrefrigerated at or below 30 °C |
| insulin-glargine-lixisenatide (Soliqua) | [Soliqua PM, authorized 2025-12-11](https://pdf.hres.ca/dpd_pm/00082751.PDF) | 15 or 30 unit starts; 2 to 4 unit weekly steps; max 60 units; missed dose within the hour before the next meal; in use up to 25 °C, not refrigerated, discard after 28 days |

## Conflicts between sources

- **Wegovy missed dose.** The Wegovy consumer information dated 2025-12-10 says to use a missed dose if 5 days or less have passed. The current monograph (2026-10-02) uses the 48-hour rule. The newer monograph wins, and R1 already matches it. Anyone holding an older Wegovy leaflet may see the 5-day wording.
- **Mounjaro KwikPen in-use period.** The monograph says to discard the pen after four weekly doses and allows up to 30 days unrefrigerated. Lilly Canada's FAQ adds discarding 30 days after first use. R1's `discardAfterDays: 30` matches both.

## Other checks

- No community protocols, sourcing, prices or vendor links in R1. Source domains are Health Canada, BC government, FDA, Obesity Canada, Drug Shortages Canada and two news or press pages used only for status dates.
- No wording tells the user to take or change a dose. Missed-dose text is shown in the app labelled "as listed".
- `tools/build-data.mjs` picks up `ref_R1_approved_verified.json` automatically. All 257 tests pass.

## Not done in this session

R5 for R2, R3, R4 and R6 is still to do. The app keeps showing "Not yet independently verified" until every pass has a `_verified.json` file.
