# 🏘️ Hoodi — Hyperlocal Community & Mutual Aid Super-App

[![React 19](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite%20%2B%20TypeScript-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Django 6.x](https://img.shields.io/badge/Backend-Django%206.x%20%2B%20DRF-092E20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![Flutter](https://img.shields.io/badge/Mobile-Flutter%203.x-02569B?logo=flutter&logoColor=white)](https://flutter.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Styling-Tailwind%20CSS%20v4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20%2F%20PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **"Ask your street. Help gets closer."**  
> Hoodi is an open-source, full-stack hyperlocal platform connecting verified neighbors within a strict **5 km radius** for everyday errands, peer-to-peer skill learning, local trade services, and zero-fee community mutual aid.

---

## 📖 Table of Contents

- [Vision & Value Proposition](#-vision--value-proposition)
- [The Three Product Pillars](#-the-three-product-pillars)
- [System Architecture](#-system-architecture)
- [Comprehensive Tech Stack](#-comprehensive-tech-stack)
- [Algorithmic & Engineering Highlights](#-algorithmic--engineering-highlights)
- [Database Schema & Models](#-database-schema--models)
- [Quick Start & Local Setup](#-quick-start--local-setup)
  - [1. Backend Setup (Django REST Framework)](#1-backend-setup-django-rest-framework)
  - [2. Frontend Setup (React 19 Web App)](#2-frontend-setup-react-19-web-app)
  - [3. Mobile Setup (Flutter Multi-Platform)](#3-mobile-setup-flutter-multi-platform)
- [Pre-Configured Test Accounts](#-pre-configured-test-accounts)
- [API Endpoints Reference](#-api-endpoints-reference)
- [Environment Variables (.env)](#-environment-variables-env)
- [Project Directory Structure](#-project-directory-structure)
- [Roadmap & Contributing](#-roadmap--contributing)

---

## 🌟 Vision & Value Proposition

Modern cities and suburbs suffer from a growing paradox: thousands of people live within arm's reach, yet when an emergency strikes or everyday assistance is needed, people rely on distant, corporate gig-economy apps that extract heavy commissions and offer zero personal connection.

**Hoodi fixes this by transforming physical proximity into actionable community trust:**
1. **5 km Hyperlocal Shield**: Mathematical geospatial geofencing ensures all interactions remain within walking or cycling distance.
2. **Community Mutual Aid**: Emergencies, first aid, and critical medicine runs are **100% free forever** with zero platform fees.
3. **Neighbor-to-Neighbor Economics**: Everyday tasks and tutoring provide supplemental income to neighbors, keeping 85%+ of capital circulating inside the neighborhood.
4. **Multi-Service Hub**: From asking for a ladder to learning guitar or hiring a certified electrician, everything is unified under a single Hoodi account.

---

## 🏛️ The Three Product Pillars

```
                     ┌────────────────────────────────┐
                     │         HOODI PLATFORM         │
                     │  (One Account · One Community) │
                     └────────────────┬───────────────┘
                                      │
         ┌────────────────────────────┼──────────────────────────┐
         ▼                            ▼                          ▼
┌──────────────────┐        ┌──────────────────┐       ┌──────────────────┐
│    HOODI HELP    │        │   HOODI SKILLS   │       │  HOODI SERVICES  │
├──────────────────┤        ├──────────────────┤       ├──────────────────┤
│ • 5 km Errands   │        │ • 1-on-1 Lessons │       │ • Electricians   │
│ • Medicine runs  │        │ • Mentor Search  │       │ • Plumbers       │
│ • Emergency SOS  │        │ • Skill Barter   │       │ • Appliance Fix  │
│ • Live Tracking  │        │ • Slot Bookings  │       │ • Verified Pros  │
│ • Zero-fee Aid   │        │ • Peer Reviews   │       │ • Direct Contact │
└──────────────────┘        └──────────────────┘       └──────────────────┘
```

### 1. 🚨 Hoodi Help (Everyday Errands & Mutual Aid)
- **Live Feed & Interactive Map**: Discover tasks posted within 5 km in real-time, filtered by category and urgency.
- **AI-Classified Urgency**: Heuristics and natural-language processing analyze request text to auto-tag urgency (`normal`, `today`, `emergency`).
- **Safety First**: Emergencies are permanently fee-free. Critical alerts bypass normal queues and notify nearest responders.
- **Task Lifecycle**: `open` ➔ `accepted` ➔ `in_progress` ➔ `completed` | `cancelled` with real-time in-app chat and geolocation tracking.

### 2. 🎓 Hoodi Skills (Peer-to-Peer Neighborhood Learning)
- **Hyperlocal Mentorship**: Learn guitar, yoga, spoken languages, coding, or pottery from neighbors living down your street.
- **Direct Slot Scheduling**: Teachers define recurring availability slots; students book single or recurring sessions.
- **Barter or Earn**: Support for direct skill exchange (barter) as well as fair community-rate paid lessons.
- **Teacher Portfolios**: Badges, verified reviews, bios, and cancellation policies.

### 3. 🔧 Hoodi Services (Local Trade & Expert Directory)
- **Neighborhood Handyman & Pros**: Certified electricians, plumbers, painters, appliance repair technicians, and local contractors.
- **Direct Contact Reveal**: Requesters can reveal verified phone and WhatsApp contacts once a booking is initiated.
- **Zero Middleman Exploitation**: Transparent pricing without predatory aggregator markups.

---

## 🏗️ System Architecture

Hoodi is engineered with a **Modular Monolith** architecture that balances rapid local development with industrial-grade reliability:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT INTERFACES                             │
│                                                                         │
│   ┌────────────────────────┐                   ┌────────────────────┐   │
│   │   React 19 Web App     │                   │   Flutter Mobile   │   │
│   │  (TanStack Router/SSR) │                   │ (Android/iOS/Win)  │   │
│   └───────────┬────────────┘                   └─────────┬──────────┘   │
└───────────────┼──────────────────────────────────────────┼──────────────┘
                │                                          │
                │ HTTPS / REST / WebSockets                │
                ▼                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        BACKEND API & DATA TIER                          │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Django 6.x REST API (Port 8000)                                  │   │
│  │                                                                  │   │
│  │ • accounts        : Custom User, Profiles, Verification, JWT     │   │
│  │ • help_requests   : Haversine 5km Matcher, Task FSM, Chat        │   │
│  │ • skills          : Teachers, Offerings, Slot Conflict Engine    │   │
│  │ • services        : Verified Handyman & Local Trade Directory    │   │
│  │ • payments        : Escrow Ledger, Wallet Engine, Commissions    │   │
│  │ • ai_services     : Urgency Classifier & Fare Estimator          │   │
│  └──────────────────────────────────┬───────────────────────────────┘   │
│                                     │                                   │
│  ┌──────────────────────────────────▼───────────────────────────────┐   │
│  │ Authoritative Database Tier                                      │   │
│  │ • SQLite (Zero-setup local development: db.sqlite3)              │   │
│  │ • PostgreSQL 16 + PostGIS (Production Spatial Architecture)      │   │
│  │ • Supabase BaaS (Realtime CDC WebSockets, Auth, Storage)         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 💻 Comprehensive Tech Stack

| Layer | Technologies & Libraries | Key Highlights |
| :--- | :--- | :--- |
| **Web Frontend** | **React 19**, **TypeScript**, **Vite** | Fast HMR, concurrent React 19 features, strict typing |
| **Web Routing & Data** | **TanStack Router**, **TanStack Query (v5)** | File-based type-safe routing, optimistic updates, query caching |
| **Web Styling & UI** | **Tailwind CSS v4**, **tw-animate-css**, **shadcn/ui** | Custom Warm Sand & Dark Obsidian palette, Syne + Plus Jakarta Sans fonts |
| **Mapping & Geospatial** | **Leaflet**, **OpenStreetMap**, **GeoJSON** | Interactive neighborhood map, 5 km radius circles, location picker |
| **Icons & Feedback** | **Lucide React**, **Sonner** | Clean vector iconography and rich toast notifications |
| **Mobile App** | **Flutter 3.x**, **Dart 3.x** | Native compilation for Android, iOS, Windows desktop, and Web |
| **Mobile Libraries** | `supabase_flutter`, `geolocator`, `google_fonts` | Shared Supabase backend, real-time GPS coordinate reporting |
| **Backend API** | **Django 6.1.1**, **Django REST Framework 3.18.1** | Python 3.13, modular app architecture, RESTful API design |
| **Authentication** | **SimpleJWT** (`rest_framework_simplejwt`), **GoTrue** | Bearer JWT access/refresh tokens, role-based authorization |
| **API Documentation** | **drf-spectacular** | Interactive Swagger UI (`/api/docs/`) and Redoc (`/api/redoc/`) |
| **Geospatial Engine** | **Haversine Formula** (Python) & **PostGIS** | Accurate spherical distance calculation bounded at 5.0 km |
| **Financial Engine** | **Double-entry wallet ledger** | Protected in-app wallet, escrow locking, transparent commission calculation |
| **Realtime Engine** | **Supabase Realtime WebSockets** | Instant task broadcasting, live chat messaging, location updates |

---

## ⚙️ Algorithmic & Engineering Highlights

### 1. Haversine 5 km Geospatial Geofence
All requests and helper queries calculate spherical great-circle distances:
$$\Delta\sigma = 2 \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
$$d = R \cdot \Delta\sigma \quad (\text{where } R = 6371.0 \text{ km})$$
Requests with $d > 5.0\text{ km}$ are strictly filtered out to preserve neighborhood intimacy and guarantee rapid response times.

### 2. AI Urgency Classification & Fare Estimation
When a neighbor posts an errand:
1. **Keyword Urgency Heuristics**: Natural-language scans for emergency keywords (`medicine`, `hospital`, `first-aid`, `accident`, `urgent`, `blood`) automatically set `urgency = "emergency"`.
2. **Fare Protection**:
   - Emergencies: Fare is automatically locked to **₹0.00 (Free Aid)**.
   - Standard Tasks: Base fare (₹50) + ₹15/km + category multiplier.
3. **Escrow Commission Model**:
   - Helper receives **85% net earnings**.
   - Platform collects **15%** for mutual aid insurance and server maintenance.

---

## 🗄️ Database Schema & Models

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│          custom_user            │       │          user_profile           │
├─────────────────────────────────┤       ├─────────────────────────────────┤
│ id (UUID / Int PK)              │1     1│ user_id (FK)                    │
│ email (unique)                  ├───────┤ phone_number                    │
│ name                            │       │ trust_score (Float)             │
│ is_verified (Boolean)           │       │ verification_status             │
│ is_helper, is_teacher           │       │ bio, avatar_url                 │
└────────────────┬────────────────┘       └─────────────────────────────────┘
                 │
         ┌───────┼────────────────────────┬────────────────────────┐
         │1      │1                       │1                       │1
         ▼*      ▼*                       ▼*                       ▼1
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│      help_request      │      │     teacher_profile    │      │         wallet         │
├────────────────────────┤      ├────────────────────────┤      ├────────────────────────┤
│ requester_id (FK)      │      │ user_id (FK)           │      │ user_id (1:1 FK)       │
│ helper_id (FK, null)   │      │ bio, hourly_rate       │      │ balance (Decimal)      │
│ title, description     │      │ rating, total_reviews  │      │ currency (INR)         │
│ category, urgency      │      └───────────┬────────────┘      └───────────┬────────────┘
│ latitude, longitude    │                  │1                              │1
│ status (open/accepted) │                  ▼*                              ▼*
│ estimated_fare         │      ┌────────────────────────┐      ┌────────────────────────┐
│ is_paid (Boolean)      │      │     skill_offering     │      │   wallet_transaction   │
└────────────────────────┘      ├────────────────────────┤      ├────────────────────────┤
                                │ teacher_id (FK)        │      │ wallet_id (FK)         │
                                │ title, category        │      │ amount (Decimal)       │
                                │ price_per_hour         │      │ type (credit / debit)  │
                                │ is_in_person           │      │ reference_id           │
                                └────────────────────────┘      └────────────────────────┘
```

---

## 🚀 Quick Start & Local Setup

### Prerequisites
- **Node.js 20+** or **Bun** (Frontend)
- **Python 3.11 – 3.13** (Backend)
- **Flutter 3.x SDK** (Optional, for mobile app)
- **Git**

---

### 1. Backend Setup (Django REST Framework)

```powershell
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# macOS / Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations (creates SQLite database)
python manage.py migrate

# Seed rich demonstration data (users, requests, skills, services, wallets)
python seed_demo_data.py

# Launch development server
python manage.py runserver 127.0.0.1:8000
```

- **Swagger API Documentation**: [http://127.0.0.1:8000/api/docs/](http://127.0.0.1:8000/api/docs/)
- **Redoc Documentation**: [http://127.0.0.1:8000/api/redoc/](http://127.0.0.1:8000/api/redoc/)
- **Django Admin Console**: [http://127.0.0.1:8000/admin/](http://127.0.0.1:8000/admin/)

---

### 2. Frontend Setup (React 19 Web App)

```powershell
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install --legacy-peer-deps
# or with Bun:
# bun install

# Start Vite development server
npm run dev

# Or build production bundle
npm run build
```

- **Web Application URL**: [http://localhost:8080](http://localhost:8080) (or port shown in terminal)
- **Sign In / Registration**: `/auth`
- **Neighborhood Home Hub**: `/home`
- **Admin Dashboard**: `/admin`

---

### 3. Mobile Setup (Flutter Multi-Platform)

```powershell
# Navigate to mobile directory
cd mobile

# Fetch Flutter dependencies
flutter pub get

# Run on your preferred target (Windows Desktop, Chrome, or Connected Mobile Device)
flutter run -d windows
# Or web preview:
# flutter run -d chrome
```

---

## 🔑 Pre-Configured Test Accounts

The seed script (`python seed_demo_data.py`) creates standard test accounts ready for instant 1-click login on `/auth`:

| Role | Email | Password | Pre-seeded Activity |
| :--- | :--- | :--- | :--- |
| **Helper** | `helper@hoodi.com` | `helper123` | High trust score, 8+ completed errands, active wallet |
| **Requester** | `requester@hoodi.com` | `requester123` | Multiple open tasks in neighborhood, pending requests |
| **Admin** | `admin@hoodi.com` | `admin123` | Full administrative access to `/admin` and moderation |

---

## 📡 API Endpoints Reference

### 🔐 Authentication & Accounts (`/api/auth/`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/token/` | Obtain JWT access and refresh token pair |
| `POST` | `/api/auth/token/refresh/` | Refresh expired access token |
| `POST` | `/api/auth/register/` | Register new neighbor account |
| `GET` | `/api/accounts/profile/` | Fetch current authenticated user's profile |
| `PATCH` | `/api/accounts/profile/` | Update bio, phone, address, coordinates |

### 🚨 Help Requests & Errands (`/api/help/`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/help/requests/` | List all open requests within 5 km radius |
| `POST` | `/api/help/requests/` | Create a new task (auto AI urgency tagged) |
| `GET` | `/api/help/requests/{id}/` | Get detailed request status, chat, and location |
| `POST` | `/api/help/requests/{id}/accept/` | Neighbor accepts task (atomic lock) |
| `POST` | `/api/help/requests/{id}/complete/` | Mark completed and release escrow funds |
| `POST` | `/api/help/requests/{id}/chat/` | Send private real-time message to requester/helper |

### 🎓 Peer-to-Peer Skills (`/api/skills/`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/skills/offerings/` | Browse skills offered by neighborhood teachers |
| `POST` | `/api/skills/offerings/` | Publish a new skill lesson listing |
| `POST` | `/api/skills/bookings/` | Book an available lesson slot |
| `POST` | `/api/skills/reviews/` | Submit a review and 5-star rating |

### 💳 Wallets & Ledger (`/api/payments/`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/payments/wallet/` | Retrieve current wallet balance and stats |
| `GET` | `/api/payments/transactions/` | Full double-entry transaction history |
| `POST` | `/api/payments/deposit/` | Simulate in-app wallet balance deposit |
| `POST` | `/api/payments/withdraw/` | Helper withdrawal / cash out request |

---

## 🌐 Environment Variables (.env)

A template `.env.example` is located in `frontend/`:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Backend API URL (Optional when proxying)
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

---

## 📂 Project Directory Structure

```text
hoodi/
├── backend/                    # Django 6.x REST API Subsystem
│   ├── accounts/               # Custom User model, Profiles, Auth
│   ├── help_requests/          # Errands, 5km Matching, Chat, Tracking
│   ├── skills/                 # Peer-to-peer Tutoring & Bookings
│   ├── services/               # Verified Handyman & Local Services
│   ├── payments/               # Digital Wallet & Escrow Ledger
│   ├── ai_services/            # Urgency Classification & Fare Engine
│   ├── hoodi_backend/          # Django settings, WSGI/ASGI, URLs
│   ├── seed_demo_data.py       # Comprehensive demonstration seeder
│   └── requirements.txt        # Python dependency manifest
│
├── frontend/                   # React 19 + TypeScript + Vite Web App
│   ├── src/
│   │   ├── routes/             # TanStack Router file-based routes
│   │   │   ├── index.tsx       # Enhanced Landing Page & Ecosystem showcase
│   │   │   ├── auth.tsx        # Sign in / Register with ThemeToggle
│   │   │   └── _authenticated/ # Protected routes (/home, /help, /skills, /services)
│   │   ├── components/
│   │   │   ├── hoodi/          # Custom Hoodi design system components
│   │   │   │   ├── ThemeToggle.tsx    # Light/Dark mode switcher
│   │   │   │   ├── ProductShell.tsx   # Authenticated app header & nav
│   │   │   │   ├── RequestCard.tsx    # Errand card with urgency badges
│   │   │   │   └── LeafletMap.tsx     # 5 km radius map visualization
│   │   │   └── ui/             # shadcn/ui primitives
│   │   ├── lib/                # API helpers, formatters, server functions
│   │   └── styles.css          # Tailwind CSS v4 design tokens & theme
│   └── package.json            # Node.js dependencies
│
├── mobile/                     # Flutter Multi-Platform Subsystem
│   ├── lib/                    # Dart application source code
│   │   ├── screens/            # Feed, Skills, Wallet, Profile screens
│   │   └── services/           # Supabase & Geolocation providers
│   └── pubspec.yaml            # Flutter package manifest
│
└── docs/                       # Engineering Specifications & ADRs
    ├── system-design.md        # Comprehensive System Design Document
    └── system-design-decisions.md # Architecture Decision Records (ADRs)
```

---

## 🗺️ Roadmap & Contributing

- [x] Three Unified Pillars: Hoodi Help, Hoodi Skills, Hoodi Services
- [x] Warm Sand & Dark Obsidian dual-theme design system with instant toggle
- [x] Haversine 5 km geospatial radius filter
- [x] In-app closed-loop wallet & escrow payout engine
- [x] Seed data with 1-click test sign-in
- [ ] Push notifications via WebPush and Firebase Cloud Messaging (FCM)
- [ ] Aadhaar & Government ID OCR automatic verification pipeline
- [ ] Group errand coordination (Huddles) for bulk neighborhood grocery runs

### Contributing
Contributions are welcomed! Feel free to open an issue or submit a Pull Request.

```bash
git checkout -b feature/amazing-feature
git commit -m "feat: add amazing feature"
git push origin feature/amazing-feature
```

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

Built with ❤️ for resilient neighborhoods and communities everywhere.
