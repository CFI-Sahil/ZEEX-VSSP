# Visual Safety Surveillance Platform (VSSP)
## Step-by-Step MVP Demonstration Script

This walkthrough script demonstrates the complete 20% MVP workflow across all approved milestones (Authentication & RBAC, Camera Management, Dynamic Metrics, Safety Alerts, Evidence Management, and Audited Lifecycle Actions).

---

### Prerequisites & Demo Credentials

| Role | Email | Password | Access Rights |
|---|---|---|---|
| **Administrator** | `admin@vssp.local` | *(configured in .env / seeded)* | Full administrative access: Camera CRUD, Alert review, Evidence viewing |
| **Safety Operator** | `operator@vssp.local` | *(configured in .env / seeded)* | Operational monitoring: Camera read-only, Alert review, Acknowledge, Close with remarks, Evidence viewing |

#### Startup Commands:
```bash
# Terminal 1: Backend API (port 5000)
cd backend
npm run dev

# Terminal 2: Frontend App (port 5173)
cd frontend
npm run dev
```

---

### Step 1: Secure Login & Role-Based Navigation

1. Open your browser and navigate to `http://localhost:5173/`.
2. Notice automatic redirection to `/login` due to route protection.
3. Sign in as **Administrator** (`admin@vssp.local`).
4. **Observe:**
   - Redirection to `/` (Safety Dashboard).
   - Topbar displays authenticated profile: **System Administrator** with badge **ADMINISTRATOR**.
   - Browser receives HttpOnly `vssp_jwt` session cookie and Double-Submit `vssp_csrf` cookie.

---

### Step 2: Camera Management & Honest Telemetry

1. In the sidebar, click **Cameras** (`/cameras`).
2. **Observe:**
   - Active camera monitoring points rendered in table format.
   - Initial cameras show connection status `UNKNOWN` or `ONLINE`, stream connectivity `UNAVAILABLE`, and last heartbeat `Never (Null)`.
   - Clear disclaimers indicating no live RTSP feed is active in the 20% MVP.
3. Click **Add Camera** (visible to Admin only).
   - Code: `CAM-DEMO-01`
   - Name: `Main Chemical Storage Vault`
   - Site: `Plant 1`
   - Location: `Zone D North`
   - Description: `Hazardous solvent containment area`
4. Click **Register Camera**.
   - The camera appears in the table with `UNKNOWN` status and null heartbeat.
5. Click **Inspect** to review metadata in the modal.
6. Click **Edit**, change status to `ONLINE`, and save changes.
   - Status badge updates to green `ONLINE` while stream remains honestly `UNAVAILABLE`.

---

### Step 3: Safety Violation Detection Ingestion

1. In the sidebar, click **Alerts** (`/alerts`).
2. Click **Simulate Violation Event** (top right dev trigger).
3. In the simulation dialog:
   - Camera: Select `CAM-DEMO-01`
   - Violation: `Missing Safety Helmet` (`NO_HELMET`)
   - Severity: `HIGH`
   - Confidence: `94%`
4. Click **Trigger Event**.
5. **Observe:**
   - Alert appears immediately at the top of the table.
   - State initializes strictly to `PENDING` (yellow dot).
   - Action buttons show **Inspect** and **Acknowledge**. Notice that the **Close** button is intentionally absent because direct closure from `PENDING` is strictly prohibited.

---

### Step 4: Evidence Inspection & Vault Viewing

1. Click **Inspect** on the new alert row.
2. **Observe in Detail Modal:**
   - AI Confidence score displayed as `94.0%`.
   - Snapshot evidence image rendered from authenticated route `/api/v1/evidence/:id/file`.
   - Location and camera information.
3. Dismiss modal and navigate to **Evidence** (`/evidence`) in the sidebar.
4. **Observe:**
   - Evidence gallery card displays snapshot thumbnail, format tag (JPEG/PNG), file size (< 5 MB), and timestamp.
5. Click **Inspect** on the card to open the high-resolution evidence viewer.

---

### Step 5: Safety Operator Workflow & Audited Closure

1. Click **Sign Out** in the topbar or sidebar.
2. Sign in as **Safety Operator** (`operator@vssp.local`).
3. Navigate to **Cameras** (`/cameras`):
   - Notice that **Add Camera** and **Edit** buttons are completely absent (RBAC enforcement).
4. Navigate to **Alerts** (`/alerts`):
   - The `PENDING` alert is visible to the operator.
5. Click **Acknowledge**:
   - Status transitions to `ACKNOWLEDGED` (blue badge).
   - "Acknowledge" button disappears and the **Close** button is now unlocked.
6. Click **Close**:
   - The Close Alert modal opens.
   - Enter mandatory resolution remarks: `Worker supplied with standard PPE helmet and logged into safety registry.`
   - Click **Confirm & Close Alert**.
7. **Observe:**
   - Status updates to `CLOSED` (green badge).
   - Click **Inspect** to view the audited closure remarks and closing operator name.

---

### Step 6: Dynamic Dashboard Verification

1. Navigate to **Dashboard** (`/`):
2. **Observe Dynamic Metrics:**
   - **Total Violations:** Accurately reflects all logged events.
   - **Pending Alerts:** Decreased to `0` (or current open count).
   - **Resolved Alerts:** Incremented by `1`.
3. In the **Recent Safety Alerts** table:
   - The closed violation event is displayed with the `CLOSED` badge.
4. In the **Camera Monitoring Points** section:
   - Registered cameras are shown with honest status and stream badges.

---

### Step 7: Security & Exception Boundary Verification

- **Direct Closure Prevention:** Direct closure from `PENDING` returns HTTP 400.
- **Duplicate Prevention:** Ingestion of an already processed `eventId` returns HTTP 400.
- **Non-Existent Cameras:** Detection events targeting non-existent cameras return HTTP 404 (cameras are never auto-created).
- **Production Guard:** When `NODE_ENV=production`, `/api/v1/demo/*` returns HTTP 404.

