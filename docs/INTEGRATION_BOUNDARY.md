# Visual Safety Surveillance Platform (VSSP)
## AI/CV Integration Boundary & External Dependencies

---

### 1. Architectural Boundary & Ownership

Per the approved **Product Requirements Document (PRD.md)** and system architecture, the platform maintains a strict separation of concerns:

| Domain | Responsible Party | In Scope for VSSP 20% MVP |
|---|---|:---:|
| **Computer Vision Inference** (YOLO, ByteTrack, RTMPose) | External AI/CV Team | **No** (Out of Scope) |
| **Video Ingestion & Hardware** (RTSP, ONVIF, GPU clusters) | External AI/CV / Infrastructure Team | **No** (Out of Scope) |
| **Detection Event Dispatcher** | External AI/CV Team | **No** (External Service) |
| **Alert & Evidence Ingestion Receiver** | VSSP Backend Core | **Yes** (Provisional Boundary) |
| **Alert Lifecycle Management** (`PENDING → ACKNOWLEDGED → CLOSED`) | VSSP Backend Core | **Yes** |
| **Snapshot Evidence Viewing & Integrity** | VSSP Backend Core | **Yes** |
| **Web Console & Dashboard** (Admin & Operator UI) | VSSP Frontend Core | **Yes** |

---

### 2. Status of External AI/CV Contract

> [!IMPORTANT]
> **External Dependency Notice:**
> The final production integration contract (including service-to-service authentication schemes, webhook signatures, exact payload naming, and retry policies) has **not yet been published** by the external AI/CV team.
> 
> As mandated by project guidelines:
> - Payload fields and authentication schemes have **not** been prematurely invented.
> - The application relies on a **development-only demo event simulator** (`POST /api/v1/demo/ingest-event`) for end-to-end verification.
> - The demo simulator is **strictly unmounted at route-registration level** in production environments (`env.NODE_ENV === 'production'`).

---

### 3. Provisional Demo Ingestion Specification (MVP Simulation Only)

> [!CAUTION]
> **Provisional Simulation Disclaimer:**
> The payload schema and endpoint structure shown below are **strictly an internal mock/simulation contract** implemented in `backend/src/routes/demoRoutes.js` (`POST /api/v1/demo/ingest-event`) to validate MVP workflows (event reception, alert creation, snapshot storage, and operator triage).
>
> **Do not treat these payload fields or authentication headers as confirmed requirements.**
>
> The actual production endpoint path, payload structure, field naming, and service authentication method (e.g. mTLS, HMAC signature, API Key, or webhook header) are completely owned by the external AI/CV team and remain an **open external dependency**.

#### Internal Demo Event Payload (Used Exclusively for Development Testing)
```json
{
  "eventId": "EVT-2026-0001",
  "cameraCode": "CAM-001",
  "violationType": "NO_HELMET",
  "violationName": "Missing Safety Helmet",
  "severity": "HIGH",
  "confidence": 0.942,
  "occurredAt": "2026-10-31T10:35:00.000Z",
  "description": "Worker detected in active gantry crane perimeter without helmet.",
  "location": "Zone B - Main Assembly",
  "evidence": {
    "snapshotUrl": null,
    "fileType": "image/jpeg"
  },
  "metadata": {
    "modelName": "yolo-ppe-industrial",
    "modelVersion": "v2.1.0"
  }
}
```

#### Core Validation Rules Enforced Internally by VSSP:
1. **Existing Camera Requirement:** The incoming `cameraCode` must match an existing, active camera in MongoDB (`Camera.findOne({ cameraCode, isActive: true })`). Events referencing unverified or unregistered cameras are rejected with HTTP 404; cameras are never created automatically.
2. **Idempotency via `eventId`:** The `eventId` is uniquely indexed in MongoDB. Duplicate event submissions are rejected with HTTP 400 Bad Request to prevent duplicate alert generation.
3. **Evidence Validation:** Ingested snapshot files must be valid JPEG, PNG, or WebP images verified by binary magic numbers, with file sizes strictly under 5 MB. Storage is isolated outside public web roots.
4. **Initial Lifecycle State:** All newly ingested alerts strictly initialize in `PENDING` status.
5. **Standard Audited Storage:** Every ingestion event generates a standard MongoDB audit entry capturing source metadata, camera point, and server timestamp (without claiming tamper-proof or immutable storage).

---

### 4. Integration Next Steps (Post-MVP Dependency)
Upon receipt of the AI/CV team's finalized service specification:
1. Review the external team's published authentication scheme (e.g., mTLS, HMAC header, or token verification).
2. Create the production ingestion route using the external team's agreed endpoint path and payload fields.
3. Map external violation taxonomy (e.g. D01–D54) to internal VSSP categories.
4. Replace the development demo simulator route (`/demo/ingest-event`) with the confirmed production handler.

