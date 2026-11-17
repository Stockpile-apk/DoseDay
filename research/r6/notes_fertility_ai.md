# R6 notes: fertility / aromatase inhibitor entries (hcg, clomiphene, anastrozole)

Checked 2026-11-17. Output: research/r6/r6_fertility_ai.json (validator: OK, 3 entries). 34 source records in total (12 + 14 + 8; the WADA and USADA sources repeat in each entry).

## hCG
| Product | Drug code | DIN | DPD status | PM | PM date |
|---|---|---|---|---|---|
| Pregnyl 10,000 USP units vial (Organon), IM | 44257 | 02182904 | Marketed (first marketed 1997-08-13) | 00071523 | 2021-03-30 (control 249487) |
| Chorionic Gonadotropin for Injection, USP 10,000 units (Fresenius Kabi), IM/SC | 71705 | 02247459 | Marketed (orig. 2004-09-13) | 00055872 | DPD 2020-04-03; PM text says 2020-04-06 (control 230972) |
| Ovidrel 250 mcg/0.5 mL (EMD Serono), SC | 85673 | 02371588 | Marketed (2013-05-28) | 00072860 | 2023-10-12 (control 274651) |
| Ovidrel (second DIN) | 74742 | 02262088 | Marketed (2004-12-20) per status API | not retrieved | product page failed (server errors) |
- Novarel: DPD brand search empty.
- Pregnyl and Fresenius monographs both say hCG should not be used for body weight reduction. The Ovidrel monograph does not say this.
- Male indications are in both the Pregnyl and Fresenius monographs (cryptorchidism, hypogonadotropic hypogonadism). The Fresenius monograph also lists older indications (delayed adolescence, pituitary dwarfism, eunuchoidism, habitual abortion, functional bleeding or sterility). Doses for those were not retrieved.
- No missed-dose text in the monographs.

## Clomiphene
- No marketed product in Canada. Every DIN is Cancelled Post Market: Clomid Sanofi 02091879 (code 19347, 2020-07-15; shortage DB says discontinued 2015-11-25, business reasons); Serophene EMD 00893722 (11805, 2017-07-07); Serophene Pharmascience 00640158 (6391, 2014-09-08); Clomid 50mg Merrell 00018031 (547, 1996-09-09). Brand search "clomiphene" returned nothing.
- Status set to approved_elsewhere (US: DailyMed lists Clomid by Cosette, label revised 08/2023, plus Milophene and generics). The dose row comes from the archived Canadian Clomid PM 00021924 (2013-08-09), plus a US label row. **The parent should decide whether that category is right.**
- Serophene PM 00037571 (2016-12-20) used only for the indication wording.
- A MedSask document mentions compounded bulk powder. It was left out on purpose (sourcing).

## Anastrozole
- Arimidex 1 mg, code 43395, DIN 02224135, Marketed (orig. 1996-08-30); PM 00078111, 2024-12-23 (control 289564).
- Apo-Anastrozole code 85968, DIN 02374420, Marketed (2012-10-25); PM 00080822, 2025-06-13 (not opened).
- Teva-Anastrozole code 79859, DIN 02313049: Cancelled Post Market 2018-06-11.
- The DPD brand search returned 30 generic records. The status of the other 28 was not checked because the DPD kept giving server errors.
- The missed-dose 12-hour rule comes from the PM. windowHours 12 is derived from it (once daily minus 12 h).

## WADA
- wada-ama.org blocks automated fetches (robots), so the 2026 List was read from the SEGAS-hosted copy of WADA's PDF. Sections: S2.2.1 CG/LH in males; S4.1 aromatase inhibitors (anastrozole named); S4.2 anti-estrogens/SERMs (clomifene named); all prohibited at all times.
- 2027 List (in force 2027-01-01): the USADA advisory lists no changes to these items.

## Unresolved
- Presentation of Ovidrel DIN 02262088.
- Fresenius doses for the older indications.
- FDA status for hCG and anastrozole not re-checked.
- WADA text should be confirmed on wada-ama.org directly.
