# Local Only Setup

This setup is for local development without Neon, Supabase, Vercel, Render, tunnels, or Google Drive API.

GitHub stores code. The backend project file stores current local content. Google Drive stores exported content backups. Browser `localStorage` is not authoritative game content storage.

## First Setup

1. Clone or update the repository:

```bash
git pull
```

2. Install dependencies:

```bash
npm install
```

3. Create `apps/backend/.env.local`:

```env
NODE_ENV=development
APP_ENV=local
PORT=3000
CONTENT_STORAGE_MODE=file
CONTENT_DATA_DIR=./data
CONTENT_DATA_FILE=theend_content.local.json
CORS_ORIGIN=http://localhost:5173
```

4. Create `apps/frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_ALLOW_CONTENT_IMPORT=true
VITE_CONTENT_BACKUP_SOURCE=local
```

5. Start the backend:

```bash
npm run dev:backend
```

6. Start the frontend:

```bash
npm run dev:frontend
```

7. Open:

```text
http://localhost:5173
```

Check backend health:

```text
http://localhost:3000/health
http://localhost:3000/api/health
```

In file mode, the health response should show `storageMode: "file"`, `contentFile: "theend_content.local.json"`, and `contentStorage: "readable-writable"`.

## Content Workflow

Admin Save writes to the backend project file:

```text
apps/backend/data/theend_content.local.json
```

Admin Export creates a JSON backup from backend/project storage. Upload that JSON manually to Google Drive.

On another PC:

1. Pull code from GitHub.
2. Download the latest JSON backup from Google Drive.
3. Start backend and frontend locally.
4. Admin Import the backup.
5. Use Replace all for normal laptop/home handoff.

## Storage Rules

The local working content file is ignored by Git. This prevents daily admin edits from being committed by accident.

Committed files may include stable examples or seeds only:

```text
apps/backend/data/theend_content.example.json
apps/backend/data/README.md
apps/backend/data/seeds/
```

Browser storage may still hold harmless UI state, selected tabs, filters, temporary runtime/player state, and editor preferences. It must not be the source of truth for quests, dialogues, NPCs, items, skills, cities, maps, zones, markers, merchants, loot tables, or image metadata.

## Moving Between Computers

Before switching PC:

1. Admin Export.
2. Upload the JSON to Google Drive.

On the other PC:

1. Git pull.
2. Download the JSON from Google Drive.
3. Admin Import.
4. Continue editing.

## Future Migration

The latest export JSON can later be imported into a production backend or database.

Frontend should only need `VITE_API_BASE_URL` changed for another backend URL.

Backend storage can later switch from `CONTENT_STORAGE_MODE=file` to a server/database mode without changing the Admin UI workflow.

## Recovery

If local content becomes broken:

1. Stop editing.
2. Export the broken state if the backend still responds.
3. Restore the latest good Google Drive backup through Admin Import.
4. If the content file itself is unreadable, move `apps/backend/data/theend_content.local.json` aside and restart the backend. A clean file will be created from the example or empty snapshot.
