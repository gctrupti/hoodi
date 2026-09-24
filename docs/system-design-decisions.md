# Hoodi — System Design Architectural Decision Records (ADRs)

> **Document:** Architecture Decision Records (ADRs)  
> **Status:** Approved Architecture Blueprint  
> **Project:** Hoodi Hyperlocal Community Platform  
> **Date:** September 2026  

---

## Index of Architectural Decisions

* [ADR-001: Backend Topology & Database Unification](#adr-001-backend-topology--database-unification)
* [ADR-002: Geospatial Matching & Spatial Query Optimization](#adr-002-geospatial-matching--spatial-query-optimization)
* [ADR-003: Concurrency Control & Task Acceptance Invariants](#adr-003-concurrency-control--task-acceptance-invariants)
* [ADR-004: Financial Ledger Integrity, Idempotency & Wallet Safety](#adr-004-financial-ledger-integrity-idempotency--wallet-safety)
* [ADR-005: Asynchronous Processing Engine & Worker Strategy](#adr-005-asynchronous-processing-engine--worker-strategy)
* [ADR-006: Real-Time Communication Transport (Chat, Tracking & Status)](#adr-006-real-time-communication-transport-chat-tracking--status)
* [ADR-007: AI Categorization & Fare Estimation Architecture](#adr-007-ai-categorization--fare-estimation-architecture)
* [Justification Matrix: Current Scale vs. Deferred Infrastructure](#justification-matrix-current-scale-vs-deferred-infrastructure)

---

## ADR-001: Backend Topology & Database Unification

### Context
Inspection of the existing codebase revealed a split architecture:
1. `backend/`: Django 6.x + DRF backed by local SQLite (`db.sqlite3`).
2. `frontend/`: TanStack Start (React 19) server functions executing direct queries to a remote Supabase (PostgreSQL 14.5) database via `@supabase/supabase-js`.
3. `mobile/`: Flutter client configured with `supabase_flutter` talking directly to Supabase.

Operating two disparate data stores creates data drift, dual maintenance of business logic, split user sessions, and broken referential integrity.

### Decision
* **Target Single Source of Truth**: Standardize the primary database on **PostgreSQL 16 + PostGIS**.
* **Architecture Style**: Adopt a **Modular Monolith** pattern.
* **Database Connection**: 
  - Point Django's `DATABASES['default']` to the PostgreSQL instance.
  - Expose core business logic through a clean **Domain Service Layer** in Django or shared server modules, ensuring that whether a request originates from the web frontend or mobile app, business invariants (financial checks, task acceptance, and state transitions) execute identical code paths.

### Consequences
* **Positive**:
  - Unified user table, permissions, and audit logs.
  - Native PostGIS geospatial indexing (`ST_DWithin`, `GiST`).
  - True ACID transactions across financial ledger and task states.
* **Negative**:
  - Requires reconciling the Django model definitions with the Supabase PostgreSQL table schemas.

---

## ADR-002: Geospatial Matching & Spatial Query Optimization

### Context
In the current Django codebase (`help_requests/views.py` and `services/views.py`), the nearby discovery query:
1. Fetches **ALL** open requests from the database table.
2. Iterates over every record in a Python `for` loop.
3. Computes the Haversine trigonometric distance in application memory.
4. Filters and sorts the list in memory.

This represents an $O(N)$ full table scan that consumes heavy CPU and memory. At 10,000 tasks, this query will exhaust server memory and induce multi-second response latency.

### Decision
Implement a **two-tier geospatial query pipeline**:
1. **Tier 1 (Immediate B-Tree Bounding Box Pre-Filter)**:
   Calculate coordinate delta $\Delta\text{lat} \approx \frac{r}{111.32}$, $\Delta\text{lon} \approx \frac{r}{111.32 \times \cos(\text{lat})}$. Use indexed B-Tree range scans on `pickup_latitude` and `pickup_longitude` to eliminate 98%+ of candidates before math calculations.
2. **Tier 2 (PostGIS Native Spatial Indexing)**:
   Store locations as `geometry(Point, 4326)` or `geography(Point, 4326)` with a spatial **`GiST` index**. Queries execute natively in database engine:
   ```sql
   SELECT id, title, ST_Distance(geom, ST_MakePoint(:lon, :lat)::geography) AS distance_meters
   FROM help_requests
   WHERE status = 'open'
     AND ST_DWithin(geom, ST_MakePoint(:lon, :lat)::geography, :radius_meters)
   ORDER BY distance_meters ASC
   LIMIT 50;
   ```
3. **Caching**: Cache nearby search results by **Geohash-5 prefix** (approx $4.9\text{ km} \times 4.9\text{ km}$ tile) in Redis for 30 seconds.

### Consequences
* **Positive**: Query latency drops from $O(N)$ with hundreds of milliseconds to $O(\log N)$ in $<15\text{ms}$.
* **Negative**: Requires PostGIS extension enabled on PostgreSQL.

---

## ADR-003: Concurrency Control & Task Acceptance Invariants

### Context
When an errand is posted, multiple nearby helpers may tap "Accept" at the exact same moment. The existing implementation:
```python
help_req = HelpRequest.objects.get(pk=pk)
if help_req.status != "open":
    return Response({"error": "Not open"})
help_req.helper = request.user
help_req.status = "accepted"
help_req.save()
```
This is vulnerable to a classic **Time-of-Check to Time-of-Use (TOCTOU)** race condition. If Helper A and Helper B submit simultaneously, both read `status == 'open'`, both succeed, and the last database write silently overwrites the first.

### Decision
Enforce atomic concurrency control via **Pessimistic Locking** and **Conditional Atomic Compare-and-Swap (CAS)**:
```python
with transaction.atomic():
    help_req = (
        HelpRequest.objects
        .select_for_update()
        .filter(pk=pk, status="open")
        .first()
    )
    if not help_req:
        raise TaskAlreadyAcceptedException("This task has already been accepted.")
    
    help_req.helper = request.user
    help_req.status = "accepted"
    help_req.accepted_at = timezone.now()
    help_req.save()
```
Additionally, enforce state transitions strictly via a finite state machine:
$$\text{open} \longrightarrow \text{accepted} \longrightarrow \text{in\_progress} \longrightarrow \text{completed} \mid \text{cancelled}$$

### Consequences
* **Positive**: 100% guarantee that zero tasks are double-accepted.
* **Negative**: Slight lock acquisition overhead (measured in microseconds).

---

## ADR-004: Financial Ledger Integrity, Idempotency & Wallet Safety

### Context
Current wallet transactions in `payments/views.py`:
1. Use raw addition: `wallet.balance += net_credit; wallet.save()`, which causes lost updates under concurrent transactions.
2. Are not wrapped in `transaction.atomic()`; if the server crashes between updating the balance and creating the `WalletTransaction` row, the ledger is permanently corrupted.
3. Lack idempotency keys; duplicate client clicks or retried network packets result in multiple credits.
4. Credit money without debiting the requester, creating unbacked funds.

### Decision
1. **Pessimistic Locking on Balance Mutation**:
   All balance modifications must execute inside an ACID transaction using `select_for_update()` on the wallet row.
2. **Double-Entry Ledger Pattern**:
   A wallet balance must always be auditable as the sum of its credit and debit ledger entries.
3. **Mandatory Idempotency Keys**:
   All financial mutating endpoints must require an `Idempotency-Key: <UUID>` header. Keys are recorded in an `idempotency_records` table with a 24-hour TTL. If a key is repeated with identical payload hash, the previous response is returned without executing business logic.
4. **Escrow Holding Model**:
   When a task is accepted, funds are pre-authorized and held in escrow. Payout to the helper's wallet occurs strictly upon requester task completion or automated dispute expiry.

### Consequences
* **Positive**: Absolute mathematical and transactional integrity. Eliminates double payments and lost balances.
* **Negative**: Client must generate and persist idempotency UUIDs.

---

## ADR-005: Asynchronous Processing Engine & Worker Strategy

### Context
Certain operations—such as sending push notifications to mobile devices, calling external LLMs for errand classification, expiring stale requests, and generating daily analytics rollups—do not belong in the synchronous request/response cycle. Running them synchronously slows response times and exposes the API to external third-party outages.

### Decision
* **Worker Framework**: Deploy a lightweight task queue (**Celery** backed by Redis, or an in-process worker during initial low-traffic deployment).
* **Workloads Delegated to Worker**:
  1. `classify_request_ai`: Runs LLM inference for category/fare suggestions asynchronously upon task creation.
  2. `dispatch_notifications`: Dispatches mobile push (FCM) and web push notifications without blocking database commits.
  3. `periodic_request_cleanup`: Sweeper running every 10 minutes to auto-expire open requests older than 24 hours.

### Consequences
* **Positive**: HTTP API response times remain under $50\text{ms}$. External provider latency never impacts user experience.
* **Negative**: Introduces a background worker process and Redis dependency.

---

## ADR-006: Real-Time Communication Transport (Chat, Tracking & Status)

### Context
Hyperlocal errands require fast, responsive updates:
- Real-time chat between requester and helper.
- Helper GPS location tracking while en route.
- Instant task status broadcasting (e.g., when a request is accepted).

### Decision
* **Transport Strategy**:
  - **Bidirectional (Chat & GPS Streaming)**: **WebSockets** (via `django-channels` on ASGI Daphne or Supabase Realtime).
  - **Unidirectional (Status Broadcasts & Notifications)**: WebSockets or Server-Sent Events (SSE).
* **Location Ping Rate Throttling**:
  Helper GPS coordinates sent over WebSocket are throttled to a maximum frequency of **1 update per 3 seconds**. Coordinates are written to an ephemeral Redis geospatial key (`GEOADD`) for live map rendering, and flushed to PostgreSQL history only once per minute to avoid database bloat.

### Consequences
* **Positive**: Sub-second chat and smooth map tracking without polling overhead.
* **Negative**: Requires ASGI server handling persistent WebSocket connections.

---

## ADR-007: AI Categorization & Fare Estimation Architecture

### Context
Users posting errands often provide brief or unstructured text (e.g., *"Need paracetamol from pharmacy asap"*). The system must categorize the task, assign urgency, and suggest fair pricing.

### Decision
* **Two-Layer AI Architecture**:
  1. **Layer 1 (Fast Deterministic Heuristics)**: Runs synchronously on the client or edge in $<5\text{ms}$ using regex and keyword dictionaries. Provides immediate UI feedback for category chips and base fare suggestions.
  2. **Layer 2 (Asynchronous LLM Refinement)**: If configured with valid API keys (Google Gemini 1.5 Flash / OpenAI), a background task runs structured classification with confidence scoring. If the LLM confidence exceeds $0.85$, it updates the request metadata in the background.

### Consequences
* **Positive**: Zero latency penalty on task creation; works 100% offline or during API quota exhaustion while providing rich AI enhancements when connected.

---

## Justification Matrix: Current Scale vs. Deferred Infrastructure

| Proposed Component | Needed in Phase 1 (Current Scale)? | Needed in Phase 2 (High Scale)? | Justification & Pragmatic Rationale |
| :--- | :---: | :---: | :--- |
| **ACID Row Locks (`SELECT FOR UPDATE`)** | **YES** | **YES** | **Critical Day 1**: Without row locks, even 5 concurrent users will trigger double-acceptance and corrupted balances. |
| **Idempotency Keys** | **YES** | **YES** | **Critical Day 1**: Network retries on mobile connections frequently cause double-submits. |
| **PostGIS Spatial Indexing (`GiST`)** | **YES** | **YES** | **Critical Day 1**: Full in-memory table scans on Haversine distance do not scale past a single neighborhood. |
| **Domain Service Layer** | **YES** | **YES** | **Critical Day 1**: Prevents duplicated business logic across DRF views and frontend server functions. |
| **Redis Cache & Broker** | **YES** | **YES** | Serves as both lightweight task queue broker and geospatial feed cache. Modest footprint (~25MB RAM). |
| **Database Read Replicas** | **NO** | **YES** | Current read volume does not exceed PostgreSQL single-node capacity (thousands of queries/sec). |
| **Apache Kafka** | **NO** | **YES** | Extreme overkill. Redis task queue easily handles thousands of events per second with zero cluster complexity. |
| **Kubernetes (K8s) Cluster** | **NO** | **YES** | Massive operational overhead. A single VPS or simple Docker Compose/PaaS easily handles Hoodi's current scale. |
| **Microservices Architecture** | **NO** | **NO** | Premature decomposition creates distributed transaction complexity without any organizational benefit. |
| **Multi-Region DB Sharding** | **NO** | **YES** | Hoodi is inherently hyperlocal. Each geographic neighborhood naturally operates within a single regional database. |
