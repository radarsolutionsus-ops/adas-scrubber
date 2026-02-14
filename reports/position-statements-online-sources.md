# Position Statement Coverage and Source Gaps

Generated: 2026-02-14

## Local data audit summary

- Total OEM folders: 34
- Position statement PDFs found: 64
- JSON datasets found: 35
- Parseable PDFs: 64/64
- JSON files with citation/schema issues: 28/35
- Makes with JSON but no local PDFs:
  - BMW, Dodge, Infiniti, Jaguar, Jeep, Land Rover, Lincoln, Mercedes, MINI, Porsche, Ram, Rivian, Tesla, Toyota, Volkswagen

## Highest-priority data quality gaps

- `source.url` is not a canonical web URL in most JSON files (many use filenames/local paths only).
- `data/Honda/honda-all-models.json` has one mapping row with missing keyword/trigger arrays.
- `data/Hyundai/Hyundai_Pos_Pre-Repair-and-Post-Repair-System-Scanning_Revised(6-3-25).pdf` yields very low extractable text (likely scanned image quality issue).

## Official source portals to backfill missing statements

- Toyota / Lexus / Scion: https://techinfo.toyota.com
- Volkswagen (VW): https://volkswagen.erwin-store.com/erwin/showHome.do
- Audi: https://audi.erwin-store.com
- BMW / MINI: https://bmwtechinfo.bmwgroup.com
- Mercedes-Benz: https://www.startekinfo.com
- Porsche: https://www.porschetechinfo.com
- Tesla collision support: https://www.tesla.com/support/collision-support
- Rivian service docs + collision network:
  - https://rivian.com/support/article/emergency-response-guides
  - https://rivian.com/support/article/certified-collision-centers
- Jaguar / Land Rover (TOPIx): https://topix.jaguar.jlrext.com/topix/content/document/view?id=469678
- Nissan / Infiniti: https://www.nissan-techinfo.com
- Stellantis (Dodge / Jeep / Ram / Chrysler) service portal: https://www.techauthority.com

## What to add for "fully loaded" credibility

- For each make/model-year dataset, add at least these statement classes where OEM provides them:
  - Pre/post repair scanning
  - Windshield/glass replacement and camera/radar recalibration
  - Bumper cover replacement/repair + radar/sonar calibration
  - Steering angle sensor initialization/relearn
  - Blind spot / rear cross traffic / around-view calibration
  - EV/high-voltage ADAS sensor handling (where applicable)
- Add metadata per source statement:
  - OEM publication date
  - revision number/bulletin ID
  - canonical URL
  - local archived file hash (SHA256)
- Rebuild JSON mappings from latest statement versions and re-seed DB.
