# Manhwa Aggregator

Manga/manhwa update aggregator with Discord bot notifications and a reader API. Scrapes updates from Indonesian manga sources (Ikiru, Shinigami) and delivers them to subscribed Discord channels.

## Project Structure

```
manhwa-aggregator/
├── backend/                    # Unified backend (1 Vercel deployment)
│   ├── api/
│   │   ├── reader.ts          # Reader API (latest, search, manga, pages, debug)
│   │   ├── cron.ts            # Cron/sync orchestrator
│   │   ├── cron-task.ts       # Background cron runner
│   │   ├── interactive.ts     # Discord slash command handler
│   │   ├── dashboard-snapshot.ts
│   │   ├── health-status.ts
│   │   ├── history.ts
│   │   ├── incidents.ts
│   │   ├── cleanup-dispatch.ts
│   │   ├── qstash-worker.ts
│   │   ├── auth.ts
│   │   └── whitelist.ts
│   ├── lib/                   # Discord bot logic
│   │   ├── auth/              # Authentication
│   │   ├── commands/          # Slash commands
│   │   ├── cron/              # Cron job modules
│   │   ├── discord/           # Discord API utilities
│   │   └── services/          # Storage, dispatch, notifications
│   ├── reader/                # Reader-specific config
│   │   └── config.ts
│   ├── shared/                # Shared code (scrapers, types, utils)
│   │   ├── scrapers/          # Scraper engines (Ikiru, Shinigami)
│   │   ├── providers/         # Provider registry
│   │   ├── types/             # TypeScript types
│   │   └── config/            # Environment config
│   ├── supabase/              # Database migrations
│   ├── public/                # Dashboard static assets
│   └── vercel.json            # Vercel deployment config
│
└── frontend/                  # Next.js reader UI (separate deployment)
    ├── app/
    │   ├── page.tsx           # Home / latest updates
    │   ├── search/            # Search page
    │   └── manga/             # Manga detail + chapter reader
    ├── components/
    └── lib/
```

## Tech Stack

- **Runtime**: Node.js + TypeScript (ESM)
- **Backend**: Express.js (dev) / Vercel Functions (production)
- **Frontend**: Next.js 15 + Tailwind CSS
- **Storage**: Supabase (PostgreSQL)
- **Discord**: Discord Interactions API
- **Queue**: Upstash QStash

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/aldifhr/manhwa-aggregator.git
cd manhwa-aggregator

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Configure Environment

Copy and edit `.env` in `backend/`:

```bash
cd backend
cp .env.example .env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `DISCORD_PUBLIC_KEY` | Discord application public key |
| `DISCORD_BOT_TOKEN` | Discord bot token |
| `DISCORD_APPLICATION_ID` | Discord application ID |
| `DASHBOARD_PASSWORD` | Dashboard access password |
| `DASHBOARD_SESSION_SECRET` | Session signing secret (min 32 chars) |
| `CRON_SECRET` | Cron API authorization secret |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

### 3. Run Locally

```bash
# Backend (port 3000)
cd backend
npm run dev

# Frontend (port 3001)
cd frontend
npm run dev
```

- Dashboard: http://localhost:3000
- Reader UI: http://localhost:3001

### 4. Deploy to Vercel

**Backend** (1 Vercel project):
```bash
cd backend
vercel --prod
```

**Frontend** (1 Vercel project):
```bash
cd frontend
# Set NEXT_PUBLIC_API_URL to your backend Vercel URL
vercel --prod
```

## API Endpoints

### Reader API (public)

| Endpoint | Description |
|----------|-------------|
| `GET /api/latest?source=all&page=1` | Latest updates from all sources |
| `GET /api/search?q=naruto&source=all` | Search manga by title |
| `GET /api/manga/:id?source=shinigami` | Manga detail + chapters |
| `GET /api/pages?url=<chapter-url>` | Extract chapter page images |

### Discord Bot API (protected)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/interactive` | Discord signature | Slash command handler |
| `POST /api/cron` | `CRON_SECRET` | Trigger sync/scan |
| `POST /api/cron-task` | `CRON_SECRET` | Background cron runner |
| `GET /api/dashboard-snapshot` | Session/`CRON_SECRET` | Dashboard stats |
| `GET /api/health-status` | Public | Service health |
| `GET /api/incidents` | Public | Incident logs |
| `GET /api/history` | Session | Dispatch history |
| `GET/POST /api/whitelist` | Session | Whitelist management |
| `POST /api/cleanup-dispatch` | `CRON_SECRET` | Cleanup expired dispatches |
| `POST /api/qstash-worker` | QStash signature | Queue worker |
| `GET /api/auth` | - | Auth endpoints |

## Discord Slash Commands

| Command | Description |
|---------|-------------|
| `/add url <link>` | Add manga to whitelist |
| `/remove <query>` | Remove manga from whitelist |
| `/setchannel <channel>` | Set notification channel |
| `/follow list [page]` | View followed mangas |
| `/follow unfollow <title>` | Unfollow a manga |
| `/list [page] [search]` | View whitelist |
| `/status` | Check system status |
| `/permission <add/remove/list>` | Manage permissions |
| `/sync` | Force manual sync (admin) |

## Development

```bash
# Backend
cd backend
npm run dev          # tsx watch
npm run dev:vercel   # Vercel dev server
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
npm run test         # Vitest

# Frontend
cd frontend
npm run dev          # Next.js dev server
npm run build        # Production build
```

## License

ISC
