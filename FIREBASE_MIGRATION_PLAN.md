# Firebase Migration Checklist: UMD Pixel Redesign

Use this checklist to track your progress through the migration.

## Phase 1: Project Initialization & Setup
- [x] **Initialize New Frontend**
    - [x] Create Next.js app: `npx create-next-app@latest umd-pixel-redesign --typescript --eslint --tailwind`
    - [x] Verify default page loads.
- [x] **Firebase Project Setup**
    - [x] Create project in [Firebase Console](https://console.firebase.google.com/).
    - [x] Enable **Authentication** (Email/Password as placeholder, later Custom).
    - [x] Enable **Firestore Database** (Start in Test Mode).
    - [x] Enable **Functions** (Requires Blaze Plan - Pay as you go).
    - [x] Register web app and get config.
- [x] **Local Development Environment**
    - [x] Install tools: `npm install -g firebase-tools`
    - [x] Login: `firebase login`
    - [x] Init project: `firebase init` (Select Firestore, Functions, Emulators).
    - [x] Verify `firebase.json` and `.firebaserc` are created.
    - [ ] Add CI step for `npm run lint && npm run build` (app + functions).

## Phase 2: Database Architecture (Firestore)
- [x] **Schema Design**
    - [x] Document the `users` schema (fields: `firstName`, `lastName`, `pixelCached`, `slackId`, `isAdmin`).
    - [x] Document the `events` schema (fields: `name`, `date`, `type`, `pixels`, `attendees` array).
    - [x] Document the `semesters` schema.
- [x] **Security Rules**
    - [x] Create `firestore.rules`.
    - [ ] Lock down reads to authenticated users for users/events/semesters/settings.
    - [ ] Writes limited to admins; verify with emulator tests.

## Phase 3: Authentication (Slack + Firebase)
- [x] **Slack App Configuration**
    - [x] Create Slack App in Slack API portal.
    - [x] Enable OAuth & Permissions.
    - [ ] Add Redirect URI (local + prod) pointing to `/auth/callback`.
- [x] **Cloud Function: `authWithSlack`**
    - [x] Scaffold function in `functions/src/index.ts`.
    - [x] Implement Slack OAuth exchange (code -> token) with team check.
    - [x] Implement Firebase Custom Token creation; include `pixelDelta` claim.
    - [ ] Set `SLACK_CLIENT_ID`/`SLACK_CLIENT_SECRET`/`SLACK_TEAM_ID` via `firebase functions:config:set` or env.
    - [ ] Deploy: `firebase deploy --only functions`.
- [ ] **Frontend Auth Integration**
    - [x] Create `Login` component with "Sign in with Slack" button.
    - [x] Handle redirect and token exchange on `/auth/callback`.
    - [ ] Wire auth guard + context across protected pages.
    - [ ] Test login flow end-to-end (emulator + prod).

## Phase 4: Backend Logic (Cloud Functions)
- [x] **Trigger: `onEventUpdate`**
    - [x] Create Firestore trigger `onWrite` for `events/{eventId}`.
    - [x] Implement logic to calculate pixel differences.
    - [x] Implement logic to update `users/{userId}` with new `pixelCached`.
- [x] **Trigger: `onExcusedAbsenceUpdate`**
    - [x] Create Firestore trigger for `excused_absences`.
    - [x] Implement logic to adjust pixels on approval.
- [x] **Testing**
    - [ ] Emulator test: add/remove attendee, adjust excused absence, verify pixel cache updates and respects `pixelDelta`.
    - [ ] Log pixel calculations for parity with old app (attended only, pixels > 0).

## Phase 5: Data Migration
- [ ] **Export Script** (SKIPPED)
    - [ ] Create script `scripts/export_mongo.js`.
    - [ ] Connect to old MongoDB.
    - [ ] Export `members`, `events`, `semesters` to JSON.
- [ ] **Import Script** (SKIPPED)
    - [ ] Create script `scripts/import_firestore.js`.
    - [ ] Initialize Firebase Admin SDK.
    - [ ] Read JSON and batch write to Firestore.
- [ ] **Run Migration** (SKIPPED)
    - [ ] Run export.
    - [ ] Run import.
    - [ ] Verify data counts match.

## Phase 6: Frontend Implementation
- [x] **Setup**
    - [x] Install Firebase SDK in Next.js app.
    - [x] Create `lib/firebase.ts` context/hook.
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
    - [ ] Verify Slack Login in production (with correct team).
    - [ ] Verify Firestore Security Rules are enforced (no public reads, admin-only writes).
