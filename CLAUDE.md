# ADAS Estimate Scrubber

## Project Overview

ADAS Estimate Scrubber analyzes auto body repair estimates and identifies which repair operations require ADAS (Advanced Driver Assistance Systems) calibrations based on OEM position statements.

## Project Structure

```
adas-scrubber/
├── data/                    # OEM Position Statements (JSON)
│   └── Toyota/
│       └── 2024-toyota-camry.json
├── prisma/
│   ├── schema.prisma        # Database schema
│   ├── seed.ts              # Seeds DB from JSON files
│   └── migrations/          # SQLite migrations
├── src/
│   ├── app/
│   │   ├── page.tsx         # Main scrubber UI
│   │   ├── layout.tsx       # Root layout
│   │   └── api/
│   │       ├── scrub/route.ts           # POST - Analyze estimate
│   │       └── vehicles/
│   │           ├── route.ts             # GET - List vehicles
│   │           └── [id]/adas-systems/route.ts  # GET - Vehicle ADAS systems
│   └── lib/
│       ├── prisma.ts        # Prisma client singleton
│       └── scrubber.ts      # Core scrubbing logic
├── package.json
└── tsconfig.json
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: SQLite via Prisma ORM
- **Styling**: Tailwind CSS

## Quick Start

```bash
npm install
npx prisma migrate dev    # Create database
npm run db:seed           # Load OEM data
npm run dev               # Start at http://localhost:3000
```

## Key Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run db:seed      # Seed database from /data JSON files
npm run db:migrate   # Run Prisma migrations
npm run db:studio    # Open Prisma Studio
```

## How It Works

1. OEM position statements are stored as JSON in `/data/{Make}/{year-make-model}.json`
2. The seed script loads JSON files into the SQLite database
3. When a user pastes an estimate, the scrubber:
   - Parses each line
   - Matches keywords from `repair_to_calibration_map`
   - Returns which ADAS systems need calibration

## Adding New Vehicles

1. Create a JSON file in `/data/{Make}/{year-make-model}.json` with this structure:
```json
{
  "vehicle": { "year_start": 2024, "year_end": 2024, "make": "Toyota", "model": "Camry" },
  "source": { "provider": "I-CAR RTS", "url": "...", "date_extracted": "2026-01-28" },
  "adas_systems": [...],
  "repair_to_calibration_map": [...]
}
```
2. Run `npm run db:seed` to reload the database

## API Endpoints

- `GET /api/vehicles` - List all vehicles
- `GET /api/vehicles/:id/adas-systems` - Get ADAS systems for a vehicle
- `POST /api/scrub` - Analyze estimate text
  - Body: `{ estimateText, vehicleYear, vehicleMake, vehicleModel }`
