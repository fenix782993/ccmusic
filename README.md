# FENIX MUSIC 12.0 FULL

Single-service FENIX MUSIC: FastAPI + PostgreSQL/SQLite + one-file frontend.

## Music folders
- `backend/media/music/` — manual music files
- `backend/media/audio/` — files uploaded through admin panel
- `backend/media/covers/` — uploaded covers

Filename for manual import: `Artist - Title.mp3`.

## Render
Build: `pip install -r requirements.txt`
Start: `PYTHONPATH=/opt/render/project/src python -m backend.run_all`
Health: `/health`

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Render. Database is PostgreSQL from `render.yaml`.

For persistence of uploaded media across redeploys, use a Render Persistent Disk and point `MEDIA_DIR` to its mount path.
