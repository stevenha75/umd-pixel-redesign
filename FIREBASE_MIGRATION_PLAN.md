# Firebase Migration Checklist: UMD Pixel Redesign

Use this checklist to track your progress through the migration.

## Phase 1: Project Initialization & Setup
- [x] **Initialize New Frontend**
    - [x] Create Next.js app: `npx create-next-app@latest umd-pixel-redesign --typescript --eslint --tailwind`
    - [x] Verify default page loads.
- [ ] **Firebase Project Setup**
    - [ ] Create project in [Firebase Console](https://console.firebase.google.com/).
    - [ ] Enable **Authentication** (Email/Password as placeholder, later Custom).
    - [ ] Enable **Firestore Database** (Start in Test Mode).
    - [ ] Enable **Functions** (Requires Blaze Plan - Pay as you go).
    - [ ] Register web app and get config.
- [ ] **Local Development Environment**
    - [ ] Install tools: `npm install -g firebase-tools`
    - [ ] Login: `firebase login`
    - [ ] Init project: `firebase init` (Select Firestore, Functions, Emulators).
    - [ ] Verify `firebase.json` and `.firebaserc` are created.

## Phase 2: Database Architecture (Firestore)
- [ ] **Schema Design**
    - [ ] Document the `users` schema (fields: `firstName`, `lastName`, `pixelCached`, `slackId`, `isAdmin`).
    - [ ] Document the `events` schema (fields: `name`, `date`, `type`, `pixels`, `attendees` array).
    - [ ] Document the `semesters` schema.
- [ ] **Security Rules**
    - [ ] Create `firestore.rules`.
    - [ ] Implement rule: `allow read: if request.auth != null;` (Basic start).
    - [ ] Implement rule: `allow write: if request.auth.token.isAdmin == true;` (Admin only).

## Phase 3: Authentication (Slack + Firebase)
- [ ] **Slack App Configuration**
    - [ ] Create Slack App in Slack API portal.
    - [ ] Enable OAuth & Permissions.
    - [ ] Add Redirect URI (e.g., `http://localhost:5001/.../authWithSlack`).
- [ ] **Cloud Function: `authWithSlack`**
    - [ ] Scaffold function in `functions/src/index.ts`.
    - [ ] Implement Slack OAuth exchange (code -> token).
    - [ ] Implement Firebase Custom Token creation.
    - [ ] Deploy function: `firebase deploy --only functions`.
- [ ] **Frontend Auth Integration**
    - [ ] Create `Login` component with "Sign in with Slack" button.
    - [ ] Handle redirect and token exchange.
    - [ ] Test login flow end-to-end.

## Phase 4: Backend Logic (Cloud Functions)
- [ ] **Trigger: `onEventUpdate`**
    - [ ] Create Firestore trigger `onWrite` for `events/{eventId}`.
    - [ ] Implement logic to calculate pixel differences.
    - [ ] Implement logic to update `users/{userId}` with new `pixelCached`.
- [ ] **Trigger: `onExcusedAbsenceUpdate`**
    - [ ] Create Firestore trigger for `excused_absences`.
    - [ ] Implement logic to adjust pixels on approval.
- [ ] **Testing**
    - [ ] Test adding an attendee to an event manually in Emulator.
    - [ ] Verify user's pixel count updates automatically.

## Phase 5: Data Migration
- [ ] **Export Script**
    - [ ] Create script `scripts/export_mongo.js`.
    - [ ] Connect to old MongoDB.
    - [ ] Export `members`, `events`, `semesters` to JSON.
- [ ] **Import Script**
    - [ ] Create script `scripts/import_firestore.js`.
    - [ ] Initialize Firebase Admin SDK.
    - [ ] Read JSON and batch write to Firestore.
- [ ] **Run Migration**
    - [ ] Run export.
    - [ ] Run import.
    - [ ] Verify data counts match.

## Phase 6: Frontend Implementation
- [ ] **Setup**
    - [ ] Install Firebase SDK in Next.js app.
    - [ ] Create `lib/firebase.ts` context/hook.
- [ ] **Pages & Components**
    - [ ] Build **Navbar** (Responsive).
    - [ ] Build **Dashboard** (Show current pixels).
    - [ ] Build **Leaderboard** (Table of users sorted by pixels).
    - [ ] Build **Admin Dashboard** (Protected route).
    - [ ] Build **Event Management** (Create/Edit forms).

## Phase 7: Deployment
- [ ] **Hosting**
    - [ ] Configure `firebase.json` for hosting.
    - [ ] Run `npm run build`.
    - [ ] Deploy: `firebase deploy --only hosting`.
- [ ] **Final Checks**
    - [ ] Verify Slack Login in production.
    - [ ] Verify Firestore Security Rules are enforced.
