## Cashly — Personal Expense & Income Tracker

Production-ready personal finance tracker built with **Next.js 14 (App Router)**, **TypeScript**, **Firebase Auth + Firestore**, **Tailwind**, and **shadcn/ui**.

### Features
- **Auth**: Email/password via Firebase Auth, secured with **HttpOnly session cookies** (server verified)
- **Security**: Strict Firestore rules — users can only access their own data and **cannot manipulate balances directly**
- **Data**: Realtime sync + offline-first Firestore cache (multi-tab safe)
- **Finance logic** (atomic):
  - Income increases account balance
  - Expense decreases account balance
  - Transfers between accounts supported
  - All balance updates use **Firestore transactions**
- **UI**: Mobile-first dashboard, transactions (filter + add/edit/delete), accounts & category management

### Tech
- **Next.js**: App Router, server components for protected layout
- **State/sync**: Firestore realtime listeners (+ React Query scaffold)
- **Validation**: Zod
- **Reusable architecture**: shared data schemas under `src/shared/` for future Expo/RN reuse

---

## Setup

### 1) Create Firebase project
In Firebase Console:
- Create a project
- Enable **Authentication → Email/Password**
- (Optional) Enable **Authentication → Sign-in method → Google**
- Create **Firestore Database** (production mode)

### 2) Add a Web App + env vars
Copy `env.example` → `.env.local` and fill:
- `NEXT_PUBLIC_FIREBASE_*` values from Firebase **Project settings → Your apps**

### 3) Create Firebase Admin credentials (server)
Create a service account in Google Cloud / Firebase:
- Download JSON key
- Set:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_ADMIN_CLIENT_EMAIL`
  - `FIREBASE_ADMIN_PRIVATE_KEY` (keep `\n` newlines as shown in `env.example`)

### 4) Firestore rules + indexes
This repo includes:
- `firestore.rules`
- `firestore.indexes.json`

Deploy with Firebase CLI:

```bash
npm i -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore
```

`firebase.json` is already included and points to `firestore.rules` and `firestore.indexes.json`.

### 5) Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## Data Model (Firestore)

```
users/{userId}
  ├── profile/profile
  ├── accounts/{accountId}
  ├── categories/{categoryId}
  ├── transactions/{transactionId}
```

- **IDs**: UUID (`crypto.randomUUID()` when available)
- **Timestamps**: server timestamps (`createdAt`, `updatedAt`)
- **Atomicity**: account balance changes occur in the **same transaction** as the transaction doc write

### Balance integrity (important)
Firestore rules enforce that an account’s `balance` can only change when:
- a matching transaction write/update happens, and
- the delta equals the expected effect of that transaction, and
- `balanceMutationId` references that transaction

This prevents “manual” balance overwrites from a compromised client.

---

## Scripts
- `npm run dev`: local dev
- `npm run build`: production build
- `npm run start`: start production server

### Mobile (Android APK)
Your web app can be exported as an Android APK using Capacitor. The project is already configured!

**Prerequisites:**
- Android Studio installed
- Android SDK configured
- Java JDK installed

**Build the APK:**

1. **Build and sync the web app to Android:**
   ```bash
   npm run mobile:build
   ```
   This builds your Next.js app and syncs it to the Android project.

2. **Build the APK (choose one method):**

   **Option A: Using Gradle directly (faster):**
   ```bash
   npm run mobile:apk
   ```
   The APK will be generated at: `android/app/build/outputs/apk/debug/app-debug.apk`

   **Option B: Using Android Studio (recommended for first-time setup):**
   ```bash
   npm run mobile:open
   ```
   This opens Android Studio. Then:
   - Wait for Gradle sync to complete
   - Click "Build" → "Build Bundle(s) / APK(s)" → "Build APK(s)"
   - Or use "Run" to install on a connected device/emulator

**For release builds:**
- Open Android Studio (`npm run mobile:open`)
- Build → Generate Signed Bundle / APK
- Follow the signing wizard

**Note:** The web app is exported as static files, so all features that work in the browser will work in the mobile app. Firebase authentication and Firestore will work the same way.

---

## Notes for React Native (Expo) reuse
- Shared UUID + schema types live in:
  - `src/shared/ids.ts`
  - `src/shared/finance-schemas.ts`
- Firestore structure and mutation semantics are identical for web and mobile.

---

## Offline + conflict handling
- Firestore provides **offline-first** writes and realtime sync.
- For edits/deletes, Cashly uses **timestamp-based conflict detection**:
  - When editing/deleting a transaction we pass its last `updatedAt` as `expectedUpdatedAt`.
  - If the doc has changed on another device, the transaction aborts with a **conflict** error.
