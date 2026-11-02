# Product Requirements Document (PRD)

# Visual Safety Surveillance Platform --- 20% MVP

**Document status:** MVP planning baseline\
**Version:** 1.0\
**Prepared for:** Antigravity development workflow\
**Product type:** Industrial safety surveillance web application\
**Scope:** Frontend and backend application development; AI/Computer
Vision model development is out of scope\
**Date:** 31 October 2026

------------------------------------------------------------------------

## 1. Purpose of this document

This PRD explains what we are building for the first 20% MVP of the
Visual Safety Surveillance Platform. It is intended to be the primary
product and implementation brief for the developer/AI coding agent
working in Antigravity.

The goal is to build a small, coherent, professional and functional
first release---not to reproduce the entire enterprise platform
described in the full developer handoff.

The MVP must demonstrate the central operational workflow:

1.  A camera is registered and represented in the web application.
2.  A detection event is received from an external AI/Computer Vision
    (AI/CV) component, or created through clearly labelled
    development/demo data.
3.  The backend validates and records the event.
4.  The event becomes a safety alert.
5.  The alert is visible to an authorised user in the web dashboard.
6.  The user can inspect the alert and its evidence, acknowledge it, and
    close it with remarks.
7.  Dashboard metrics update from stored application data.

**Important scope distinction:** The 20% figure is a prioritisation
target, not a claim that exactly 20% of the original specification's
engineering effort is represented. The selected features form a small
end-to-end slice of the product. The supervisor/client must confirm the
final acceptance scope.

## 2. Product context

The full product is an AI-enabled visual safety surveillance platform
for industrial sites. It uses existing or newly installed CCTV streams
and AI perception services to identify safety-related events, create
auditable alerts, preserve evidence, and provide operational visibility
through a web console and other future interfaces.

The full handoff describes a much larger platform, including 54
detection definitions (D01--D54), 86 procedure/use-case mappings, eight
dashboard groups, mobile workflows, escalation channels, model
governance, camera relocation, acceptance/SLA tooling, and on-premises
operations.

Those capabilities are **not all part of this MVP**.

### 2.1 MVP product objective

Deliver a web application that lets a safety administrator/operator:

-   Sign in securely.
-   See an overview of camera and alert activity.
-   View registered cameras and their status.
-   Review safety alerts generated from incoming detection events.
-   Inspect alert details and associated evidence.
-   Acknowledge and close alerts with an auditable action history.
-   View basic, data-backed summaries.

### 2.2 Intended users

For the MVP, use two simple application roles:

  ------------------------------------------------------------------------------------
  Role                    Purpose                 MVP permissions
  ----------------------- ----------------------- ------------------------------------
  Admin                   Manages application     View dashboard, manage users if
                          access and operational  enabled, manage cameras, view/manage
                          records                 alerts, view evidence

  Safety Operator         Monitors and responds   View
                          to alerts               dashboard/cameras/alerts/evidence;
                                                  acknowledge and close permitted
                                                  alerts
  ------------------------------------------------------------------------------------

Keep the permission model simple, but enforce permissions on the
backend. Do not rely only on hiding frontend controls.

If the supervisor supplies a different role matrix, update this section
before implementation.

## 3. Scope

### 3.1 In-scope MVP modules

1.  Authentication and protected application access.
2.  Main dashboard.
3.  Camera management and camera status.
4.  Alert management and lifecycle actions.
5.  Evidence association and viewing.
6.  Basic reports/summary filters only if they fit the agreed MVP
    schedule; otherwise defer them.

### 3.2 Explicitly out of scope

Do not build these for the first MVP unless the supervisor changes the
scope:

-   Developing, training, fine-tuning or hosting AI/CV detection models.
-   Implementing all 54 detection definitions or all 86 use-case
    mappings.
-   Full industrial RTSP/ONVIF ingestion infrastructure.
-   Multi-camera GPU inference, DeepStream, Triton, NATS or Kafka.
-   ByteTrack, RTMPose, pose estimation, advanced spatial reasoning or
    model governance.
-   Fire/smoke, man-down, hoist, gas-cylinder, confined-space and other
    advanced detection logic.
-   Contractor safety rankings and contractor attribution disputes.
-   Work-front registry and camera relocation/calibration workflows.
-   Eight contractual dashboard groups and their detailed activity
    views.
-   Full MIS/report builder, scheduled email delivery or Excel/PDF
    export automation.
-   SMS, email, hooter/PA, push notifications and escalation
    orchestration.
-   Native mobile application and offline mobile queue.
-   Training sandbox, acceptance/SLA console and full evidence
    vault/legal-hold tooling.
-   High availability, N+1 inference, disaster recovery and full
    on-premises production deployment.
-   Face recognition, identity matching or employee identity templates.
    These are not permitted by the source handoff's privacy constraints.

### 3.3 MVP assumptions

-   The AI/CV workstream is owned by another person/team.
-   Our application receives detection results through an agreed backend
    integration contract. Until that contract is provided, use seeded
    demo records or a protected development-only event-ingestion
    endpoint.
-   A real CCTV feed may not be available during early development. The
    camera UI must support a clear "No stream available" or "Demo feed"
    state. Do not represent a static image or prerecorded video as a
    live CCTV feed.
-   MongoDB Atlas is the approved MVP database.
-   Frontend and backend will be maintained in separate folders in one
    project repository.
-   The approved dashboard mockup is the visual reference.

## 4. Success criteria and acceptance outcomes

The MVP is successful when a reviewer can complete this end-to-end
demonstration:

1.  Sign in with an authorised account.
2.  Open the dashboard and see counts calculated from actual stored
    records.
3.  Open Cameras and inspect registered camera details and current
    status.
4.  Submit or receive a valid sample detection event.
5.  See the backend create a corresponding alert and associate evidence
    metadata.
6.  See the new alert appear in the Alerts page.
7.  Open alert details and inspect its detection information and
    evidence.
8.  Acknowledge the alert.
9.  Close the alert with a required closure remark.
10. See the updated status and history reflected in the UI and
    dashboard.

All demo data must be clearly identifiable as demo/test data. The app
must not claim that a real AI model or real CCTV connection is operating
when it is not.

## 5. Approved design direction

### 5.1 Visual reference

Use the dashboard image approved by the product owner in this
conversation as the primary visual direction. It shows a professional
industrial safety dashboard with:

-   A dark navy vertical sidebar.
-   A light, near-white main workspace.
-   Blue primary actions and active navigation.
-   White cards with subtle borders/shadows and rounded corners.
-   Clear typography and dense but readable operational information.
-   Status colours for live/offline cameras, alert severity and alert
    lifecycle.
-   A desktop-first dashboard with responsive behaviour for smaller
    screens.

The approved reference is a visual guide, not a requirement to copy
every sample value or every panel literally. Use realistic
placeholder/demo data only where clearly marked.

### 5.2 Theme and design tokens

Use a consistent design system. Suggested initial tokens (adjust only
when needed for contrast and accessibility):

  Token                Suggested value   Usage
  -------------------- ----------------- -------------------------------------------
  App background       `#F5F8FC`         Main workspace
  Surface              `#FFFFFF`         Cards, tables, panels
  Sidebar              `#10243D`         Main navigation
  Sidebar secondary    `#183653`         Hover/secondary sidebar surfaces
  Primary blue         `#2563EB`         Primary actions, active navigation, links
  Primary blue hover   `#1D4ED8`         Hover state
  Main text            `#111827`         Headings and primary content
  Secondary text       `#64748B`         Descriptions and metadata
  Border               `#E2E8F0`         Dividers and card outlines
  Success              `#16A34A`         Resolved/healthy
  Warning              `#D97706`         Pending/medium attention
  Danger               `#DC2626`         High severity/offline/error
  Info                 `#0EA5E9`         Informational states

Use semantic colour consistently. Do not communicate status by colour
alone; include text labels and/or icons.

### 5.3 Typography and components

-   Use a clean, legible sans-serif font stack.
-   Use a consistent type scale for page titles, section headings,
    labels, body text and metadata.
-   Use consistent spacing, radii, button sizes and input heights.
-   Prefer reusable components over one-off page styling.
-   Use icons consistently (for example, Lucide React).
-   Avoid excessive gradients, glassmorphism, decorative animations or
    unnecessary visual effects.
-   Use accessible focus states and keyboard navigation.
-   Provide loading, empty, error, offline and degraded states.

### 5.4 Application shell

The authenticated application should have:

**Left sidebar** - Product mark/name: "Visual Safety Surveillance"
(working product name; branding can be changed later). - Dashboard -
Cameras - Alerts - Evidence - Reports (only if basic reporting is
implemented) - Users (Admin-only, if user management is included) -
Settings (only if required for MVP; do not create empty non-functional
screens) - System status indicator near the bottom.

**Top bar** - Search field may be included as a visual placeholder only
if it is not connected; preferably defer global search until it works. -
Notification icon only if notifications are implemented; otherwise omit
it. - Current user/profile menu with role and logout. - Optional date
range filter on dashboard.

**Main content** - Page title and short explanatory subtitle. - Relevant
page actions. - Cards, tables, filters and detail panels.

### 5.5 Dashboard page layout

The approved homepage concept contains:

1.  Page title: "Dashboard".
2.  Short description: "Overview of safety monitoring across all cameras
    and sites".
3.  KPI cards:
    -   Total Cameras
    -   Total Violations
    -   Pending Alerts
    -   Resolved Alerts
4.  Live Camera Feeds panel:
    -   Camera tiles with camera ID/name.
    -   Status badge (Live, Offline, or Demo).
    -   Timestamp/last-seen information.
    -   Video/feed area or honest unavailable/demo state.
5.  Violation Overview chart.
6.  Violation Types breakdown.
7.  Recent Alerts table.
8.  Recent Activity panel, if activity events are recorded.

Only display metrics that can be calculated from backend data. Do not
hardcode the illustrative numbers shown in the design mockup.

## 6. Functional requirements

Priority labels: - **P0:** Required for the MVP end-to-end
demonstration. - **P1:** Valuable if time permits within the MVP. -
**Future:** Not part of this MVP.

### 6.1 Authentication and access control

**P0 requirements** - Login using email/username and password. -
Logout. - Store passwords as secure hashes; never store plaintext
passwords. - Protect frontend routes from unauthenticated access. -
Protect backend endpoints with authentication middleware. - Enforce role
permissions on the backend. - Provide clear invalid-credential and
expired-session messages. - Do not expose secrets, access tokens or
database credentials in frontend bundles or source control.

**P1 requirements** - Admin can create or provision users. - Admin can
activate/deactivate a user. - Basic user list and role display.

**Security notes** - Prefer short-lived access tokens and a secure
session strategy appropriate to the deployment. If JWT is used in
cookies, use `HttpOnly`, `Secure` in production and an appropriate
`SameSite` setting, with CSRF protection where required. - If bearer
tokens are used, do not casually store long-lived tokens in
`localStorage`; document the chosen trade-off and protect against XSS. -
Rate-limit login attempts. - Validate and normalise all authentication
inputs. - Use a strong password hashing algorithm such as bcrypt or
Argon2. - Never create a public registration flow unless the supervisor
explicitly requires it. For an industrial admin application, initial
accounts should normally be provisioned by an administrator or seed
script.

### 6.2 Main dashboard

**P0 requirements** - Show total registered cameras. - Show total
alerts/violations. - Show pending/open alerts. - Show resolved/closed
alerts. - Show recent alerts. - Show camera status summary. - Fetch all
values from backend endpoints and MongoDB records.

**P1 requirements** - Basic alert trend chart by day. - Violation-type
breakdown. - Date-range filtering. - Recent activity list derived from
alert lifecycle events.

**Rules** - Define exactly what each KPI counts. - Use a consistent
date/time zone strategy. - Show a useful empty state when there is no
data. - Do not display fake "live" updates. - A dashboard refresh or
refetch should reflect newly created or updated alerts.

### 6.3 Camera management

**P0 requirements** - List registered cameras. - Show camera ID, name,
site/location, status and last-seen timestamp. - Open a camera detail
view. - Show whether the camera is online, offline, unknown or demo. -
Support adding/editing camera metadata if approved for MVP; otherwise
seed cameras and provide read-only details. - Allow authorised users to
see camera-associated alerts.

**P1 requirements** - Create, edit and deactivate camera records. -
Filter cameras by status. - Show a video area for a real stream
integration when the camera provider/API is available.

**Important** - Do not connect the browser directly to private CCTV
devices. - Do not expose RTSP URLs or camera credentials to the
frontend. - The backend/integration service must broker any approved
stream access. - If no real stream integration exists, display a clear
"Stream unavailable", "Demo feed" or "Not connected" state.

### 6.4 Alert management

This is the core operational module and must be functional.

**P0 requirements** - List alerts newest first. - Show alert ID, camera,
detection/violation type, location/zone if available, severity,
occurrence time and status. - Filter by status, severity, camera and
date range where practical. - Open alert detail. - Display confidence
when provided by the AI/CV source. - Display detection description and
source event metadata. - Display associated snapshot/evidence when
available. - Allow an authorised user to acknowledge an alert. - Allow
an authorised user to close an alert with a required remark. - Record
who performed the action and when. - Prevent invalid state transitions
and duplicate actions where possible.

**MVP alert states** - `PENDING` --- alert has been raised and awaits
review. - `ACKNOWLEDGED` --- an operator has acknowledged it. - `CLOSED`
--- an operator has closed it with remarks.

The full source handoff includes a more detailed state model: Candidate
→ Raised → Acknowledged → Assigned → Action Taken → Closed, plus False
Positive and Auto Resolved side states. The MVP deliberately uses a
smaller state model. Do not imply that the full lifecycle is
implemented.

**P1 requirements** - Assign alert to an operator. - Record a simple
activity timeline. - Add a "False Positive" disposition only if the
supervisor approves the workflow and reason capture.

**Closure rules** - Closure remark is mandatory. - Record `closedBy` and
`closedAt`. - If confirming evidence is not available in the MVP, do not
pretend it was captured. Make the limitation visible and record the
reason/remark. - The backend is authoritative for transitions.

### 6.5 Evidence management

**P0 requirements** - Store evidence metadata associated with an
alert. - Support an image/snapshot reference. - Display the evidence in
alert details and an Evidence page/list. - Show capture time, camera and
associated alert. - Restrict evidence access to authenticated,
authorised users. - Validate file type and size for uploads if uploads
are enabled.

**P1 requirements** - Support video clip references if the AI/CV team
supplies them. - Add evidence search/filter by alert, camera and date.

**Storage approach** - For local development, use a controlled local
uploads directory that is excluded from Git. - Keep file metadata and
storage references in MongoDB; do not store large image/video binary
data directly inside ordinary alert documents. - For deployment, use an
approved object-storage service or server-side storage. Keep the storage
provider abstracted so it can be changed later. - Use generated
filenames, validate actual file content/type, impose file-size limits
and prevent path traversal. - Never expose a raw server filesystem path
to the browser. - Use authorised backend routes or short-lived signed
URLs to retrieve evidence.

### 6.6 Basic reports (P1 / conditional)

Only implement if the P0 workflow is complete and the supervisor expects
it in the MVP: - Summary of alert counts by status. - Summary of alert
counts by violation type. - Date-range filtering. - Basic on-screen
report view.

Defer scheduled email reports, PDF/Excel export and custom report
templates.

### 6.7 AI/CV integration boundary

AI/CV model development is explicitly outside our responsibility.
However, the backend must be prepared to receive detection events.

**P0 integration-ready requirements** - Define a documented
event-ingestion API contract. - Validate incoming event payloads. -
Authenticate the integration source (for example, service-to-service API
key or another agreed mechanism). - Validate camera references and
required fields. - Prevent duplicate processing using a unique
`eventId`. - Create an alert record from a valid event. - Store evidence
references/metadata supplied by the AI/CV service. - Record source
timestamps and server receipt timestamps. - Return a clear success/error
response.

**Proposed initial event payload (to be confirmed with AI/CV team)**

``` json
{
  "eventId": "evt_demo_0001",
  "cameraId": "CAM-001",
  "detectionType": "PPE_VIOLATION",
  "violationType": "MISSING_HELMET",
  "severity": "HIGH",
  "confidence": 0.94,
  "occurredAt": "2026-10-31T10:35:00.000Z",
  "evidence": {
    "snapshotUrl": null,
    "clipUrl": null
  },
  "metadata": {
    "modelName": "external-ai-service",
    "modelVersion": "demo"
  }
}
```

This is a proposed MVP contract, not a contract already supplied by the
AI/CV team. Confirm field names, authentication, evidence transfer
method, severity mapping and retry behaviour with that team before
production integration.

**Development/demo behaviour** - Seed clearly labelled sample alerts, or
provide a development-only event simulator. - Never leave an
unauthenticated public endpoint that can create arbitrary alerts. -
Disable demo/simulator endpoints in production.

## 7. Data model --- MongoDB Atlas

Use MongoDB Atlas with Mongoose. Keep collections focused and avoid both
excessive embedding and unnecessary fragmentation.

### 7.1 Proposed collections

#### `users`

Suggested fields: - `_id` - `name` - `email` (unique, normalised) -
`passwordHash` - `role` (`ADMIN` or `SAFETY_OPERATOR`) - `isActive` -
`createdAt` - `updatedAt` - `lastLoginAt`

Never return `passwordHash` in API responses.

#### `cameras`

Suggested fields: - `_id` - `cameraCode` (unique, e.g. `CAM-001`) -
`name` - `site` - `location` or `zone` - `description` - `status`
(`ONLINE`, `OFFLINE`, `UNKNOWN`, `DEMO`) - `lastSeenAt` - `streamStatus`
/ stream reference where appropriate - `isActive` - `createdAt` -
`updatedAt`

Do not store camera passwords or private RTSP credentials in documents
returned to the frontend. If credentials become necessary, use a secure
secrets mechanism.

#### `alerts`

Suggested fields: - `_id` - `eventId` (unique when created from an
external event) - `camera` (reference to camera) - `detectionType` -
`violationType` - `description` - `severity` (`LOW`, `MEDIUM`, `HIGH`,
optionally `CRITICAL` only if approved) - `confidence` (0--1,
optional) - `status` (`PENDING`, `ACKNOWLEDGED`, `CLOSED`) -
`occurredAt` - `raisedAt` - `acknowledgedAt` - `acknowledgedBy` (user
reference) - `closedAt` - `closedBy` (user reference) -
`closureRemark` - `evidence` (references or compact metadata) - `source`
(`AI_CV`, `DEMO`, `MANUAL`) - `modelMetadata` (optional) - `createdAt` -
`updatedAt`

Add indexes for common filters, such as `raisedAt`, `status`,
`severity`, `camera`, and unique `eventId` where applicable.

#### `evidence`

Suggested fields: - `_id` - `alert` (reference to alert) - `camera`
(reference to camera) - `type` (`SNAPSHOT`, `CLIP`) - `storageKey` or
safe server-side object reference - `originalName` (sanitised display
metadata only) - `mimeType` - `sizeBytes` - `capturedAt` - `createdAt`

Do not store arbitrary client-provided filesystem paths.

#### `auditLogs` (recommended P0 for important actions)

Suggested fields: - `_id` - `actor` (user reference, nullable only for
trusted integration/system events) - `action`
(e.g. `ALERT_ACKNOWLEDGED`, `ALERT_CLOSED`, `CAMERA_CREATED`) -
`entityType` - `entityId` - `details` (minimal structured before/after
or action metadata) - `createdAt`

For the MVP, this is an application audit log. It is not the
append-only, hash-chained audit store described in the full enterprise
architecture.

### 7.2 Relationship approach

Use Mongoose references for: - Alert → Camera - Alert → Acknowledging
User - Alert → Closing User - Evidence → Alert - Evidence → Camera -
Audit Log → Actor

Use embedding for small, bounded metadata that is always read with its
parent record. Avoid embedding large evidence files or unbounded
activity histories in an alert document.

### 7.3 Data integrity

-   Add unique indexes for user email, camera code and external event
    ID.
-   Validate enum values at the schema and API layers.
-   Use timestamps.
-   Handle missing/deleted references safely.
-   Avoid trusting IDs supplied by the browser without checking
    existence and permissions.
-   Consider MongoDB transactions for multi-document operations if the
    deployment topology supports them and the operation requires
    atomicity.

## 8. API design

Use a versioned REST prefix such as `/api/v1`.

Suggested response envelope:

``` json
{
  "success": true,
  "message": "Alerts retrieved successfully",
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0
  }
}
```

For errors:

``` json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "A valid email is required"
    }
  ]
}
```

Do not expose stack traces, secrets or internal database errors in
production responses.

### 8.1 Authentication routes

  -----------------------------------------------------------------------
  Method                  Endpoint                Purpose
  ----------------------- ----------------------- -----------------------
  POST                    `/api/v1/auth/login`    Sign in

  POST                    `/api/v1/auth/logout`   Sign out / invalidate
                                                  session as designed

  GET                     `/api/v1/auth/me`       Current authenticated
                                                  user
  -----------------------------------------------------------------------

User administration routes are P1 unless required:

  ----------------------------------------------------------------------------
  Method                  Endpoint                     Purpose
  ----------------------- ---------------------------- -----------------------
  GET                     `/api/v1/users`              List users (Admin)

  POST                    `/api/v1/users`              Create/provision user
                                                       (Admin)

  PATCH                   `/api/v1/users/:id/status`   Activate/deactivate
                                                       user (Admin)
  ----------------------------------------------------------------------------

### 8.2 Dashboard routes

  --------------------------------------------------------------------------------------
  Method                  Endpoint                               Purpose
  ----------------------- -------------------------------------- -----------------------
  GET                     `/api/v1/dashboard/summary`            KPI counts

  GET                     `/api/v1/dashboard/violations-trend`   Time-series summary
                                                                 (P1)

  GET                     `/api/v1/dashboard/violation-types`    Breakdown by type (P1)

  GET                     `/api/v1/dashboard/recent-activity`    Recent audit/activity
                                                                 records (P1)
  --------------------------------------------------------------------------------------

### 8.3 Camera routes

  ------------------------------------------------------------------------------
  Method                  Endpoint                       Purpose
  ----------------------- ------------------------------ -----------------------
  GET                     `/api/v1/cameras`              List cameras with
                                                         pagination/filtering

  GET                     `/api/v1/cameras/:id`          Camera details

  POST                    `/api/v1/cameras`              Create camera (if
                                                         enabled)

  PATCH                   `/api/v1/cameras/:id`          Update camera metadata

  PATCH                   `/api/v1/cameras/:id/status`   Update status through
                                                         authorised/admin or
                                                         trusted health
                                                         integration
  ------------------------------------------------------------------------------

### 8.4 Alert routes

  -----------------------------------------------------------------------------------
  Method                  Endpoint                            Purpose
  ----------------------- ----------------------------------- -----------------------
  GET                     `/api/v1/alerts`                    List/filter alerts

  GET                     `/api/v1/alerts/:id`                Alert detail

  PATCH                   `/api/v1/alerts/:id/acknowledge`    Acknowledge alert

  PATCH                   `/api/v1/alerts/:id/close`          Close with required
                                                              remark

  POST                    `/api/v1/integrations/detections`   Receive trusted AI/CV
                                                              detection event
  -----------------------------------------------------------------------------------

The integration endpoint must use service authentication, validation and
idempotency. It must not use an ordinary user session as its only
protection.

### 8.5 Evidence routes

  -----------------------------------------------------------------------------
  Method                  Endpoint                      Purpose
  ----------------------- ----------------------------- -----------------------
  GET                     `/api/v1/evidence`            List evidence with
                                                        filters

  GET                     `/api/v1/evidence/:id`        Evidence metadata

  GET                     `/api/v1/evidence/:id/file`   Authorised evidence
                                                        retrieval

  POST                    `/api/v1/evidence`            Upload evidence if the
                                                        MVP requires manual
                                                        upload
  -----------------------------------------------------------------------------

Use pagination for list endpoints. Validate query parameters and cap
page size.

## 9. Frontend page requirements

### 9.1 Login page

-   Product identity and concise product description.
-   Email and password fields.
-   Show/hide password control.
-   Submit/loading state.
-   Validation and server error messages.
-   Responsive layout.
-   No public sign-up link unless approved.

### 9.2 Dashboard

-   Follow the approved mockup.
-   KPI cards for cameras, violations, pending alerts and resolved
    alerts.
-   Camera preview/status panel.
-   Violation trend and type breakdown when backed by API data.
-   Recent alerts table.
-   Recent activity only when supported by audit/activity data.
-   Date filter only if functional.
-   Clicking a KPI/card should navigate to the relevant filtered page
    where practical.

### 9.3 Cameras page

-   Table or card grid of cameras.
-   Search/filter by camera name/code and status.
-   Status badge and last-seen time.
-   Camera detail drawer/page.
-   Feed area with honest connection state.
-   Empty/loading/error states.

### 9.4 Alerts page

-   Alert table with ID, violation, camera, location, severity, time and
    status.
-   Filters for status, severity, camera and date.
-   Newest-first ordering.
-   Pagination.
-   Alert detail page/drawer.
-   Acknowledge and close actions based on current state and
    permissions.
-   Confirmation dialog for closing.
-   Required closure remark.
-   Clear success/error feedback.

### 9.5 Evidence page

-   Evidence list/grid.
-   Snapshot preview.
-   Related alert and camera details.
-   Capture timestamp.
-   Permission-aware viewing.
-   Clear unavailable/expired state if a file cannot be retrieved.

### 9.6 Reports page (conditional P1)

-   Basic summary only.
-   Do not create a visually polished but non-functional reporting
    module.
-   If not in MVP, hide the navigation item rather than showing a dead
    page.

## 10. Frontend engineering standards

-   Use React with Vite.
-   Use JavaScript unless the team explicitly decides to adopt
    TypeScript.
-   Use Tailwind CSS v4 with the Vite integration; do not add
    unnecessary PostCSS configuration.
-   Organise by features/modules where practical.
-   Keep API calls in a dedicated service/API layer, not scattered
    across UI components.
-   Use reusable layout, form, table, badge, modal, loading and
    empty-state components.
-   Keep authentication state and route protection consistent.
-   Use a form validation approach consistently.
-   Avoid duplicating server state in multiple unrelated places.
-   Add pagination and filters at the API level for larger datasets.
-   Use responsive layouts; desktop is the primary target, but core
    workflows should remain usable on tablet/mobile.
-   Avoid excessive animation. Small transitions are acceptable if they
    do not interfere with operations.
-   Do not hardcode dashboard totals, alert records or camera states in
    production UI.
-   Keep demo seed data separate from real records and clearly label
    demo mode.

## 11. Backend engineering standards

-   Use Node.js and Express.js.
-   Use Mongoose for MongoDB data models.
-   Separate routes, controllers, services, models, middleware,
    validators and configuration.
-   Keep controllers thin; place business rules in services.
-   Validate all request bodies, params and query strings with Zod or an
    equivalent validation library.
-   Use centralised error handling.
-   Use structured server-side logging.
-   Use pagination and safe filtering.
-   Use allowlists for sort fields and filter values.
-   Use environment variables for configuration.
-   Never commit `.env` files.
-   Provide `.env.example` with placeholder values only.
-   Use secure headers, rate limiting, CORS allowlists and appropriate
    request-size limits.
-   Use parameter-safe Mongoose query construction; do not pass
    arbitrary user objects directly into database filters.
-   Enforce ownership/role permissions in middleware or services.
-   Add tests for critical business logic and state transitions.

## 12. Suggested repository structure

The repository must use separate frontend and backend folders.

``` text
visual-safety-surveillance/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── layout/
│   │   │   ├── dashboard/
│   │   │   ├── cameras/
│   │   │   ├── alerts/
│   │   │   └── evidence/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── cameras/
│   │   │   ├── alerts/
│   │   │   └── evidence/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── services/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── styles/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── validators/
│   │   ├── utils/
│   │   ├── scripts/
│   │   ├── app.js
│   │   └── server.js
│   ├── uploads/              # Local development only; gitignored
│   ├── tests/
│   ├── .env.example
│   └── package.json
│
├── docs/
│   ├── API.md
│   ├── DATA_MODEL.md
│   └── MVP_SCOPE.md
│
├── .gitignore
└── README.md
```

Do not create empty folders/modules merely to make the tree look
complete. Add modules when they are needed.

## 13. Environment configuration

Example frontend environment:

``` env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

Example backend environment:

``` env
NODE_ENV=development
PORT=5000
MONGODB_URI=
JWT_SECRET=
CLIENT_ORIGIN=http://localhost:5173
INTEGRATION_API_KEY=
```

These are placeholders. Generate strong secrets locally and never put
actual credentials in documentation, Git or frontend environment
variables. Any variable prefixed with `VITE_` is exposed to the browser
and must never contain secrets.

## 14. Error, loading and empty states

Every data-driven page must account for:

-   Initial loading.
-   Empty data.
-   API/network failure.
-   Unauthorised access.
-   Forbidden action.
-   Missing/deleted camera or alert.
-   Evidence unavailable.
-   Offline/degraded camera state.
-   Form validation errors.
-   Duplicate event ingestion.

Do not show stale data as if it were live. Where stale cached data is
displayed, identify its last update time.

## 15. Security and privacy requirements

Security is part of the MVP, not a later decoration.

-   Hash passwords; never store plaintext passwords.
-   Use least-privilege roles.
-   Protect all private API routes.
-   Validate and sanitise user inputs.
-   Rate-limit authentication and sensitive endpoints.
-   Restrict CORS to known frontend origins.
-   Use secure cookies/session configuration if cookies are selected.
-   Keep MongoDB Atlas credentials and integration secrets on the
    backend.
-   Use TLS/HTTPS in deployed environments.
-   Restrict evidence access and log sensitive evidence access where
    practical.
-   Validate uploads by content type, size and actual file signature
    where feasible.
-   Prevent path traversal and unsafe filenames.
-   Do not expose CCTV credentials or direct private camera URLs to
    browsers.
-   Do not implement face recognition or identity matching.
-   Use anonymous person/detection references only where supplied by the
    AI/CV system.
-   Do not collect personal information that is not required for the
    safety workflow.

## 16. Testing requirements

Minimum MVP testing:

### Authentication

-   Valid login succeeds.
-   Invalid login fails safely.
-   Unauthenticated API access is rejected.
-   Inactive user cannot access the application.
-   Role restrictions are enforced by backend.

### Cameras

-   Camera list returns expected records.
-   Invalid camera ID returns a controlled 404.
-   Camera status is displayed correctly.
-   Camera detail does not expose secrets.

### Alerts

-   Valid detection event creates one alert.
-   Duplicate `eventId` does not create duplicate alerts.
-   Invalid payload is rejected.
-   Alert list filters work.
-   Acknowledge changes state and records actor/time.
-   Close requires a remark.
-   Invalid state transitions are rejected.
-   Unauthorised users cannot perform restricted actions.

### Evidence

-   Evidence is linked to the correct alert.
-   Unauthorised access is rejected.
-   Unsupported file type and oversized file are rejected if upload is
    enabled.
-   Missing evidence is handled gracefully.

### Dashboard

-   KPI counts match database records.
-   Empty state works.
-   Counts update after alert creation/closure.
-   Date filters use consistent timezone handling.

## 17. Development milestones

Build in small demonstrable increments.

### Milestone 0 --- Requirements and setup

Deliver: - Approved MVP scope. - Confirmed UI reference. - Repository
with separate frontend/backend folders. - MongoDB Atlas development
database connection. - Environment examples and README. - Basic
health-check endpoint.

### Milestone 1 --- Application foundation

Deliver: - React application shell. - Express app and central error
handling. - MongoDB connection. - Basic API client. - Shared design
tokens and reusable UI primitives.

### Milestone 2 --- Authentication

Deliver: - Login page. - Login/logout/current-user APIs. - Password
hashing. - Protected frontend routes. - Backend role middleware. -
Seeded initial Admin account through a safe script.

### Milestone 3 --- Dashboard and cameras

Deliver: - Dashboard KPI API and UI. - Camera collection/model. - Camera
list/detail APIs and UI. - Camera status and honest stream states.

### Milestone 4 --- Alerts and evidence

Deliver: - Detection event contract and protected ingestion endpoint. -
Alert model and lifecycle services. - Alert list/detail APIs and UI. -
Acknowledge and close workflows. - Evidence metadata and authorised
retrieval. - Demo event/seed data for demonstration.

### Milestone 5 --- Integration and hardening

Deliver: - AI/CV contract alignment. - Integration test with sample
payload. - Dashboard data verification. - Permission and validation
tests. - UI responsive/error-state review. - Updated documentation and
MVP demo script.

### Milestone 6 --- Optional P1 improvements

Only after P0 milestones are complete: - Basic violation charts and date
filters. - User management. - Basic report summary. - Alert
assignment/activity timeline.

## 18. Definition of Done

A feature is complete only when:

-   It meets an explicit MVP requirement.
-   The frontend is connected to the correct backend API where
    applicable.
-   Backend validation and authorisation are implemented.
-   Loading, empty and error states are handled.
-   Data is persisted and retrieved correctly.
-   Critical paths have been tested.
-   No secrets are committed.
-   The UI follows the approved design system.
-   The feature is documented sufficiently for another developer to
    understand it.

The MVP is complete when the end-to-end workflow in Section 4 can be
demonstrated reliably.

## 19. Instructions for Antigravity / coding agent

Follow these rules while implementing:

1.  Read this PRD fully before creating files or writing code.
2.  Treat the approved dashboard mockup as the visual reference.
3.  Implement only the 20% MVP scope in this document. Do not silently
    expand scope.
4.  Use MongoDB Atlas, Mongoose, React/Vite, Tailwind CSS v4, Node.js
    and Express.
5.  Keep frontend and backend in separate top-level folders.
6.  Use JavaScript unless explicitly instructed otherwise.
7.  Build a modular monolith backend; do not introduce microservices.
8.  Do not add Kafka, Redis, Kubernetes, GraphQL or other infrastructure
    unless a demonstrated MVP requirement needs it and approval is
    obtained.
9.  Do not build AI/CV models. Implement only the documented integration
    boundary and use clearly labelled sample events until the AI/CV team
    provides its contract.
10. Do not hardcode production dashboard metrics or pretend demo data is
    live.
11. Do not invent API contracts from the AI/CV team; mark the proposed
    contract as provisional until confirmed.
12. Do not invent credentials, camera endpoints, site names or real
    operational data.
13. Ask before making a major architectural change or adding a
    significant dependency.
14. Work milestone by milestone. At the end of each milestone, report:
    -   What was implemented.
    -   Files/folders created or changed.
    -   Commands to run.
    -   How to test the work.
    -   Known limitations.
    -   Decisions or information still needed.
15. Do not proceed to a large subsequent milestone if the current
    milestone is broken.
16. Prefer simple, readable, maintainable code over clever abstractions.
17. Keep README and API/data-model documentation updated as
    implementation evolves.

### First task for Antigravity

Do not immediately generate the entire application.

Start by: 1. Summarising this PRD into a concise implementation
checklist. 2. Identifying any ambiguities or missing external
dependencies. 3. Proposing the final MVP route/page list and initial
MongoDB collection design. 4. Proposing the exact setup commands and
package dependencies. 5. Waiting for approval before generating the
project structure and implementation.

------------------------------------------------------------------------

## 20. Source alignment and open decisions

This MVP is derived from the supplied **Visual Safety Surveillance
Platform --- Software Development Handoff, Version 1.0, dated 30 October
2026**, especially:

-   Pages 2--3: Product purpose, scope boundaries and contract-level
    requirements.
-   Pages 3--5: Live site view, real-time alerts, dashboards,
    operational tools and video-to-alert workflow.
-   Pages 6--8: Data entities, event envelope, AI/CV expectations,
    frontend UX and security/privacy.
-   Pages 9--10: Open decisions, development sequence, team
    responsibilities and definition of done.

The full handoff proposes PostgreSQL as its operational database. This
PRD records the separately agreed MVP decision to use MongoDB Atlas.
This is an MVP implementation choice and should be reviewed if the
product later needs to meet the full relational reporting, audit and
contractual requirements.

The following items remain subject to confirmation and must not be
silently assumed:

-   Final list of MVP features and acceptance criteria from the
    supervisor.
-   Exact AI/CV integration payload, authentication and retry contract.
-   Whether real CCTV streams are available and how they may be
    accessed.
-   Final role/permission matrix.
-   Whether camera creation/editing is required in the first MVP.
-   Whether manual evidence upload is required or evidence is supplied
    only by AI/CV.
-   Evidence storage provider for deployment.
-   Whether basic reports are required in the first MVP.
-   Hosting/deployment environment and production security requirements.
-   Any site-specific safety terminology, severity mapping or detection
    catalogue selections.

**End of PRD.**
