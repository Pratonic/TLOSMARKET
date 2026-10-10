# TLOS Market Simulation (Round 4)

A complete, production-ready, Next.js web application for a live stock-market simulation event.

## Architecture

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (Strict Mode)
- **Database**: PostgreSQL (Neon / Vercel Postgres) via Prisma ORM
- **State Math**: Pure deterministic engine using `decimal.js` for financial accuracy (no JS floats).
- **Authentication**: JWT (jose) in httpOnly cookies + bcryptjs for team passwords. Role-based server-side checks.
- **Real-time**: Cheap HTTP polling every 2s using `SWR` and `ETag`/`304 Not Modified` headers.
- **UI**: Tailwind CSS, shadcn/ui, framer-motion, recharts.

## Features

- **Strict forward-only state machine**: PORTFOLIO -> GOOD Events -> REVEAL GOOD -> BAD Events -> REVEAL BAD -> FINAL DECISION -> END.
- **Concurrency safe**: Row-level locking (`SELECT FOR UPDATE`) and atomic conditional updates ensure no race conditions when teams buy the last shares in the pool.
- **Absolute Secrecy**: Player endpoints only read from explicitly created snapshots. Admin endpoints never leak live event configurations or other teams' data to players.
- **Deterministic Scoring**: Financial return, Decision Quality (dynamically evaluates the options a team could afford), Risk Management (diversification & downside control), and manual judge bonuses.
- **Export to PDF**: Fully automated PDF generation of the final scoreboard and per-team reports for the top 5 using `@react-pdf/renderer`.

## Vercel Deploy Steps

1. Create a new project on Vercel and import the repository.
2. Under "Storage", create a new **Vercel Postgres** database and link it to the project. This will automatically populate `DATABASE_URL`.
3. Go to Project Settings > Environment Variables, and add:
   - `SESSION_SECRET`: A random string of at least 32 characters.
   - `ADMIN_USERNAME`: Your chosen admin username (e.g., `admin`).
   - `ADMIN_PASSWORD`: Your chosen admin password (e.g., `ECELL_ADMIN`).
4. Ensure the `package.json` contains a `postinstall` script: `"postinstall": "prisma generate"`. (This is already included).
5. Deploy.
6. Once deployed, run the seed script to populate the initial game state, companies, and events:
   `npx prisma db seed` (You can do this via Vercel CLI `vercel env pull` locally and then `npx prisma db seed`, or setup a deployment hook).

## Local Development

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Run database migrations and seed
npx prisma migrate dev
npx prisma db seed

# Run tests
npm run test

# Start development server
npm run dev
```

## Deviations & Assumptions from PDF Spec

1. **Option Downgrading**: If a team chooses an Aggressive option but lacks the cash to pay the fee at resolution, the engine automatically downgrades them to Moderate, and then to Pass if still unaffordable. The PDF mentioned "reduce shares enrolled" as a potential handling; we instead downgrade the *option* entirely to ensure determinism and avoid fractional share arithmetic complexities, which provides a cleaner strategic penalty.
2. **Event Order**: The strict phase machine applies events in the exact order: G1, G2, G3, B1, B2, B3.
3. **Net Worth Delta in Bad Events**: When exiting, the team gains cash but loses the asset. The Net Worth delta reflects this total value change (Cash gained minus total prior value of holding), rather than just the exit discount.
4. **SWR Polling**: As per Vercel's lack of WebSocket support, real-time updates are handled via SWR polling every 2 seconds. The server uses a monotonically increasing `gameVersion` counter and ETags to return HTTP 304 instantly, making this highly scalable.
