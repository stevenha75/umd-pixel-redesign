# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

UMD Pixel Redesign is a Firebase-based pixel tracking system for tracking member engagement through event attendance and activities. It features a Next.js frontend with admin dashboards and member views, Firebase Cloud Functions for Slack authentication and pixel recalculation, and Firestore for data persistence.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, React 19
- **Backend**: Firebase (Auth, Firestore, Cloud Functions, Hosting)
- **Styling**: Tailwind CSS 4 + shadcn/ui (neutral theme)
- **Data Fetching**: React Query (@tanstack/react-query)
- **Forms**: React Hook Form + Zod validation
- **Charts**: Chart.js + react-chartjs-2

## Development Commands

### Frontend (Next.js)
```bash
cd umd-pixel-redesign
npm run dev        # Start Next.js dev server
npm run build      # Build for production
npm run lint       # Run ESLint
```

### Firebase Functions
```bash
cd umd-pixel-redesign/functions
npm run build      # Compile TypeScript
npm run build:watch # Watch mode for development
npm run serve      # Build and start Firebase emulators
npm run deploy     # Deploy functions to Firebase
npm run logs       # View Firebase function logs
```

### Firebase Emulators
```bash
firebase emulators:start  # Start all emulators (Auth: 9099, Functions: 5001, Firestore: 8080)
```

## Architecture

### Authentication Flow

The app uses **Slack OAuth** for authentication with Firebase custom tokens:

1. User clicks "Sign in with Slack" → redirects to Slack OAuth
2. Slack redirects back with code → `/auth/callback` page receives it
3. Frontend calls Cloud Function `authWithSlack` with code
4. Function exchanges code for Slack token, fetches user info, creates/updates Firestore user doc
5. Function generates Firebase custom token with `isAdmin` claim
6. Frontend signs in with custom token → `AuthContext` provides user state

**Key files**:
- `functions/src/index.ts`: `authWithSlack` callable function
- `src/app/login/page.tsx`: Slack OAuth initiation
- `src/app/auth/callback/page.tsx`: OAuth callback handler
- `src/context/AuthContext.tsx`: Auth state management

### Data Model

**Firestore Collections**:

- `users/{userId}`: Member profiles with `firstName`, `lastName`, `email`, `isAdmin`, `pixelCached`, `pixelDelta`
- `events/{eventId}`: Events with `name`, `date`, `type`, `pixels`, `attendees[]`, `semesterId`
- `events/{eventId}/excused_absences/{absenceId}`: Excused absence requests (subcollection)
- `activities/{activityId}`: Activities with `name`, `type`, `pixels`, `semesterId`, `multipliers{}`
- `settings/global`: Global settings including `currentSemesterId`, `isLeadershipOn`

**Pixel Calculation**:

Pixels are auto-recalculated via Cloud Function triggers (`onEventUpdate`, `onExcusedAbsenceUpdate`, `onActivityUpdate`) when:
- Event attendees or pixels change
- Excused absence status changes to "approved"
- Activity multipliers or pixels change

Formula: `totalPixels = pixelDelta + eventPixels + activityPixels`
- `pixelDelta`: Manual adjustments (can be negative)
- `eventPixels`: Sum of pixels from attended events (excused absences don't earn pixels)
- `activityPixels`: Sum of `activity.pixels * multiplier` for each activity

**Key files**:
- `functions/src/index.ts`: `recalculateUserPixels()` and triggers
- `src/lib/dashboard.ts`: `fetchDashboardData()` for member view
- `src/lib/api.ts`: All Firestore CRUD operations

### Page Structure

**Member Routes** (requires auth):
- `/` - Member dashboard: pixel summary, rank, pixel log, activities, leaderboard

**Admin Routes** (requires `isAdmin` claim):
- `/admin` - Events management (search/sort, bulk actions, attendee management, excused approvals)
- `/admin/members` - Members management (add/edit/delete, bulk operations, pixel history chart)
- `/admin/activities` - Activities management (coffee chats/bonding/other with multipliers)
- `/admin/settings` - Semester/leaderboard settings, admin grants, archive/reset guidance

**Public Routes**:
- `/login` - Slack OAuth login

### Component Organization

- `src/components/ui/`: shadcn/ui components (Button, Card, Table, Dialog, etc.)
- `src/components/admin/`: Admin-specific components (AdminLayout)
- `src/components/dashboard/`: Member dashboard components (PixelSummary, PixelLogTable, Leaderboard, ActivitiesTable)
- `src/components/export/`: CSV export functionality
- `src/components/`: Shared components (Navbar, ProtectedRoute)

### State Management

- **React Query**: Server state caching and mutations for all Firestore operations
- **AuthContext**: Global auth state (user, isAdmin, loading)
- **React Hook Form**: Local form state for admin forms

### Key Utilities

- `src/lib/firebase.ts`: Firebase SDK initialization (app, auth, db, functions)
- `src/lib/api.ts`: All Firestore API functions (events, members, activities, excused absences)
- `src/lib/dashboard.ts`: Member dashboard data fetching
- `src/lib/utils.ts`: Utility functions (tailwind `cn()`)

## Important Implementation Details

### Email Lookups

The app supports adding attendees/multipliers by email. Email lookups are case-insensitive (emails stored as lowercase):
- `addAttendeesByEmail()`: Batch add attendees by email array
- `findUserIdByEmail()`: Single email lookup
- `fetchUserDetails()`: Batch user detail lookups by ID array

### Bulk Operations

Admin pages support bulk operations (select multiple rows → apply action):
- Events: Set pixels, delete events, add/remove attendees
- Members: Add to event, delete members
- Activities: Set multipliers

### Event Types

Events have types that determine attendance requirements:
- `"GBM"` and `"other_mandatory"`: Required events (no-shows marked as "Unexcused")
- Other types: Optional events (no-shows marked as "No Show")

### Attendance States

- `"Attended"`: User in `attendees[]` array, earns pixels
- `"Excused"`: Approved excused absence, no pixels but attendance credit
- `"Unexcused"`: No-show for required event
- `"No Show"`: No-show for optional event

### CSV Export

The app includes CSV export for events, members, and activities (see `src/components/export/CsvExportButton.tsx`).

## Firestore Security

Firestore rules (in `firestore.rules`) enforce:
- Members can read their own user doc
- Admins can read/write all docs
- Unauthenticated users have no access

## Development Notes

- Working directory is `umd-pixel-redesign/` (not root)
- Firebase config is in `firebase.json` with emulator ports defined
- The codebase uses TypeScript strict mode
- All admin forms use Zod schemas for validation
- The app uses shadcn/ui with Tailwind CSS 4 (new CSS-first config)
