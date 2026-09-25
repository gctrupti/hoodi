# Hoodi — System Design & Architecture Specification

> **Version:** 1.1.0  
> **Status:** Architecture Blueprint (Approved with Corrections — Pre-Implementation)  
> **Target System:** Hyperlocal Community & Mutual Aid Platform (Errands, Services, P2P Skills, Wallets)  
> **Pattern:** Modular Monolith (Django 6.x + PostgreSQL 16 + PostGIS)  
> **Date:** September 2026  

---

## 1. Executive Summary & System Context

**Hoodi** is a hyperlocal mutual-aid and service marketplace platform connecting neighbors within tightly bounded geographic radiuses (typically $\le 5\text{ km}$). The platform facilitates:
1. **Hoodi Help**: Immediate neighborhood errands, delivery, and urgent physical assistance.
2. **Hoodi Skills**: Peer-to-peer lesson discovery, slot scheduling, and skill exchange.
3. **Hoodi Services**: Local home and trade services (plumbing, electrical, cleaning) with quoting, itemized pricing, and reviews.
4. **Hoodi Financials**: In-platform closed-loop wallet, simulated/integrated payment gateway capture, platform commission deduction (10%–20%), and payout settlement.

This document serves as the comprehensive **System Design Blueprint** for the Hoodi ecosystem, grounded entirely in the active codebase.

---

## 2. Current "As-Is" Architecture Audit (Existing Codebase Inspection)

### 2.1 Current Architecture & The Dual-Stack Topology
The current repository exhibits a **hybrid/dual-backend split**:
* **Backend Subsystem (`backend/`)**: Built on **Django 6.1.1 + Django REST Framework 3.18.1** running on Python 3.13, backed by **SQLite (`backend/db.sqlite3`)**. It exposes REST endpoints under `/api/` with JWT authentication and OpenAPI schema generation (`drf-spectacular`).
* **Frontend Subsystem (`frontend/`)**: Built with **TanStack Start (React 19, TypeScript, Vite)**. Rather than solely consuming the Django API, its server functions (`frontend/src/lib/hoodi/*.functions.ts`) connect via `@supabase/supabase-js` directly to a remote **Supabase (PostgreSQL 14.5)** database.
* **Mobile Subsystem (`mobile/`)**: Cross-platform **Flutter** application configured with `supabase_flutter` pointing directly to Supabase (`SupabaseConstants.supabaseUrl`).

```
[Current Dual-Stack Reality]
┌────────────────┐     Direct BaaS (PostgREST / CDC)     ┌────────────────────────┐
│ Flutter Mobile │──────────────────────────────────────▶│                        │
└────────────────┘                                       │   Supabase Cloud       │
                                                         │   (PostgreSQL 14.5)    │
┌────────────────┐     TanStack Server Functions / BaaS  │   - Auth / RLS         │
│ React Frontend │──────────────────────────────────────▶│   - RPCs / Triggers    │
└────────────────┘                                       └────────────────────────┘
        │
        │ [Parallel REST Endpoints]
        ▼
┌────────────────────────────────────────────────────────┐
│ Django 6.x REST API (Port 8000)                        │
│ - accounts, help_requests, skills, payments, services  │
│ - Storage: Local SQLite (db.sqlite3)                   │
└────────────────────────────────────────────────────────┘
```

---

### 2.2 Current Frontend/Backend Communication
1. **Frontend to Data Layer**: The React web client executes TanStack Start Server Functions (`createServerFn({ method: "POST" | "GET" })`). These functions run server-side, validate payloads with **Zod**, verify session tokens via `requireSupabaseAuth` middleware, and execute queries via PostgREST or direct SQL RPCs (`accept_help_request`, `capture_payment`).
2. **Django Endpoints**: Exposes standard JSON REST endpoints (`/api/auth/`, `/api/help/`, `/api/skills/`, `/api/payments/`, `/api/ai/`, `/api/services/`). Serializers are standard DRF `ModelSerializer`. There is currently **no active reverse-proxy or API Gateway routing** between TanStack Start and Django in local configuration.
3. **Serialization & Type Safety**:
   * Web: Strongly typed via `supabase/types.ts` (101 KB generated TypeScript schema) and Zod input validators.
   * Django: DRF serializers validate types and basic constraints, but lack strict runtime schema contract tests against the frontend TypeScript types.

---

### 2.3 Existing Authentication and Authorization
* **Django Tier**: Uses `rest_framework_simplejwt`. Users authenticate with `email` and `password` at `/api/auth/token/`. Tokens are issued as Bearer JWT (`ACCESS_TOKEN_LIFETIME = 1 day`, `REFRESH_TOKEN_LIFETIME = 7 days`). Authorization relies on DRF `IsAuthenticated`, `IsAdminUser`, or `AllowAny`.
* **Supabase / Client Tier**: Uses Supabase GoTrue Auth. JWT tokens are verified server-side in `auth-middleware.ts` by calling `supabase.auth.getUser(token)`.
* **Role Invariants**: Role flags exist on the user (`is_verified`, `is_helper`, `is_teacher`, `is_admin_user`, `is_verified_provider`). In Django views, permissions are checked via basic `if request.user not in (req.requester, req.helper)` checks.

---

### 2.4 Existing Help Architecture
* **Models**: `HelpRequest`, `ChatMessage`, `LocationTracking`.
* **Statuses**: `open` $\to$ `accepted` $\to$ `in_progress` $\to$ `completed` | `cancelled`.
* **Categories**: `delivery`, `home_assistance`, `transport`, `other`.
* **Urgencies**: `low`, `normal`, `high`, `critical`.
* **Critical Flaw in Acceptance**: In `help_requests/views.py`:
  ```python
  help_req = HelpRequest.objects.get(pk=pk)
  if help_req.status != "open":
      return Response({"error": "Request is not open"}, status=400)
  help_req.helper = request.user
  help_req.status = "accepted"
  help_req.save()
  ```
  **Race Condition**: There is no database lock (`select_for_update`), no atomic transaction wrapper, and no conditional compare-and-swap (`UPDATE WHERE status = 'open'`). Two concurrent helper requests will both read `status == 'open'`, causing double acceptance.

---

### 2.5 Existing Skills Architecture
* **Models**: `TeacherProfile`, `SkillOffering`, `AvailabilitySlot`, `SkillBooking`, `ReviewRating`.
* **Flow**:
  1. User registers as teacher (`TeacherProfile` created, `user.is_teacher = True`).
  2. Teacher creates `SkillOffering` (category, price, duration, is_online, is_in_person).
  3. Learner books via `SkillBooking` (`pending` $\to$ `confirmed` $\to$ `completed` | `cancelled`).
* **Limitations**: Slots are defined simply by `day_of_week`, `start_time`, `end_time`. There is **no calendar slot conflict collision detection**; overlapping bookings for the exact same date and time can be created concurrently.

---

### 2.6 Existing Payment / Wallet Architecture
* **Models**: `Wallet` (1:1 with `User`, `balance`), `WalletTransaction` (`amount`, `transaction_type` [credit/debit], `reference_id`).
* **Simulation Logic**:
  * Commission rates: `delivery` = 15%, `transport` = 15%, `home_assistance` = 10%, `skills` = 20%.
  * `SimulatePaymentView` in `payments/views.py`:
    ```python
    wallet, _ = Wallet.objects.get_or_create(user=recipient)
    wallet.balance += net_credit
    wallet.save()
    WalletTransaction.objects.create(...)
    ```
* **Critical Vulnerabilities**:
  1. **Lost Updates**: In-memory balance mutation without `F('balance') + net_credit` or `select_for_update()` causes balance overwrites under concurrent transactions.
  2. **Non-Atomic Operations**: Wallet credit and transaction log creation are not enclosed in a database transaction (`transaction.atomic()`).
  3. **No Idempotency Keys**: Network retries will double-credit wallets.
  4. **Unbalanced Ledger**: Requester wallets are not debited; money is created *ex nihilo*.

---

### 2.7 Existing Chat and Real-Time Architecture
* **Django**: Plain HTTP endpoints (`ChatMessageListCreateView`, `LocationTrackingView`). Clients must poll via `GET` to receive updates.
* **Frontend**: Subscribes to Supabase Realtime using WebSocket channels:
  ```typescript
  supabase.channel(`request_realtime_${id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'help_requests', filter: `id=eq.${id}` }, ...)
  ```
  Also maintains a polling fallback (`refetchInterval: 5_000`).

---

### 2.8 Existing Geospatial Matching Implementation
* **Formula**: Haversine distance implemented in Python (`help_requests/models.py`) and TypeScript (`frontend/src/lib/hoodi/location.ts`):
  $$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
* **Matching Query Execution**:
  * In Django (`help_requests/views.py:NearbyHelpRequestsView`): Loads **ALL** open requests from the database into Python memory, iterates through each record in a `for` loop, calculates distance via CPU math, filters by `dist <= radius`, and sorts in Python.
  * Complexity: **$O(N)$ full table scan** in application memory. Unusable at scale.
* **Frontend Smart Match (`smart-match.ts`)**: Calculates a multi-factor score (Distance 25%–40%, Travel Time 15%–35%, Reliability 15%–45%, Availability 10%–15%) using client-side heuristics.

---

### 2.9 Existing Database Schema & Entity Relationships

```mermaid
erDiagram
    User ||--o{ HelpRequest : "creates (requester)"
    User ||--o{ HelpRequest : "accepts (helper)"
    User ||--o| Wallet : "owns"
    User ||--o| TeacherProfile : "has"
    User ||--o| ServiceProviderProfile : "has"
    
    Wallet ||--o{ WalletTransaction : "records"
    
    HelpRequest ||--o{ ChatMessage : "contains"
    HelpRequest ||--o{ LocationTracking : "tracks"
    
    TeacherProfile ||--o{ SkillOffering : "offers"
    TeacherProfile ||--o{ AvailabilitySlot : "schedules"
    SkillOffering ||--o{ SkillBooking : "booked_via"
    User ||--o{ SkillBooking : "books (learner)"
    SkillBooking ||--o| ReviewRating : "evaluated_by"
    
    ServiceProviderProfile ||--o{ ServiceListing : "publishes"
    ServiceCategory ||--o{ ServiceSubcategory : "contains"
    ServiceCategory ||--o{ ServiceListing : "categorizes"
    ServiceProviderProfile ||--o{ ServiceRequestBooking : "receives"
    User ||--o{ ServiceRequestBooking : "requests"
    ServiceRequestBooking ||--o{ ServiceQuote : "negotiates"
    ServiceRequestBooking ||--o| ServiceReview : "rates"
    ServiceRequestBooking ||--o{ ServiceDispute : "escalates"
```

---

### 2.10 Existing Indexes & PostGIS Audit
* **Current Indexes in Database**:
  * Only Primary Keys (`id` UUID) and Foreign Keys (`user_id`, `requester_id`, `helper_id`) possess B-Tree indexes.
  * `status`, `category`, `urgency`, `created_at` **LACK** database indexes in `HelpRequest`.
  * `latitude` and `longitude` are stored as bare `FloatField` without spatial indexes (`GiST`).
* **PostGIS**: Not enabled in SQLite. In Supabase Postgres, spatial extensions (`postgis`) are available but coordinates are stored as separate numeric columns (`lat`, `lng`, `pickup_lat`, `pickup_lng`) rather than native `geometry(Point, 4326)` or `geography(Point, 4326)`.

---

### 2.11 Existing Notification Architecture
* Notifications are stored as database rows in a `notifications` table (`id`, `user_id`, `type`, `request_id`, `booking_id`, `message`, `is_read`, `created_at`).
* Generated via Postgres stored procedures (`insert_notification`, `insert_booking_notification`).
* Delivered via frontend polling (`listMyNotifications` TanStack query).
* **Missing**: Push notifications (FCM / APNs / WebPush), SMS, or real-time event socket push.

---

### 2.12 Existing AI Integration
* **Django (`ai_services/views.py`)**: `AICategorizeView` parses `title` and `description` with basic string inclusion (`"pickup" in content $\implies$ "delivery"`). Fares are adjusted based on keywords (`"urgent" $\implies \times 1.5$`).
* **Frontend (`ai-provider.server.ts`)**: Integrates Vercel AI SDK (`ai`) with multi-provider fallbacks (`@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`). It invokes structured generation (`generateText` with Zod schema) when API keys are available, falling back to heuristics if absent.

---

### 2.13 Existing Admin Architecture
* **Django Admin**: Default `admin.site.register` exists only for `services` models (`services/admin.py`). `accounts`, `help_requests`, `skills`, and `payments` are **unregistered** in Django Admin.
* **Frontend Custom Admin**: Extensive custom portal located at `frontend/src/routes/admin/` with views for Users, Helpers, Teachers, Services, Categories, Finance, Reports, and Settings.

---

## 3. High-Level Design (HLD)

### 3.1 Architectural Principles: The Modular Monolith

Hoodi is strictly architected as a **Modular Monolith**. 
* **Target Single Source of Truth**: **PostgreSQL 16 + PostGIS** is the sole authoritative transactional database.
* **Authoritative Business Tier**: **Django 6.x** is the sole authoritative business logic and API service tier.
* **Client Governance**: Neither the React Web client nor the Flutter Mobile client may perform critical business mutations (accepting help requests, releasing escrow, wallet mutations, or booking confirmations) directly against Supabase tables. All mutating business operations must be routed through the Django API/Service layer to ensure invariant enforcement, idempotency, and transactional consistency.

```
┌────────────────────────────────────────────────────────────────────────┐
│                              CLIENT TIER                               │
│   ┌───────────────────────────────┐  ┌─────────────────────────────┐   │
│   │   React 19 Web Application    │  │   Flutter Mobile Client     │   │
│   │   (TanStack Router / Query)   │  │   (Android, iOS, Desktop)   │   │
│   └───────────────┬───────────────┘  └──────────────┬──────────────┘   │
└───────────────────┼─────────────────────────────────┼──────────────────┘
                    │                                 │
                    │   HTTPS / JSON (REST + WS/SSE)  │
                    ▼                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                API GATEWAY & REVERSE PROXY (Nginx / Caddy)             │
│                SSL Termination, Rate Limiting, Request ID              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   AUTHORITATIVE BUSINESS LAYER (Django 6.x)            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                        API Controllers                           │  │
│  └────────────────────────────────┬─────────────────────────────────┘  │
│                                   │                                    │
│  ┌────────────────────────────────▼─────────────────────────────────┐  │
│  │                      DOMAIN SERVICE LAYER                        │  │
│  │  - HelpRequestService           - PaymentLedgerService           │  │
│  │  - MatchingService              - BookingService                 │  │
│  │  - ChatService                  - NotificationService            │  │
│  │  - AIService                                                     │  │
│  └────────────────────────────────┬─────────────────────────────────┘  │
└───────────────────────────────────┼────────────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        ▼                                                       ▼
┌───────────────────────────────────┐   ┌───────────────────────────────────┐
│     BACKGROUND WORKER TIER        │   │         CACHE & BROKER            │
│   - Celery / In-Process Worker    │   │         - Redis 7.x               │
│   - AI inference & classification │   │         - Geospatial query cache  │
│   - Notification push fanout      │   │         - Idempotency locks       │
│   - Task expiry & cleanup         │   │         - Rate limit counters     │
└─────────────────┬─────────────────┘   └─────────────────┬─────────────────┘
                  │                                       │
                  └───────────────────┬───────────────────┘
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│               AUTHORITATIVE TRANSACTIONAL DATA STORE                   │
│                       PostgreSQL 16 + PostGIS                          │
│        - Strict ACID Transactions & Row Locks (SELECT FOR UPDATE)      │
│        - GiST Spatial Indexing on Geography Points                     │
│        - Double-Entry Wallet Ledger & Idempotency Records              │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 3.2 Request Lifecycle Diagrams (Mermaid Sequences)

#### 1. Help Request Creation Flow
```mermaid
sequenceDiagram
    autonumber
    actor Requester as Requester (Client)
    participant Gateway as API Gateway
    participant API as HelpRequestService (Django)
    participant AI as AIService (Async)
    participant DB as PostgreSQL (PostGIS)
    participant Cache as Redis Cache

    Requester->>Gateway: POST /api/help/requests/ (Title, Desc, Lat, Lng, Fare, Idempotency-Key)
    Gateway->>API: Route validated request
    API->>DB: Check Idempotency-Key in idempotency_records
    alt Key Already Present
        API-->>Requester: Return cached response (HTTP 200)
    else First Time Request
        API->>DB: INSERT into help_requests (status='open', geom=ST_SetSRID(ST_Point(lng,lat),4326))
        API->>Cache: Invalidate local geo-tile cache: geo:feed:geohash
        API->>AI: Dispatch async task: categorize_and_suggest_fare(request_id)
        API-->>Requester: HTTP 201 Created (HelpRequest details)
    end
    AI->>AI: Run NLP heuristics or Gemini API
    AI->>DB: UPDATE help_requests SET ai_suggested_category, ai_confidence
```

#### 2. Geospatial Matching & Nearby Feed Flow
```mermaid
sequenceDiagram
    autonumber
    actor Helper as Helper (Client)
    participant API as MatchingService (Django)
    participant Cache as Redis (Spatial Cache)
    participant DB as PostgreSQL (PostGIS)

    Helper->>API: GET /api/help/nearby/?latitude=12.9716&longitude=77.5946&radius_km=5.0
    API->>Cache: GET geo:help:geohash_prefix (30s TTL)
    alt Cache Hit
        Cache-->>API: Return cached list of serialized requests
        API-->>Helper: HTTP 200 OK (Requests with calculated distance)
    else Cache Miss
        API->>DB: Query with PostGIS GiST index & ST_DWithin:
        Note over API,DB: WHERE status = 'open' AND ST_DWithin(geom, ST_MakePoint(lon, lat)::geography, 5000)
        DB-->>API: Return matched records ordered by ST_Distance
        API->>Cache: SET geo:help:geohash_prefix (TTL 30s)
        API-->>Helper: HTTP 200 OK (Sorted nearby requests)
    end
```

#### 3. Task Acceptance Flow (Atomic CAS Invariant)
```mermaid
sequenceDiagram
    autonumber
    actor Helper as Helper
    actor Requester as Requester
    participant API as HelpRequestService (Django)
    participant DB as PostgreSQL
    participant Notif as NotificationService

    Helper->>API: POST /api/help/requests/{id}/accept/ (Idempotency-Key)
    API->>DB: BEGIN TRANSACTION
    API->>DB: SELECT * FROM help_requests WHERE id = {id} FOR UPDATE
    alt Status != 'open'
        API->>DB: ROLLBACK
        API-->>Helper: HTTP 409 Conflict ("Request already accepted by another neighbor")
    else Status == 'open'
        API->>DB: UPDATE help_requests SET status = 'accepted', helper_id = {helper_id}, accepted_at = NOW() WHERE id = {id}
        API->>DB: INSERT INTO chat_threads (request_id, participants) VALUES (...)
        API->>DB: COMMIT TRANSACTION
        API->>Notif: Trigger notification: "Your request was accepted by [Helper]"
        Notif-->>Requester: Push / Web Notification
        API-->>Helper: HTTP 200 OK (Updated HelpRequest + ChatThreadID)
    end
```

#### 4. Payment Flow (Escrow Authorization & Capture)
```mermaid
sequenceDiagram
    autonumber
    actor Requester as Requester
    participant API as PaymentLedgerService (Django)
    participant PG as Payment Gateway (Razorpay)
    participant DB as PostgreSQL

    Requester->>API: POST /api/payments/orders/create/ (request_id, amount, Idempotency-Key)
    API->>PG: Create Order (amount, currency='INR', receipt=request_id)
    PG-->>API: Return order_id
    API->>DB: INSERT INTO payment_intents (order_id, request_id, amount, status='created')
    API-->>Requester: Return order_id & checkout parameters
    Requester->>PG: Complete checkout (Card/UPI/NetBanking)
    PG-->>Requester: Payment successful, returns razorpay_payment_id & signature
    Requester->>API: POST /api/payments/verify/ (order_id, payment_id, signature)
    API->>API: Verify cryptographic signature (HMAC-SHA256)
    API->>DB: BEGIN TRANSACTION
    API->>DB: UPDATE payment_intents SET status = 'authorized', payment_id = {payment_id}
    API->>DB: UPDATE help_requests SET is_paid = true, payment_id = {payment_id}
    API->>DB: COMMIT TRANSACTION
    API-->>Requester: HTTP 200 OK (Payment Verified & Escrowed)
```

#### 5. Task Settlement & Commission Distribution Flow
```mermaid
sequenceDiagram
    autonumber
    actor Helper as Helper
    actor Requester as Requester
    participant API as PaymentLedgerService (Django)
    participant DB as PostgreSQL
    participant Notif as NotificationService

    Requester->>API: POST /api/help/requests/{id}/complete/ (Idempotency-Key)
    API->>DB: BEGIN TRANSACTION
    API->>DB: SELECT * FROM help_requests WHERE id = {id} FOR UPDATE
    API->>DB: SELECT * FROM payment_intents WHERE id = {help_requests.payment_id} FOR UPDATE
    alt Already Settled or Invalid State
        API->>DB: ROLLBACK
        API-->>Requester: HTTP 400 Bad Request
    else Valid for Settlement
        API->>API: Calculate Commission (Delivery 15%: Total ₹200 -> Platform ₹30, Helper ₹170)
        API->>DB: SELECT * FROM wallets WHERE user_id = {helper_id} FOR UPDATE
        API->>DB: UPDATE wallets SET balance = balance + 170.00 WHERE user_id = {helper_id}
        API->>DB: INSERT INTO wallet_transactions (wallet_id, amount=170.00, type='credit', ref=request_id)
        API->>DB: INSERT INTO platform_revenue_ledger (source_id=request_id, gross=200, fee=30, net=170)
        API->>DB: UPDATE help_requests SET status = 'completed', completed_at = NOW()
        API->>DB: UPDATE payment_intents SET status = 'settled'
        API->>DB: COMMIT TRANSACTION
        API->>Notif: Send settlement notification to Helper & Requester
        API-->>Requester: HTTP 200 OK (Task completed and funds credited)
    end
```

#### 6. Skill Booking Flow
```mermaid
sequenceDiagram
    autonumber
    actor Learner as Learner
    actor Teacher as Teacher
    participant API as BookingService (Django)
    participant DB as PostgreSQL

    Learner->>API: POST /api/skills/bookings/ (offering_id, booking_date, start_time, Idempotency-Key)
    API->>DB: BEGIN TRANSACTION
    API->>DB: Check for duplicate/overlapping booking:
    Note over API,DB: SELECT id FROM skill_bookings WHERE teacher_id = {t_id} AND booking_date = {date} AND start_time = {time} AND status IN ('confirmed', 'pending') FOR UPDATE
    alt Slot is already occupied
        API->>DB: ROLLBACK
        API-->>Learner: HTTP 409 Conflict ("Time slot is no longer available")
    else Slot is free
        API->>DB: INSERT INTO skill_bookings (offering_id, learner_id, status='pending', total_price)
        API->>DB: COMMIT TRANSACTION
        API-->>Learner: HTTP 201 Created (Booking details)
        API->>Teacher: Notify teacher of pending booking request
    end
```

#### 7. Real-Time Chat Flow
```mermaid
sequenceDiagram
    autonumber
    actor Sender as Participant A
    actor Receiver as Participant B
    participant WS as WebSocket Gateway / Channel Layer
    participant Chat as ChatService (Django)
    participant DB as PostgreSQL

    Sender->>WS: Send JSON: {action: "send_message", thread_id: "...", content: "Hello"}
    WS->>Chat: Validate authorization (Sender belongs to thread_id)
    Chat->>DB: INSERT INTO chat_messages (thread_id, sender_id, content, created_at)
    DB-->>Chat: Message persisted (id, timestamp)
    Chat->>WS: Broadcast message to room `chat_{thread_id}`
    WS-->>Receiver: Push message payload over open WebSocket connection
    WS-->>Sender: Ack message delivery
```

#### 8. Notification Fanout Flow
```mermaid
sequenceDiagram
    autonumber
    participant Domain as Domain Service Event
    participant Notif as NotificationService (Django)
    participant DB as PostgreSQL
    participant FCM as Push Notification Service (FCM/WebPush)
    participant WS as WebSocket Gateway

    Domain->>Notif: dispatch_event(type='task_assigned', recipient_id, payload)
    Notif->>DB: INSERT INTO notifications (user_id, type, message, payload, is_read=false)
    par Real-time Web/In-App
        Notif->>WS: Send to user private channel `user_{recipient_id}`
    and Mobile Push
        Notif->>FCM: Dispatch push notification token
    end
```

---

## 4. Low-Level Design (LLD) — Domain Service Layer

All business logic is isolated within dedicated domain services located in `backend/services_domain/` (or modular app service files). Controllers (DRF views and TanStack server functions) only handle HTTP parsing, authentication tokens, and serialization.

```
                ┌─────────────────────────────────┐
                │   Controllers (DRF / TanStack)  │
                └────────────────┬────────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     ▼                           ▼                           ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│  HelpRequestService  │ │    BookingService    │ │ PaymentLedgerService │
└──────────┬───────────┘ └──────────┬───────────┘ └──────────┬───────────┘
           │                        │                        │
           ▼                        ▼                        ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│   MatchingService    │ │     ChatService      │ │ NotificationService  │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘
                                 │
                                 ▼
                    ┌───────────────────────────┐
                    │         AIService         │
                    └───────────────────────────┘
```

### 4.1 HelpRequestService
* **Responsibilities**: Controls errand request lifecycle: creation, validation, assignment, cancellation, completion, and state transitions.
* **Inputs**: `requester: User`, `title: str`, `description: str`, `category: str`, `urgency: str`, `pickup_coords: Tuple[float, float]`, `dropoff_coords: Optional[Tuple[float, float]]`, `fare_amount: Decimal`, `idempotency_key: str`.
* **Outputs**: `HelpRequestAggregate` containing persisted entity, assigned identifiers, and transition statuses.
* **Database Interaction**: Writes to `help_requests`, `idempotency_records`, and `task_status_history`.
* **Transaction Boundaries**:
  * Request creation: Atomic write across `help_requests` + `idempotency_records`.
  * Task acceptance: Enclosed in `transaction.atomic()` with `select_for_update()`.
* **Failure Cases**:
  * Invalid coordinate bounds ($\text{lat} \notin [-90, 90], \text{lng} \notin [-180, 180]$) $\implies$ `ValidationError`.
  * Concurrent acceptance race $\implies$ `TaskAlreadyAssignedException`.
  * Self-acceptance attempt (requester == helper) $\implies$ `SelfAssignmentForbiddenException`.

### 4.2 MatchingService
* **Responsibilities**: Executes spatial queries, bounding-box pre-filtering, and helper candidate scoring.
* **Inputs**: `center_coords: Tuple[float, float]`, `radius_km: float`, `category: Optional[str]`, `urgency: Optional[str]`.
* **Outputs**: List of `MatchedTaskDTO` or `MatchedHelperDTO` sorted by relevance score with distance and estimated ETA.
* **Database Interaction**: Read-only queries against `help_requests` and `accounts_user` utilizing PostGIS `ST_DWithin` and spatial index lookups.
* **Transaction Boundaries**: Read-only autocommit.
* **Failure Cases**:
  * Zero matches within radius $\implies$ Returns empty list with expanded radius suggestion (e.g., $10\text{ km}$).

### 4.3 PaymentLedgerService
* **Responsibilities**: Manages financial operations: escrow initiation, gateway signature verification, wallet debits/credits, platform commission deduction, and payout auditing.
* **Inputs**: `user_id: UUID`, `target_id: UUID`, `amount: Decimal`, `category: str`, `idempotency_key: str`, `gateway_payload: Dict`.
* **Outputs**: `LedgerTransactionResult` (balance, transaction_id, commission_deducted, timestamp).
* **Database Interaction**: Modifies `wallets`, `wallet_transactions`, `payment_intents`, and `platform_revenue_ledger`.
* **Transaction Boundaries**: Strict ACID `transaction.atomic()` at `SERIALIZABLE` or `REPEATABLE READ` isolation level. Always acquires pessimistic row-level locks via `select_for_update()` on affected wallets.
* **Failure Cases**:
  * Insufficient wallet balance for debit $\implies$ `InsufficientFundsException`.
  * Duplicate idempotency key $\implies$ Returns original transaction receipt without re-executing.
  * Payment signature mismatch $\implies$ `SecurityTamperException`, aborts immediately.

### 4.4 BookingService
* **Responsibilities**: Controls booking schedules, teacher availability validation, time-slot locking, cancellations, and review ratings.
* **Inputs**: `learner: User`, `offering_id: UUID`, `booking_date: date`, `start_time: time`, `duration_minutes: int`, `idempotency_key: str`.
* **Outputs**: `SkillBookingDTO`.
* **Database Interaction**: Queries `availability_slots`, locks overlapping `skill_bookings`, inserts confirmed booking.
* **Transaction Boundaries**: Atomic transaction with pessimistic locking on slot availability.
* **Failure Cases**:
  * Slot double booking attempt $\implies$ `SlotConflictException`.
  * Booking date in past $\implies$ `InvalidBookingDateException`.

### 4.5 NotificationService
* **Responsibilities**: Central dispatch hub for in-app notifications, mobile push (FCM), web push, and real-time WebSocket signals.
* **Inputs**: `recipient_id: UUID`, `event_type: str`, `title: str`, `body: str`, `metadata: Dict`.
* **Outputs**: `NotificationDispatchResult` (channel statuses: in_app=OK, push=OK/Failed).
* **Database Interaction**: Writes to `notifications` table.
* **Transaction Boundaries**: Notification records are written within the caller's transaction; network dispatch to push services (FCM) is deferred to post-commit hooks (`transaction.on_commit`).
* **Failure Cases**: Push provider timeout $\implies$ Silently queues retry without rolling back core transaction.

### 4.6 ChatService
* **Responsibilities**: Manages conversation threads, participant access validation, message persistence, unread counters, and message delivery status.
* **Inputs**: `thread_id: UUID`, `sender: User`, `content: str`.
* **Outputs**: `ChatMessageDTO`.
* **Database Interaction**: Writes to `chat_messages` and updates `chat_threads.last_activity_at`.
* **Transaction Boundaries**: Single atomic write per message.
* **Failure Cases**: Non-participant attempting to post $\implies$ `UnauthorizedChatAccessException`.

### 4.7 AIService
* **Responsibilities**: Automated parsing of errand descriptions, categorizing text, estimating fair compensation, and scoring urgency.
* **Inputs**: `title: str`, `description: str`.
* **Outputs**: `AICategorizationResult` (category, urgency, suggested_fare, confidence_score).
* **Database Interaction**: None directly; persists result via `HelpRequestService`.
* **Transaction Boundaries**: Non-transactional external API call.
* **Failure Cases**:
  * Provider API rate limit or outage $\implies$ Falls back gracefully to built-in keyword heuristic matcher.

---

## 5. Concurrency & Financial Safety Engine

### 5.1 Idempotency Key Architecture
To prevent duplicate requests (e.g., duplicate charges or repeated task creations from network retries), every mutating financial or assignment endpoint requires an `Idempotency-Key` header (UUIDv4).

```
Client Request -> [Idempotency Middleware]
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
[Key Exists in Cache/DB?]       [Key is New]
         │                           │
  ┌──────┴──────┐             ┌──────┴──────────────────────┐
  ▼             ▼             ▼                             ▼
[Status: DONE]  [Status: PENDING] [Acquire Lock & Save Status: PENDING]
Return Cached   Return 409    Process Business Logic & DB Transactions
Response        (In Flight)   Save Final Response & Status: DONE
                              Release Lock & Return Response
```

**Idempotency Record Schema**:
* `key`: `VARCHAR(100)` (Primary Key)
* `user_id`: `UUID`
* `request_path`: `VARCHAR(255)`
* `params_hash`: `VARCHAR(64)` (SHA-256 of request payload)
* `status`: `ENUM('pending', 'completed', 'failed')`
* `response_status`: `INT`
* `response_body`: `JSONB`
* `created_at`: `TIMESTAMP` (TTL: 24 hours)

---

### 5.2 Atomic Task Acceptance (Double-Acceptance Prevention)
In a hyperlocal errand system, multiple neighbors may tap "Accept Task" simultaneously. 

#### Elimination of Race Condition:
1. **Pessimistic Row Locking (`SELECT FOR UPDATE`)**:
   ```sql
   BEGIN;
   SELECT id, status, helper_id 
   FROM help_requests 
   WHERE id = 'req-123' 
   FOR UPDATE;

   -- Application check:
   -- if status != 'open': ROLLBACK & return 409 Conflict

   UPDATE help_requests 
   SET status = 'accepted', helper_id = 'user-456', accepted_at = NOW() 
   WHERE id = 'req-123';

   COMMIT;
   ```
2. **Conditional Atomic Compare-And-Swap (CAS)**:
   ```sql
   UPDATE help_requests
   SET status = 'accepted', helper_id = 'user-456', accepted_at = NOW()
   WHERE id = 'req-123' AND status = 'open';
   -- Check rows affected: If rows == 0, another helper accepted first!
   ```

---

### 5.3 Double Payment Prevention & Strict Wallet Ledger Consistency
To ensure financial integrity:
1. **No Bare Increment/Decrement**: Balance mutations must never use raw overwritten variables (`wallet.balance += amount`). They must use database-level atomic increments or strict double-entry ledger calculation:
   ```sql
   UPDATE wallets 
   SET balance = balance + 170.00, updated_at = NOW() 
   WHERE id = 'wallet-789';
   ```
2. **Double-Entry Ledger Principle**: Every credit must correspond to a source (e.g., Escrow Settlement, Deposit). The wallet balance must strictly equal:
   $$\text{Balance} = \sum \text{Credits} - \sum \text{Debits}$$
3. **Pessimistic Wallet Locking**:
   When processing a payout or debit:
   ```sql
   BEGIN;
   SELECT balance FROM wallets WHERE id = 'wallet-789' FOR UPDATE;
   -- Validate balance >= requested_payout
   UPDATE wallets SET balance = balance - 500.00 WHERE id = 'wallet-789';
   INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, reference_id) 
   VALUES ('wallet-789', 500.00, 'debit', 'payout_sim_123');
   COMMIT;
   ```

---

## 6. Performance & Geospatial Optimization

### 6.1 PostGIS & Spatial Query Architecture
* **The Problem**: Current Django code loads every single open task from the database and runs trigonometric operations in Python memory ($O(N)$ CPU time).
* **The PostGIS Solution**:
  Coordinates are migrated to a native PostGIS `geometry(Point, 4326)` or `geography(Point, 4326)` column with a **GiST spatial index**:
  ```sql
  ALTER TABLE help_requests ADD COLUMN geom geography(Point, 4326);
  UPDATE help_requests SET geom = ST_SetSRID(ST_MakePoint(pickup_longitude, pickup_latitude), 4326)::geography;
  CREATE INDEX idx_help_requests_geom ON help_requests USING GIST (geom);
  ```
  ```sql
  SELECT id, title, ST_Distance(geom, ST_MakePoint(:lon, :lat)::geography) AS distance_meters
  FROM help_requests
  WHERE status = 'open' 
    AND ST_DWithin(geom, ST_MakePoint(:lon, :lat)::geography, :radius_meters)
  ORDER BY distance_meters ASC
  LIMIT 50;
  ```
* **Performance Realities of PostGIS GiST**:
  GiST (Generalized Search Tree) spatial indexing provides efficient candidate pruning and bounding-box containment filtering inside PostgreSQL, avoiding catastrophic application-side full scans. However, spatial query performance is **not a guaranteed theoretical $O(\log N)$**. Real-world latency depends on:
  1. **Spatial Selectivity**: How many points fall within the query radius relative to the whole table.
  2. **Data Clustering & Distribution**: Dense urban areas vs sparse rural regions.
  3. **Planner Choices**: Validated using `EXPLAIN ANALYZE` to ensure the index is favored over sequential scans.
* **Bounding-Box Verification**:
  An auxiliary B-Tree index on `(latitude, longitude)` must **not** be added blindly. In PostGIS, GiST indices already operate on Minimum Bounding Rectangles (MBRs). Any auxiliary scalar bounding-box filtering must be benchmarked against GiST using `EXPLAIN ANALYZE` before implementation.

---

### 6.2 Redis Caching Strategy

Redis serves as an in-memory cache and lightweight task broker. Memory allocation is not fixed to an arbitrary constant; rather, Redis must be configured with an explicit maxmemory ceiling and eviction policy (`maxmemory-policy volatile-lru`), and monitored via `INFO memory`.

| Cache Key | TTL | Strategy | Invalidation Trigger |
| :--- | :--- | :--- | :--- |
| `geo:feed:{geohash_5}` | 30 seconds | Read-through with short TTL | Invalidated when new request created or accepted in geohash. |
| `user:profile:{user_id}` | 10 minutes | Cache-aside | Invalidated on profile update, badge grant, or rating change. |
| `service:categories:all` | 1 hour | Cache-aside | Invalidated on admin category CRUD. |
| `idempotency:{key}` | 24 hours | Write-once | Expired automatically via Redis TTL. |
| `rate:ip:{ip_address}` | 1 minute | Sliding window counter | Automatically managed by Redis rate limiter. |

---

### 6.3 Recommended Database Indexes

```sql
-- Help Requests: Fast status & candidate filtering
CREATE INDEX idx_help_requests_status_created ON help_requests (status, created_at DESC);
CREATE INDEX idx_help_requests_requester ON help_requests (requester_id, status);
CREATE INDEX idx_help_requests_helper ON help_requests (helper_id, status);

-- PostGIS Native Spatial Index
CREATE INDEX idx_help_requests_geom ON help_requests USING GIST (geom);

-- Service Listings & Bookings
CREATE INDEX idx_service_listings_cat_active ON services_servicelisting (category_id, is_active);
CREATE INDEX idx_service_bookings_provider_status ON services_servicerequestbooking (provider_id, status);
CREATE INDEX idx_skill_bookings_slot ON skills_skillbooking (offering_id, booking_date, start_time);

-- Wallet & Transactions
CREATE UNIQUE INDEX idx_wallets_user ON payments_wallet (user_id);
CREATE INDEX idx_wallet_tx_wallet_created ON payments_wallettransaction (wallet_id, created_at DESC);

-- Idempotency Records
CREATE INDEX idx_idempotency_created ON idempotency_records (created_at);
```

---

## 7. Asynchronous Architecture

Rather than executing slow, non-critical external calls in the synchronous HTTP request/response cycle, Hoodi utilizes a dedicated asynchronous worker pipeline.

### 7.1 Async Job Matrix

```
[HTTP Request] ---> [Enqueues Task] ---> [Message Broker (Redis)]
                                                    │
                      ┌─────────────────────────────┼─────────────────────────────┐
                      ▼                             ▼                             ▼
              [AI Worker]                   [Notification Worker]         [Scheduled Sweeper]
              - LLM categorization          - FCM Push fanout             - Expire requests (24h)
              - Dynamic fare estimation     - WebPush dispatch            - Cleanup abandoned drafts
              - Toxicity checks             - Email receipts              - Aggregate daily earnings
```

| Task Name | Trigger | Processing Time | Retry Policy | Fallback on Failure |
| :--- | :--- | :--- | :--- | :--- |
| `tasks.classify_request_ai` | Request created | $500\text{ms} - 2\text{s}$ | 2 retries, exp backoff | Fall back to local keyword heuristics. |
| `tasks.send_push_notification` | State change event | $200\text{ms} - 1\text{s}$ | 3 retries, exp backoff | Message preserved in DB; user sees it upon next refresh. |
| `tasks.expire_unclaimed_requests` | Cron (every 10 min) | $1\text{s} - 5\text{s}$ | 1 retry | Handled in next periodic sweep. |
| `tasks.daily_metrics_rollup` | Cron (Midnight) | $5\text{s} - 30\text{s}$ | 3 retries | Idempotent aggregation. |

---

## 8. Real-Time Architecture (WebSockets & SSE)

### 8.1 Transport Protocol Strategy
* **Chat & Live Location**: Low-latency bidirectional communication required $\implies$ **WebSockets** (`django-channels` on ASGI Daphne or Supabase Realtime).
* **Request & Booking Status Notifications**: Unidirectional server-to-client push $\implies$ **Server-Sent Events (SSE)** or WebSocket topic subscriptions.

### 8.2 Channel Hierarchy & Topic Routing
* `/ws/chat/{thread_id}/`: Restricted to authenticated sender and recipient. Delivers instant messages, typing indicators, and read receipts.
* `/ws/tracking/{request_id}/`: Restricted to task requester and assigned helper. Transmits throttled location coordinate pings (rate-limited to 1 ping per 3 seconds per helper).
* `/ws/user/{user_id}/`: Private push channel for real-time notification toasts and wallet updates.

---

## 9. Resilience, API Governance & Observability

### 9.1 Rate Limiting & Throttling
* **Public / Auth Endpoints** (`/api/auth/*`): 10 requests / minute per IP (prevents credential stuffing).
* **AI Analysis Endpoints** (`/api/ai/*`): 20 requests / minute per user.
* **Standard Read/Write Endpoints**: 100 requests / minute per authenticated user.
* **Location Tracking Ingestion**: 1 ping / 3 seconds per active helper.

### 9.2 Resilience Patterns
* **Graceful Degradation**: If external AI or Geoapify services are down, the platform falls back to keyword heuristics and browser client geolocation.
* **Circuit Breakers**: External payment gateway calls are wrapped in circuit breakers (tripping after 5 consecutive timeouts, 30-second cooldown).
* **Health Checks**:
  * `/health/live`: Shallow probe returning 200 OK (verifies web process running).
  * `/health/ready`: Deep probe checking PostgreSQL connection and Redis ping.

---

## 10. CURRENT vs. PROPOSED Architecture Comparison

| Architectural Dimension | Current Implementation (As-Is) | Proposed Target Design (To-Be) |
| :--- | :--- | :--- |
| **System Topology** | Split: Django/SQLite backend disconnected from TanStack/Supabase web & mobile. | Unified **Modular Monolith**: Single authoritative PostgreSQL 16 + PostGIS database with Django as authoritative business layer. |
| **Client Mutations** | Frontend and Flutter mutate Supabase tables directly via BaaS. | All critical mutations routed through Django API/Service layer. |
| **Data Layer** | SQLite (`db.sqlite3`) in Django; separate cloud Postgres in Supabase. | Single authoritative PostgreSQL 16 database with PostGIS spatial extension. |
| **Business Logic** | Direct queries inside DRF Views and TanStack server functions. | Isolated **Domain Service Layer** (`HelpRequestService`, `PaymentLedgerService`, etc.). |
| **Geospatial Matching** | In-memory Python/JS Haversine calculations over all rows ($O(N)$ full table scan). | PostGIS `ST_DWithin` with GiST spatial indexing, validated via `EXPLAIN ANALYZE`. |
| **Concurrency / Task Acceptance** | Raw read-then-write; vulnerable to concurrent double acceptance. | Atomic compare-and-swap (`UPDATE ... WHERE status = 'open'`) and row locks (`FOR UPDATE`). |
| **Financial Safety** | In-memory balance addition; no transactions; unbacked credits; no idempotency. | ACID `transaction.atomic()`, strict double-entry ledger, idempotency keys on every transaction. |
| **Real-Time Updates** | Supabase WebSocket CDC or DRF HTTP polling. | Cohesive WebSocket / SSE gateway for live chat, status broadcasts, and location tracking. |
| **Background Processing** | Synchronous execution during HTTP requests; no background worker. | Asynchronous job pipeline (Redis + worker) for AI inference, push notifications, and expirations. |
| **Indexes** | Primary keys and foreign keys only; zero spatial or composite status indexes. | Comprehensive composite indexes on `(status, created_at)`, spatial GiST, and idempotency TTLs. |

---

## 11. Pragmatic Justification: Current Scale vs. Deferred Infrastructure

| Proposed Component | Needed in Phase 1 (Current Scale)? | Needed in Phase 2 (High Scale)? | Justification & Pragmatic Rationale |
| :--- | :---: | :---: | :--- |
| **ACID Row Locks (`SELECT FOR UPDATE`)** | **YES** | **YES** | **Critical Day 1**: Without row locks, concurrent users will double-accept tasks and corrupt wallet balances. |
| **Idempotency Keys** | **YES** | **YES** | **Critical Day 1**: Network retries on mobile connections frequently cause double-submits. |
| **PostGIS Spatial Indexing (`GiST`)** | **YES** | **YES** | **Critical Day 1**: Full in-memory table scans on Haversine distance fail beyond a few hundred neighborhood requests. |
| **Domain Service Layer** | **YES** | **YES** | **Critical Day 1**: Prevents duplicate business logic between the web frontend and mobile APIs. |
| **Redis Cache & Broker** | **YES** | **YES** | Serves as both lightweight task queue broker and geospatial feed cache. Sized based on active key metrics. |
| **Database Read Replicas** | **NO** | **YES** | Current read volume does not exceed PostgreSQL single-node capacity (thousands of queries/sec). |
| **Apache Kafka** | **NO** | **YES** | Extreme overkill. Redis task queue easily handles thousands of events per second with zero cluster complexity. |
| **Kubernetes (K8s) Cluster** | **NO** | **YES** | Massive operational overhead. A single VPS or simple Docker Compose/PaaS easily handles Hoodi's current scale. |
| **Microservices Architecture** | **NO** | **NO** | Premature decomposition creates distributed transaction complexity without any organizational benefit. |
| **Multi-Region DB Sharding** | **NO** | **YES** | Hoodi is inherently hyperlocal. Each geographic neighborhood naturally operates within a single regional database. |

---

## 12. Phased Implementation Roadmap

Implementation must proceed strictly in phased milestones to preserve system stability and data safety:

```
[Phase 1] ──▶ [Phase 2] ──▶ [Phase 3] ──▶ [Phase 4] ──▶ [Phase 5] ──▶ [Phase 6]
Database      Transaction   PostGIS &     Background    Resilience    Real-Time
Consolidation Safety &      Indexes &     Workers &     & Health      WebSocket /
& Services    Idempotency   Redis Cache   Async Queue   Probes        SSE Gateway
```

### Phase 1: Database Consolidation + Service Layer + API Standardization
1. **Database Migration Protocol**:
   - Inventory SQLite tables, row counts, constraints.
   - Map SQLite schema against Supabase PostgreSQL schema.
   - Define canonical unified PostgreSQL schema with UUID keys.
   - Create zero-loss backup snapshots (`db.sqlite3.bak` and `pg_dump`).
   - Run data migration script and verify relation integrity and row counts.
2. **Domain Service Layer**:
   - Create `backend/services_domain/` with `HelpRequestService`, `PaymentLedgerService`, `BookingService`, `MatchingService`.
3. **API Standardization**:
   - Route web server functions and mobile queries to Django API endpoints.

### Phase 2: Transaction Safety, Atomic Acceptance, Idempotency & Financial Ledger
1. Implement `Idempotency-Key` header validation and persistence table (`idempotency_records`).
2. Refactor task acceptance to atomic CAS / `SELECT FOR UPDATE` transaction.
3. Refactor wallet credit/debit to strict double-entry ledger with pessimistic locks.
4. Add escrow authorization and settlement state machines.

### Phase 3: PostGIS Optimization, Indexes & Redis Caching
1. Enable `postgis` extension in PostgreSQL.
2. Migrate latitude/longitude fields to native `geography(Point, 4326)` column.
3. Create `GiST` spatial index on `geom` and benchmark query execution via `EXPLAIN ANALYZE`.
4. Add B-Tree composite indexes for `(status, created_at)`.
5. Integrate Redis caching for geohash feeds and session tokens.

### Phase 4: Background Workers / Asynchronous Processing
1. Configure task worker (Celery/Redis or lightweight worker).
2. Offload AI errand categorization and fare estimation to async tasks.
3. Implement 10-minute periodic cron sweeper for expiring open tasks older than 24 hours.

### Phase 5: Rate Limiting, Health Checks, Observability & Resilience
1. Configure IP and user-level throttling on authentication and AI routes.
2. Implement `/health/live` and `/health/ready` deep probes.
3. Standardize RFC 7807 error envelopes and centralized exception handlers.

### Phase 6: WebSocket/SSE Real-Time Architecture
1. Implement ASGI / WebSocket channel layer for chat and helper GPS streaming.
2. Throttle GPS coordinate ingestion to 1 ping per 3 seconds.
3. Implement Server-Sent Events (SSE) or WebSocket status broadcasting for real-time task status updates.
