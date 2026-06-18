# 🏥 MediTrack Uganda — Clinic Management System

A real-time, offline-resilient clinic management system built for Level II & III clinics in Kampala.

---

## ⚡ Quick Start

### 1. Create Your Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add Project** → name it `meditrack-uganda`
3. Disable Google Analytics (optional) → **Create Project**

### 2. Enable Firebase Services

**Authentication:**
- Sidebar → Build → Authentication → Get started
- Sign-in method → Email/Password → Enable → Save

**Firestore Database:**
- Sidebar → Build → Firestore Database → Create database
- Choose **Start in test mode** (you can add security rules later)
- Select nearest region (e.g., `eur3` or `asia-south1`)

### 3. Get Your Firebase Config

- Project Settings (gear icon) → General → Your apps
- Click **</>** (Web) → Register app → name it `meditrack`
- Copy the `firebaseConfig` object

### 4. Paste Config into the App

Open `src/firebase/config.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
};
```

### 5. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 👤 Create Your First Admin User

In the Firebase Console:
1. Authentication → Users → Add user
2. Enter email and password

Then in Firestore → Data → Add collection `users` → Add document:
- **Document ID:** (paste the user's UID from Authentication)
- Fields:
  - `userId` (string): same as document ID
  - `clinicId` (string): `clinic-001`
  - `name` (string): `Admin User`
  - `role` (string): `admin`
  - `email` (string): the email you used
  - `createdAt` (timestamp): now

---

## 🏥 Set Up Your Clinic

In Firestore → `clinics` collection → Add document:
- **Document ID:** `clinic-001`
- `clinicId`: `clinic-001`
- `name`: your clinic name (e.g., `Nakawa Health Centre III`)
- `location`: your address
- `phone`: clinic phone number
- `createdAt`: timestamp

---

## 👥 User Roles

| Role | Access |
|------|--------|
| `admin` | All pages: Reception, Doctor, Lab, Dashboard |
| `reception` | Reception only |
| `doctor` | Doctor's queue (Consultation) |
| `lab` | Lab results page |

Create a user for each staff member in Firestore `users` collection with their Firebase Auth UID as the document ID.

---

## 📱 The Patient Flow

```
Reception → Register Patient → Start Visit → Assign Department
                                                    ↓
Doctor → Sees Queue → Opens Visit → Views Lab Tests (pending/done)
                                  → Adds Consultation Notes
                                                    ↓
Lab Staff → Sees Pending Tests → Enters Results → Marks Complete
                                                    ↓
Admin → Watches live stats update in real-time on Dashboard
```

---

## 🗄️ Firestore Security Rules (Recommended for Production)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    function hasRole(role) {
      return getUserData().role == role;
    }
    function isClinicStaff(clinicId) {
      return getUserData().clinicId == clinicId;
    }

    match /patients/{patientId} {
      allow read, write: if isSignedIn();
    }
    match /visits/{visitId} {
      allow read, write: if isSignedIn();
    }
    match /consultations/{id} {
      allow read, write: if isSignedIn();
    }
    match /lab_tests/{id} {
      allow read, write: if isSignedIn();
    }
    match /daily_stats/{id} {
      allow read, write: if isSignedIn();
    }
    match /departments/{id} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && hasRole('admin');
    }
    match /users/{userId} {
      allow read: if isSignedIn() && request.auth.uid == userId;
      allow write: if isSignedIn() && hasRole('admin');
    }
    match /clinics/{clinicId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && hasRole('admin');
    }
  }
}
```

---

## 🚀 Deploy to Firebase Hosting (Free)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Public dir: dist
# Single page app: yes
npm run build
firebase deploy
```

Your app will be live at `https://your-project.web.app`

---

## 📁 Project Structure

```
src/
  components/
    PatientForm.jsx      — 2-step patient registration
    VisitForm.jsx        — Start visit, pick type + department
    ConsultationForm.jsx — Doctor's notes (symptoms/diagnosis/treatment)
    LabResults.jsx       — Lab tests with pending/completed display
    StatsCard.jsx        — Metric card for dashboard
    DailyPatientsGraph.jsx — Recharts area graph

  pages/
    Reception.jsx        — Queue view + register + find patient
    Consultation.jsx     — Doctor queue + patient history
    LabPage.jsx          — Lab staff enter results
    AdminDashboard.jsx   — Real-time stats + graph

  firebase/
    config.js            — Firebase initialization

  App.jsx                — Auth + routing
  main.jsx               — React entry
```

---

## 🛠 Tech Stack

- **React 18** (Vite) — fast builds, modern React
- **TailwindCSS** — utility-first, touch-friendly UI
- **Firebase Auth** — email/password sign-in
- **Cloud Firestore** — real-time database with `onSnapshot`
- **Recharts** — daily patient graph
- **date-fns** — date formatting

---

## ✅ Success Criteria Met

- [x] Register a patient in <30 seconds (2-step form)
- [x] Start a visit immediately (1 tap after patient found)
- [x] Doctor sees history in 2 clicks
- [x] Lab tests visible even when pending ("Waiting for lab results...")
- [x] Admin sees live daily patient numbers (onSnapshot)
