# Hoodi — Hyperlocal Community Platform

A full-stack hyperlocal platform connecting neighbors for everyday tasks, peer-to-peer skill learning, and community mutual aid.

## Architecture

- **`backend/`**: Django 6.x + Django REST Framework + SimpleJWT (Python 3.13)
  - `accounts`: Custom User authentication, profiles, verification, and JWT endpoints.
  - `help_requests`: Errand/delivery requests, 5 km radius matching (Haversine formula), real-time chat, helper tracking.
  - `skills`: Peer-to-peer teacher profiles, skill offerings, booking slots, and reviews.
  - `payments`: User wallets, transaction ledger, and commission simulation (10–20% platform fee).
  - `ai_services`: Heuristic & AI categorization and urgency/fare estimation.
  - Interactive API docs (Swagger / Redoc) at `/api/docs/` and `/api/redoc/`.

- **`frontend/`**: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
  - Hoodi Help UI: Errand request creator with live fare estimation, nearby map, task tracking.
  - Hoodi Skills UI: Marketplace for booking lessons and teacher profile management.
  - Admin dashboard: User and moderation management.

- **`mobile/`**: Planned cross-platform Flutter application consuming the exact same Django REST API.

---

## Quick Start

### 1. Backend Setup (Django)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python seed_demo_data.py
python manage.py runserver 127.0.0.1:8000
```

- API Documentation: http://127.0.0.1:8000/api/docs/
- Django Admin: http://127.0.0.1:8000/admin/

### 2. Frontend Setup (React)

```powershell
cd frontend
bun install     # or npm install --legacy-peer-deps
bun run dev     # or npm run dev
```

- Web UI: http://localhost:8080
