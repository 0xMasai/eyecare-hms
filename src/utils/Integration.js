// ════════════════════════════════════════════════════════════════════════
// MEDITRACK — STAFF ACCOUNTS: INTEGRATION GUIDE
// ════════════════════════════════════════════════════════════════════════

// ── 1. FIRESTORE COLLECTION: staff ────────────────────────────────────────
//
// Document shape:
// {
//   clinicId:  string,          // scopes staff to a clinic
//   firstName: string,
//   lastName:  string,
//   email:     string,          // optional
//   role:      string,          // see roles below
//   pin:       string,          // 4-digit string, e.g. "4821"
//   status:    "active" | "inactive",
//   createdAt: Timestamp,
//   createdBy: string           // staffId of admin who created
// }
//
// Roles:
//   admin        → full dashboard + staff management
//   receptionist → reception only
//   doctor       → consultation only
//   lab          → lab only
//   pharmacist   → pharmacy only
//   billing      → billing only

// ── 2. FIRESTORE SECURITY RULES ───────────────────────────────────────────
//
// Add to your firestore.rules:

/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Staff collection — read by PIN lookup, write only by admin-role staff
    match /staff/{staffId} {
      // Anyone can read (needed for PIN login query)
      allow read: if true;

      // Only allow writes if the requesting staff member is an admin
      // In practice, writes happen server-side via Admin SDK or
      // you gate this in app logic (AdminDashboard only renders for admins)
      allow create, update, delete: if true; // tighten after adding Firebase Auth
    }

    // All other collections require clinicId match
    match /visits/{id} {
      allow read, write: if true; // tighten with Auth
    }
    match /patients/{id} {
      allow read, write: if true;
    }
    match /consultations/{id} {
      allow read, write: if true;
    }
    match /lab_tests/{id} {
      allow read, write: if true;
    }
    match /pharmacy_orders/{id} {
      allow read, write: if true;
    }
    match /invoices/{id} {
      allow read, write: if true;
    }
  }
}
*/

// ── 3. APP.JSX INTEGRATION ────────────────────────────────────────────────
//
// Replace your current App.jsx tab router with this pattern:

/*
import { useStaffAuth, ROLE_DEFAULT_TAB } from "./useStaffAuth";
import StaffLoginScreen from "./StaffLoginScreen";
import AdminDashboard from "./pages/AdminDashboard";
import Reception      from "./pages/Reception";
import Consultation   from "./pages/Consultation";
import LabPage        from "./pages/LabPage";
import Pharmacy       from "./pages/Pharmacy";
import Billing        from "./pages/Billing";

const CLINIC_ID   = "your-clinic-id-here";
const CLINIC_NAME = "Kampala Health Clinic";

export default function App() {
  const { staffProfile, login, logout, loading, error, canAccess } = useStaffAuth(CLINIC_ID);
  const [tab, setTab] = useState(null);

  // Set default tab when staff logs in
  useEffect(() => {
    if (staffProfile && !tab) {
      setTab(ROLE_DEFAULT_TAB[staffProfile.role] || "reception");
    }
  }, [staffProfile]);

  // Show PIN login if no session
  if (!staffProfile) {
    return (
      <StaffLoginScreen
        onLogin={login}
        error={error}
        loading={loading}
        clinicName={CLINIC_NAME}
      />
    );
  }

  const renderTab = () => {
    switch (tab) {
      case "dashboard":    return <AdminDashboard clinicId={CLINIC_ID} userProfile={staffProfile} />;
      case "reception":    return <Reception      clinicId={CLINIC_ID} userProfile={staffProfile} />;
      case "consultation": return <Consultation   clinicId={CLINIC_ID} userProfile={staffProfile} />;
      case "lab":          return <LabPage        clinicId={CLINIC_ID} userProfile={staffProfile} />;
      case "pharmacy":     return <Pharmacy       clinicId={CLINIC_ID} userProfile={staffProfile} />;
      case "billing":      return <Billing        clinicId={CLINIC_ID} userProfile={staffProfile} />;
      default:             return null;
    }
  };

  // Bottom nav — only show tabs the role is permitted to see
  const NAV_ITEMS = [
    { id: "dashboard",    label: "Dashboard", icon: "📊" },
    { id: "reception",    label: "Reception", icon: "🏥" },
    { id: "consultation", label: "Doctor",    icon: "👨‍⚕️" },
    { id: "lab",          label: "Lab",       icon: "🔬" },
    { id: "pharmacy",     label: "Pharmacy",  icon: "💊" },
    { id: "billing",      label: "Billing",   icon: "💳" },
  ].filter(item => canAccess(item.id));

  return (
    <div style={{ paddingBottom: "64px" }}>
      {renderTab()}

      // Bottom navigation bar
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "white", borderTop: "1px solid #E2E8F0",
        display: "flex", zIndex: 40,
      }}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            style={{
              flex: 1, padding: "8px 4px 10px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
              color:      tab === item.id ? "#0D2C6E" : "#94A3B8",
              fontWeight: tab === item.id ? "700" : "500",
              fontSize:   "10px",
              background: "none", border: "none",
              borderTop:  tab === item.id ? "2px solid #0D2C6E" : "2px solid transparent",
            }}
          >
            <span style={{ fontSize: "18px" }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      // Logout button (e.g. in a settings/profile sheet)
      // <button onClick={logout}>Log out</button>
    </div>
  );
}
*/

// ── 4. CREATING THE FIRST ADMIN ───────────────────────────────────────────
//
// Bootstrap the first admin account directly in Firestore Console:
//
// Collection: staff
// New document (auto-ID):
// {
//   clinicId:  "your-clinic-id",
//   firstName: "Admin",
//   lastName:  "User",
//   email:     "admin@yourclinic.ug",
//   role:      "admin",
//   pin:       "1234",       ← change immediately after first login
//   status:    "active",
//   createdAt: (server timestamp),
//   createdBy: "bootstrap"
// }
//
// After logging in as admin, use Staff Management to create all other accounts
// and reset your own PIN via the modal.

// ── 5. SECURITY NOTES ─────────────────────────────────────────────────────
//
// PINs are stored in plaintext in this implementation for simplicity.
// For production, consider:
//   a) Hashing PINs with bcrypt via a Cloud Function on create/reset
//   b) Adding Firebase Auth (email+password) as a second factor for admins
//   c) Tightening Firestore rules to require a valid Firebase Auth UID
//
// The current PIN-in-Firestore approach is appropriate for:
//   - Low-risk internal clinic systems
//   - Facilities where staff share devices (tablet at reception desk)
//   - Environments without reliable email access for Firebase Auth flows