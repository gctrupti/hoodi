# Hoodi — System Design Architectural Decision Records (ADRs)

> **Document:** Architecture Decision Records (ADRs)  
> **Status:** Approved Architecture Blueprint (Incorporating Review Corrections)  
> **Project:** Hoodi Hyperlocal Community Platform  
> **Pattern:** Modular Monolith (Django 6.x + PostgreSQL 16 + PostGIS)  
> **Date:** September 2026  

---

## Index of Architectural Decisions

* [ADR-001: Authoritative Business Tier & Database Unification](#adr-001-authoritative-business-tier--database-unification)
* [ADR-002: Spatial Indexing & Geospatial Matching Strategy](#adr-002-spatial-indexing--geospatial-matching-strategy)
* [ADR-003: Concurrency Control & Task Acceptance Invariants](#adr-003-concurrency-control--task-acceptance-invariants)
* [ADR-004: Financial Ledger Integrity, Idempotency & Wallet Safety](#adr-004-financial-ledger-integrity-idempotency--wallet-safety)
* [ADR-005: Asynchronous Processing Engine & Worker Strategy](#adr-005-asynchronous-processing-engine--worker-strategy)
* [ADR-006: Real-Time Communication Transport (Chat, Tracking & Status)](#adr-006-real-time-communication-transport-chat-tracking--status)
* [ADR-007: AI Categorization & Fare Estimation Architecture](#adr-007-ai-categorization--fare-estimation-architecture)
* [ADR-008: Database Migration Protocol (SQLite to PostgreSQL)](#adr-008-database-migration-protocol-sqlite-to-postgresql)
* [Justification Matrix: Current Scale vs. Deferred Infrastructure](#justification-matrix-current-scale-vs-deferred-infrastructure)

---

## ADR-001: Authoritative Business Tier & Database Unification

### Context
Inspection of the existing codebase revealed a split architecture:
1. `backend/`: Django 6.x + DRF backed by local SQLite (`db.sqlite3`).
2. `frontend/`: TanStack Start (React 19) server functions executing direct mutations against a remote Supabase (PostgreSQL 14.5) database via `@supabase/supabase-js`.
3. `mobile/`: Flutter client configured with `supabase_flutter` executing queries directly against Supabase.

Operating two disparate data stores creates data drift, dual maintenance of business logic, split user sessions, and broken referential integrity. Furthermore, allowing web and mobile clients to execute critical business mutations (task acceptance, wallet credits, booking state changes) directly against a BaaS bypasses business rule validation, idempotency checks, and audit logging.

### Decision
* **Authoritative Database**: Standardize on **PostgreSQL 16 + PostGIS** as the single authoritative transactional database.
* **Authoritative Business Layer**: Establish **Django 6.x** as the authoritative business logic and API service tier.
* **Client Mutation Routing**: Web (React/TanStack) and Mobile (Flutter) clients must **not** execute critical business mutations directly against Supabase. All mutating business operations (task acceptance, payment capture, wallet adjustments, booking confirmations) must route through the Django API/Service layer.
* **Architecture Style**: Maintain a strict **Modular Monolith**. Do not introduce microservices, Kubernetes, or Kafka.

### Consequences
* **Positive**:
  - Centralized invariant validation, permissions, and audit logs.
  - Native PostGIS geospatial indexing (`ST_DWithin`, `GiST`).
  - True ACID transactions across financial ledger and task states.
* **Negative**:
  - Requires reconciling the Django model definitions with the Supabase PostgreSQL table schemas.

---

## ADR-002: Spatial Indexing & Geospatial Matching Strategy

### Context
In the current Django codebase (`help_requests/views.py` and `services/views.py`), the nearby discovery query:
1. Fetches **ALL** open requests from the database table.
2. Iterates over every record in a Python `for` loop.
3. Computes the Haversine trigonometric distance in application memory.
4. Filters and sorts the list in memory.

This represents an $O(N)$ full table scan that consumes heavy CPU and memory.

### Decision
1. **PostGIS Native Spatial Indexing (`GiST`)**:
   Store locations as `geography(Point, 4326)` with a spatial **`GiST` index**. Queries execute natively in PostgreSQL:
   ```sql
   SELECT id, title, ST_Distance(geom, ST_MakePoint(:lon, :lat)::geography) AS distance_meters
   FROM help_requests
   WHERE status = 'open'
     AND ST_DWithin(geom, ST_MakePoint(:lon, :lat)::geography, :radius_meters)
   ORDER BY distance_meters ASC
   LIMIT 50;
   ```
2. **Performance Characterization**:
   GiST spatial indexing provides efficient candidate pruning and bounding-box filtering inside the database engine, avoiding catastrophic application-side full table scans. Performance is **not a guaranteed theoretical $O(\log N)$**; actual query execution time depends on spatial selectivity, data distribution, clustering, and Postgres query planner choices.
3. **Bounding-Box Index Verification**:
   An auxiliary B-Tree index on `(latitude, longitude)` will **not** be added blindly. In PostGIS, GiST indices already operate on Minimum Bounding Rectangles (MBRs). Any auxiliary scalar bounding-box filtering must be benchmarked against GiST using `EXPLAIN ANALYZE` before implementation.
4. **Caching**: Cache nearby search results by **Geohash-5 prefix** (approx $4.9\text{ km} \times 4.9\text{ km}$ tile) in Redis with a 30-second TTL.

### Consequences
* **Positive**: Eliminates in-memory full table scans and offloads spatial math to the database engine.
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

## ADR-008: Database Migration Protocol (SQLite to PostgreSQL)

### Context
The project currently has data and models divided between Django SQLite (`backend/db.sqlite3`) and Supabase PostgreSQL. Migrating to a single authoritative PostgreSQL database requires zero data loss, strict schema mapping, and verifiable relationship preservation.

### Decision
Adopt a strict, phased migration procedure:
1. **Inventory**: Catalog all tables, columns, constraints, foreign keys, and row counts in Django SQLite (`backend/db.sqlite3`).
2. **Schema Comparison**: Cross-reference Django SQLite tables against the existing Supabase PostgreSQL schema (`requests`, `profiles`, `wallets`, `services`, `skill_offerings`).
3. **Duplicate/Overlap Resolution**: Reconcile naming discrepancies (e.g., `HelpRequest` vs `requests`, `accounts_user` vs `profiles`). Define the authoritative schema.
4. **Primary Key Mapping**: Preserve existing UUIDs to prevent breaking frontend and mobile client identifiers.
5. **Backup Snapshotting**: Create non-destructive binary and SQL backups of both databases (`db.sqlite3.bak`, `pg_dump`).
6. **Data Transfer & Transform**: Execute a dedicated ETL script that transfers records, maps foreign keys, and converts coordinates into PostGIS `geography(Point, 4326)`.
7. **Verification Invariants**:
   * Compare pre-migration and post-migration row counts across all models.
   * Verify all foreign key relationships remain intact.
   * Verify nullability and check constraints.
   * Do **NOT** drop or overwrite existing tables until verification passes 100%.

### Consequences
* **Positive**: Guarantees zero data loss, schema consistency, and verifiable integrity.
* **Negative**: Requires dedicated planning and migration tooling before application refactoring.

---

## Justification Matrix: Current Scale vs. Deferred Infrastructure

| Proposed Component | Needed in Phase 1 (Current Scale)? | Needed in Phase 2 (High Scale)? | Justification & Pragmatic Rationale |
| :--- | :---: | :---: | :--- |
| **ACID Row Locks (`SELECT FOR UPDATE`)** | **YES** | **YES** | **Critical Day 1**: Without row locks, concurrent users will double-accept tasks and corrupt wallet balances. |
| **Idempotency Keys** | **YES** | **YES** | **Critical Day 1**: Network retries on mobile connections frequently cause double-submits. |
| **PostGIS Spatial Indexing (`GiST`)** | **YES** | **YES** | **Critical Day 1**: Full in-memory table scans on Haversine distance fail beyond a few hundred neighborhood requests. |
| **Domain Service Layer** | **YES** | **YES** | **Critical Day 1**: Prevents duplicate business logic between the web frontend and mobile APIs. |
| **Redis Cache & Broker** | **YES** | **YES** | Serves as lightweight task queue broker and geospatial feed cache. Configured with maxmemory and monitored dynamically via `INFO memory`. |
| **Database Read Replicas** | **NO** | **YES** | Current read volume does not exceed PostgreSQL single-node capacity (thousands of queries/sec). |
| **Apache Kafka** | **NO** | **YES** | Extreme overkill. Redis task queue easily handles thousands of events per second with zero cluster complexity. |
| **Kubernetes (K8s) Cluster** | **NO** | **YES** | Massive operational overhead. A single VPS or simple Docker Compose/PaaS easily handles Hoodi's current scale. |
| **Microservices Architecture** | **NO** | **NO** | Premature decomposition creates distributed transaction complexity without any organizational benefit. |
| **Multi-Region DB Sharding** | **NO** | **YES** | Hoodi is inherently hyperlocal. Each geographic neighborhood naturally operates within a single regional database. |
