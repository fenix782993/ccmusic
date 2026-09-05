# FENIX MUSIC FULL

Single-service FastAPI + PostgreSQL + single-file frontend. The frontend is kept in `frontend/index.html`.

## Local

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
python backend/run_all.py
```

Open http://127.0.0.1:8000

## Render

Build: `pip install -r requirements.txt`
Start: `python backend/run_all.py`
Root: `.`

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Render.

## Music

Manual files: `backend/media/music/Artist - Title.mp3`
Admin uploads: `backend/media/audio/`

## Android

The `android/` directory is a native WebView wrapper. It points at the Render deployment URL. With Android SDK + Gradle installed:

```bash
cd android
./gradlew assembleDebug
./gradlew bundleRelease
```

For a signed Play release, configure your own signing key in `android/app/build.gradle`.
