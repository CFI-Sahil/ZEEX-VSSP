# Visual Safety Surveillance Platform (VSSP) — 20% MVP

An industrial safety surveillance web platform that integrates camera management, automated safety detection ingestion, incident triage, snapshot evidence preservation, and auditable operator resolution workflows.

---

## 1. System Architecture & Tech Stack

```
   ┌─────────────────────────────────────────────────────────┐
   │            React 18 + Vite Frontend                     │
   │  (Tailwind CSS v4 · Lucide React · Centralized Client)  │
   └─────────────────────────┬───────────────────────────────┘
                             │  HTTPS / Cookie Credentials
                             │  (HttpOnly JWT + CSRF Header)
   ┌─────────────────────────▼───────────────────────────────┐
   │            Node.js + Express API Monolith               │
   │  Helmet · Rate Limit · Auth Middleware · RBAC · Zod     │
   └───────┬─────────────────┬───────────────────┬───────────┘
           │                 │                   │
   ┌───────▼───────┐ ┌───────▼────────┐  ┌───────▼───────────┐
   │ MongoDB Atlas │ │ Local Uploads  │  │ External AI/CV    │
   │   (vssp_db)   │ │   Evidence     │  │ Ingestion Boundary│
   │  Least-Priv   │ │ (JPEG/PNG/WebP)│  │ (Provisional Dev) │
   └───────────────┘ └────────────────┘  └───────────────────┘
```

- **Frontend:** React 18, Vite 6, Tailwind CSS v4, Lucide React, Centralized Fetch Client.
- **Backend:** Node.js 22, Express.js (Modular Monolith architecture).
- **Database:** MongoDB Atlas (Database: `vssp_db`) via Mongoose ODM, authenticated with least-privilege custom role `vsspDbReadWrite`.
- **Security & Hardening:**
  - `HttpOnly`, `SameSite=Lax`, and `Secure` (production) session cookies (`vssp_jwt`).
  - Session-bound cryptographically signed Double-Submit CSRF cookies (`vssp_csrf`) and server validation (`X-CSRF-Token`).
  - Bcrypt password hashing (Cost factor 12); passwords never stored or serialized in plain text.
  - Strict Helmet HTTP headers (conditional HSTS in production).
  - Rate limiting (500 requests / 15 minutes per IP on `/api`).
  - Ingestion input validation via Zod schemas.
  - Snapshot file validation: strictly JPEG, PNG, or WebP verified by binary magic numbers, with a strict 5 MB limit. Storage is kept in a private directory outside public web roots.

---

## 2. Directory Structure

```
vssp/
├── frontend/                       # React + Vite + Tailwind CSS v4
│   ├── src/
│   │   ├── assets/                 # Brand logos and static resources
│   │   ├── components/
│   │   │   ├── alerts/             # Alert detail, close modal, demo trigger
│   │   │   ├── cameras/            # Camera modal and detail inspection
│   │   │   ├── common/             # Button, Badge, Card, Modal, Table, StatCard
│   │   │   ├── evidence/           # Evidence viewer modal
│   │   │   └── layout/             # AppShell, Sidebar, Topbar, ProtectedRoute
│   │   ├── context/                # AuthContext (session, login, logout)
│   │   ├── pages/                  # LoginPage, DashboardPage, CamerasPage, AlertsPage, EvidencePage
│   │   ├── services/               # Centralized api client, camera, alert, evidence, dashboard services
│   │   └── index.css               # Tailwind v4 theme tokens
│   ├── scripts/                    # Playwright end-to-end browser test suites
│   ├── .env.example
│   ├── package.json
│   └── vite.config.js
│
├── backend/                        # Node.js + Express.js API
│   ├── src/
│   │   ├── config/                 # DB connection, env schema, CORS whitelist
│   │   ├── controllers/            # Auth, Camera, Dashboard, Alert, Evidence, Demo controllers
│   │   ├── middleware/             # requireAuth, requireRole, csrfProtection, errorHandler
│   │   ├── models/                 # User, Camera, Alert, Evidence, AuditLog schemas
│   │   ├── routes/                 # REST routes (/auth, /cameras, /dashboard, /alerts, /evidence, /demo)
│   │   ├── scripts/                # Database seed script and automated test suites
│   │   ├── utils/                  # Response envelopes, auditLogger, fileValidator
│   │   ├── app.js                  # Express middleware pipeline
│   │   └── server.js               # Server listener & graceful shutdown
│   ├── uploads/evidence/           # Local snapshot evidence storage (gitignored)
│   ├── .env.example
│   └── package.json
│
├── docs/
│   ├── DEMO_SCRIPT.md              # Step-by-step evaluator walkthrough script
│   └── INTEGRATION_BOUNDARY.md     # AI/CV contract specification & dependency documentation
├── PRD.md                          # Product Requirements Document
└── README.md
```

---

## 3. Setup and Installation

### 1. Prerequisites
- Node.js v18+ (tested on Node v22)
- MongoDB Atlas cluster with `vssp_db` database and least-privilege user

### 2. Configure Backend Environment
Create `backend/.env` based on `backend/.env.example`:
```env
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/vssp_db?retryWrites=true&w=majority
JWT_SECRET=replace_with_64_character_random_hex_string
COOKIE_SECRET=replace_with_32_character_random_hex_string
CSRF_SECRET=replace_with_32_character_random_hex_string

# Initial Seed Credentials (never commit plain text passwords)
INITIAL_ADMIN_EMAIL=admin@vssp.local
INITIAL_ADMIN_PASSWORD=AdminSecurePass@2026!
INITIAL_OPERATOR_EMAIL=operator@vssp.local
INITIAL_OPERATOR_PASSWORD=OperatorSecurePass@2026!
```

### 3. Install Dependencies & Seed Initial Users
```bash
# Install backend dependencies
cd backend
npm install

# Seed Admin and Safety Operator accounts (idempotent, safe)
npm run seed:users

# Install frontend dependencies
cd ../frontend
npm install
```

### 4. Running the Development Servers
```bash
# Terminal 1: Start Backend (http://localhost:5000)
cd backend
npm run dev

# Terminal 2: Start Frontend (http://localhost:5173)
cd frontend
npm run dev
```

---

## 4. Role-Based Access Control (RBAC) Matrix

| Feature / Resource | Endpoint / Action | ADMIN | SAFETY_OPERATOR | Unauthenticated |
|---|---|:---:|:---:|:---:|
| **Sign In / Out** | `POST /api/v1/auth/login`, `logout` | Yes | Yes | Yes (Login only) |
| **Current Profile** | `GET /api/v1/auth/me` | Yes | Yes | No (401) |
| **System Dashboard** | `GET /api/v1/dashboard/summary` | Yes | Yes | No (401) |
| **View Cameras** | `GET /api/v1/cameras` | Yes | Yes | No (401) |
| **Add / Edit Camera** | `POST`, `PATCH /api/v1/cameras` | **Yes** | **No (403)** | No (401) |
| **View Alerts** | `GET /api/v1/alerts` | Yes | Yes | No (401) |
| **Acknowledge Alert** | `PATCH /api/v1/alerts/:id/acknowledge` | Yes | Yes | No (401) |
| **Close Alert** | `PATCH /api/v1/alerts/:id/close` | Yes | Yes | No (401) |
| **View Evidence** | `GET /api/v1/evidence`, `/:id/file` | Yes | Yes | No (401) |
| **Demo Event Ingestion** | `POST /api/v1/demo/ingest-event` | Yes (Dev) | Yes (Dev) | No (401 / 404 in prod) |

---

## 5. API Specification

### Authentication (`/api/v1/auth`)
- `POST /login`: Authenticates with email and password, setting HttpOnly `vssp_jwt` and Double-Submit `vssp_csrf` cookies.
- `POST /logout`: Clears session and CSRF cookies using matching cookie attributes.
- `GET /me`: Returns authenticated user profile (`id`, `name`, `email`, `role`).
- `GET /session`: Validates active cookie session status.

### Camera Management (`/api/v1/cameras`)
- `GET /`: Lists cameras with pagination (`page`, `limit`), regex search, and status filter (`UNKNOWN`, `ONLINE`, `OFFLINE`).
- `GET /:id`: Retrieves detailed camera metadata.
- `POST /`: Admin only. Registers a new camera. New cameras strictly default to `status: 'UNKNOWN'`, `streamStatus: 'UNAVAILABLE'`, and `lastSeenAt: null`.
- `PATCH /:id`: Admin only. Updates camera name, site, location, description, or operational status.

### Dashboard Metrics (`/api/v1/dashboard`)
- `GET /summary`: Returns single-pass aggregated metrics (`totalCameras`, `onlineCameras`, `offlineCameras`, `unknownCameras`, `totalViolations`, `pendingAlerts`, `resolvedAlerts`), recent camera points, and the 5 most recent safety alerts.

### Safety Alerts (`/api/v1/alerts`)
- `GET /`: Lists alerts with pagination, multi-field regex search, status filter (`PENDING`, `ACKNOWLEDGED`, `CLOSED`), and severity filter (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- `GET /:id`: Retrieves detailed alert record, camera metadata, evidence, and audit logs.
- `PATCH /:id/acknowledge`: Transitions alert from `PENDING` to `ACKNOWLEDGED`. Direct closure or re-acknowledgment is rejected.
- `PATCH /:id/close`: Transitions alert from `ACKNOWLEDGED` to `CLOSED`. Requires mandatory resolution remarks (`min(3)`). Direct closure from `PENDING` is strictly rejected.

### Evidence Management (`/api/v1/evidence`)
- `GET /`: Lists evidence metadata records with camera and alert filters.
- `GET /:id`: Retrieves evidence metadata.
- `GET /:id/file`: Streams snapshot image (`image/jpeg`, `image/png`, `image/webp`). Enforces authentication, magic byte signature validation, 5 MB file size limit, and path-traversal protection.

### Demo Event Ingestion (`/api/v1/demo`) — *Development Only*
- `POST /ingest-event`: Ingests simulated AI/CV detection events for development testing.
  - Strictly requires an existing, active registered camera (returns 404 if camera is not registered).
  - Enforces unique `eventId` idempotency (duplicate events return 400).
  - Validates snapshot image signature and size (< 5 MB).
  - **Security Rule:** This route is completely unregistered at the Express routing level in production (`env.NODE_ENV === 'production'`).

### Health Check (`/api/v1/health`)
- `GET /`: Returns service health and MongoDB connectivity status. Diagnostic internals are stripped in production.

---

## 6. AI/CV Integration Boundary & External Dependencies

The platform is strictly decoupled from the external computer vision model workstream:
- **Separation of Concerns:** Model inference (YOLO, pose estimation, PPE classification) and physical RTSP camera hardware are owned by the external AI/CV team.
- **Provisional vs. Confirmed Contracts:** The payload schema used in `POST /api/v1/demo/ingest-event` is strictly an internal provisional simulator used for MVP end-to-end testing and evaluation. It does not represent a confirmed requirement or finalized schema from the external AI/CV team.
- **External Dependency:** The external team has not yet delivered its final production integration specification (including production webhook routes, service-to-service authentication schemes, and final taxonomy mappings). As mandated by project guidelines, no assumptions have been made regarding their authentication methods or payload fields.
- **Production Guard:** The demo ingestion endpoint is unmounted at the route-registration level when `NODE_ENV === 'production'`.
- For complete boundary documentation, see [`docs/INTEGRATION_BOUNDARY.md`](file:///d:/Sahil/ZEEX%20WEB/VSSP/docs/INTEGRATION_BOUNDARY.md).

---

## 7. Step-by-Step Demonstration Script

For a structured, reproducible walkthrough of all platform capabilities (Login, Camera CRUD, Event Ingestion, Alert Triage, Evidence Viewing, Operator Resolution, and Dashboard Verification), refer to [docs/DEMO_SCRIPT.md](file:///d:/Sahil/ZEEX%20WEB/VSSP/docs/DEMO_SCRIPT.md).

---

## 8. Automated Test Suites

The platform includes comprehensive backend integration suites and website-based Playwright end-to-end tests driven by locally installed Google Chrome:

```bash
# 1. Run Backend Security & Verification Suites
node backend/src/scripts/testHealth.js
node backend/src/scripts/testAuth.js
node backend/src/scripts/testCameras.js
node backend/src/scripts/testAlertsAndEvidence.js
node backend/src/scripts/verifyMilestone4Requirements.js

# 2. Run Playwright Website End-to-End Browser Suites
node frontend/scripts/testWebsiteE2E.cjs           # Milestone 2: Auth & RBAC (26/26 passed)
node frontend/scripts/testMilestone3E2E.cjs         # Milestone 3: Cameras & Dynamic Metrics (32/32 passed)
node frontend/scripts/testMilestone4E2E.cjs         # Milestone 4: Alerts, Evidence & Lifecycle (31/31 passed)

# 3. Frontend Production Build Verification
cd frontend
npm run build
```

---

## 9. Render Deployment & 24/7 Keep-Alive Service

To prevent Render's free tier from spinning down after 15 minutes of inactivity, the platform provides a **dual-layer keep-alive architecture**:

### Layer 1: Automatic In-Process Self-Ping
- The backend utility ([`backend/src/utils/keepAlive.js`](file:///d:/Sahil/ZEEX%20WEB/VSSP/backend/src/utils/keepAlive.js)) automatically detects `RENDER_EXTERNAL_URL` (injected by Render) or `KEEP_ALIVE_URL`.
- Every 14 minutes, it issues a lightweight HTTP GET request to `/api/v1/health/ping`, resetting Render's 15-minute inactivity countdown.
- Configuration variables in `backend/.env`:
  ```env
  KEEP_ALIVE_URL=https://your-backend-app.onrender.com
  KEEP_ALIVE_INTERVAL_MINUTES=14
  ```

### Layer 2: External GitHub Actions Heartbeat
- A GitHub Actions cron workflow ([`.github/workflows/keep-alive.yml`](file:///d:/Sahil/ZEEX%20WEB/VSSP/.github/workflows/keep-alive.yml)) runs every 14 minutes from GitHub's servers to ping the `/api/v1/health/ping` endpoint.
- If the Render instance ever sleeps or restarts, the external GitHub Action wakes it up automatically.
- Optional: Add `RENDER_BACKEND_URL` in your GitHub repository secrets (`Settings > Secrets and variables > Actions`).

