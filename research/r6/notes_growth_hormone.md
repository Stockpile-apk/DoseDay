# R6 notes: growth hormone (somatropin, growth-hormone-weekly)
Checked 2026-11-17. Output: research/r6/r6_growth_hormone.json (2 entries). DPD reached via WebFetch only; the host was flaky (many SERVER_ERROR retries).

## DPD findings (drug code -> DIN, status)
Genotropin (Pfizer), PM 00056686 (PDF revision 2020-06-22; DPD link date 2020-06-10)
- GoQuick: 88658 -> 02401681 5 mg (marketed); 88659 -> 02401703 5.3 mg (marketed); 88660 -> 02401711 12 mg (marketed 2013-09-18)
- MiniQuick 0.2-2.0 mg: 88662-88671 -> 02401746 ... 02401835. Status checked: 88662 marketed (2020-09-17), 88666 marketed (2013-09-18). Others not individually checked; DIN-to-strength mapping not verified.
Omnitrope (Sandoz), PM 00075677 (2024-05-23)
- 81047 -> 02325055 vial: cancelled pre market 2023-10-30
- 81048 -> 02325063 5 mg/1.5 mL: marketed 2009-04-20
- 81049 -> 02325071 (10 mg/1.5 mL by elimination): marketed 2009-04-20
- 94695 -> 02459647 15 mg/1.5 mL: marketed 2017-08-14
Norditropin (Novo Nordisk), PM 00084418 (authorized 2026-04-20). PEDIATRIC ONLY in Canada ("not indicated for use in adults").
- FlexPro 101843 -> 02529181 5 mg: DORMANT 2026-07-24; 101844 -> 02529203 10 mg: marketed 2022-12-07; 101845 -> 02529211 15 mg: marketed 2022-12-07
- NordiFlex 82048/82049/82050: cancelled post market 2023; SimpleXx 82056/82057 cancelled 2015; 82055 not fetched
Saizen (EMD Serono), PM 00085900 (authorized 2026-08-28)
- 61332 -> 02237971 5 mg vial: marketed 1999-10-26; 83536 -> 02350122 6 mg cart: marketed 2010-12-02; 83537 -> 02350130 12 mg: marketed; 83538 -> 02350149 20 mg: marketed
- 61331 -> 02237970 (1.33 mg kit): cancelled pre market 2014-12-12; 43151, 75761 not fetched (old records)
Humatrope (Lilly): 66943/66944/66945 (02243077/78/79 cartridges 6/12/24 mg) cancelled post market Dec 2025 (2025-12-22, 12-22, 12-18); 8187 cancelled 2021; 47803 cancelled 2001
Nutropin AQ: NuSpin 5/10/20 (88400/86186/88398) cancelled post market 2025-01-31; 73387 cancelled 2017; 47897 cancelled 2013
Zomacton: no DPD record (brand search empty)

Sogroya (somapacitan, Novo Nordisk), PM 00084815 (authorized 2026-05-22; adults + children >=2.5 y)
- 102866 -> 02539934 5 mg/1.5 mL; 102867 -> 02539942 (10 mg by elimination); 102868 -> 02539950 15 mg; all marketed 2023-11-27
Ngenla (somatrogon, Pfizer), PM 00085329 (authorized 2026-07-13; pediatric only)
- 101087 -> 02521679 24 mg/1.2 mL (20 mg/mL); 101089 -> 02521687 60 mg/1.2 mL (50 mg/mL); marketed 2022-02-22
Skytrofa (lonapegsomatropin): DPD brand and generic-name searches empty. FDA (DailyMed, revised 9/2025): children >=1 y and >=11.5 kg, adults with GHD; initial US approval 2021.

## Key dose facts
- Genotropin/Omnitrope adult: 0.15-0.3 mg/day, titrate by response/IGF-1 (not above ULN), max daily maintenance 1.33 mg
- Saizen adult: 0.005 mg/kg/day, may rise to 0.01 mg/kg/day after 4 weeks; final dose "seldom exceeds 1.0 mg/day"
- Sogroya adult: 1.5 / 1.0 (60+) / 2.0 (oral estrogen) mg weekly, steps 0.5-1.5 mg every 2-4 weeks, max 8 mg/week; pediatric 0.16 mg/kg/week
- Ngenla pediatric 0.66 mg/kg/week
- Missed weekly dose: both within 3 days (72 h). Day change: Sogroya >=4 days (96 h); Ngenla >=3 days (>72 h). Stored as missedDose.byProduct.

## WADA
2026 List S2.2.3 (GH, analogues and fragments; names lonapegsomatropin, somapacitan, somatrogon), prohibited at all times. wada-ama.org blocked for automated fetch (robots); used SEGAS-hosted copy (same as R3). 2027 list in force 2027-01-01 per USADA advisory; no S2 GH change described.

## Unresolved
- Genotropin Canadian PM is from 2020; no newer revision found
- Norditropin Serious Warnings box text not extracted; Saizen cartridge leaflet missed-dose text cut off
- Sogroya/Ngenla DPD product pages did not load; PM links matched by monograph content
- FDA status of daily somatropin brands not re-verified; Skytrofa EMA not checked
- Added non-schema fields: missedDose.byProduct, storage.byProduct, listSourceIds
