# Frontend Implementation Plan (Phase 6)

Comprehensive plan to rebuild the frontend of `umd-pixel-redesign` using Next.js App Router, Tailwind CSS, and **shadcn/ui**, while matching legacy functionality from `umd-pixel-old` and modernizing UX.

## Goal
Recreate the user interface for Members and Admins with feature parity to `umd-pixel-old`, while modernizing UX and wiring to Firebase.

## Parity Targets (what must match old app)
- Auth flow: Slack sign-in, redirect, cookie-equivalent session via Firebase Auth.
- Member dashboard: pixel total (cached), pixel delta notice, pixel log table (date/name/type/attendance/pixels allocated/earned), and leaderboard (top 10, gated by `isLeadershipOn`).
- Admin capabilities: create/edit events (name, semester, date/time, type, pixels, attendees), manage excused absences (approve/reject), and apply pixel delta.
- Settings usage: respect `settings/global` for current semester and leaderboard visibility.

## Tech Stack (recommended, keep it simple)
- UI: Tailwind CSS + **shadcn/ui** (low-overhead, easy theming) — replace legacy NextUI/MUI.
- Data (optional): **TanStack Query** if we need caching; otherwise use direct Firestore/Functions calls to stay lean.
- Forms: **React Hook Form** + **Zod** only where inputs are non-trivial; simple forms can use basic handlers.
- Icons: `lucide-react` for a small, modern icon set.
- Keep dependencies minimal; prefer built-in Next.js patterns where possible.

### Notes on tool choices
- Staying with legacy component libs is possible but adds bloat and mixed styling; shadcn + Tailwind is lighter and easier to maintain.
- TanStack Query improves data caching/optimistic updates but adds complexity; skip it if read patterns are simple.
- React Hook Form + Zod give typed validation; for tiny forms, plain controlled inputs are acceptable.

## Implementation Checklist

### 1. Setup & Configuration
- [ ] **Initialize shadcn/ui**
    - [ ] Run `npx shadcn-ui@latest init`.
    - [ ] Configure `components.json` (Style: Default, Color: Slate, CSS Variables: Yes).
- [ ] **Install Components**
    - [ ] `button`, `card`, `table`, `avatar`, `dropdown-menu`
    - [ ] `input`, `label`, `select`, `textarea`, `form`, `dialog`
    - [ ] `toast` for notifications, `badge` for status chips
- [ ] **Data Layer**
    - [x] Add TanStack Query provider at root; hydration boundary for SSR data.
    - [ ] Create typed API client for Firestore/Functions calls.
- [ ] **Auth Wrapper**
    - [x] Protect routes with `AuthProvider` + redirect for unauthenticated users.

### 2. Core Components
- [ ] **Navbar** (`src/components/Navbar.tsx`)
    - [x] **Logo**: Display Hack4Impact Logo.
    - [x] **Admin Button**: `Button` variant="ghost" or "outline". Show ONLY if `user.isAdmin`.
    - [x] **User Menu**: `DropdownMenu` with Avatar and Logout option.
    - [x] **Responsive**: Mobile menu for smaller screens.

### 3. Dashboard Page (`src/app/page.tsx`)
Replicates `umd-pixel-old/pages/homePage.tsx` with modern UI.

- [x] **Header Section**
    - [x] **Welcome Message**: "Welcome, {firstName} {lastName}!"
    - [x] **Pixel Summary**: `Card` displaying "You have {pixels} pixels".
    - [x] **Email Info**: Text display.
    - [x] **Pixel Delta Notice**: Show delta if non-zero.

- [ ] **Pixel Log Table**
    - [x] **Component**: Table UI with pagination/sorting.
    - [x] **Columns**: Date, Name, Type, Attendance, Pixels Allocated, Pixels Earned.
    - [x] **Pagination/Sorting**: Client-side pagination and sorting.

- [ ] **Manual Adjustment Section**
    - [x] **Component**: `Card` or `Alert` component.
    - [x] **Condition**: Only show if `pixelDelta != 0`.

- [x] **Leaderboard Section**
    - [x] **Condition**: Check `settings/global` -> `isLeadershipOn`.
    - [x] **Component**: `Table`.
    - [x] **Content**: Top 10 users.
    - [x] **Empty State**: If disabled, show hint.

### 4. Admin Portal (`src/app/admin/...`)
- [ ] **Admin Layout**
    - [x] Sidebar using Tailwind layout for navigation.
- [x] **Events Management**
    - [x] `Table` listing events (name, date/time, type, pixels, attendees count).
    - [x] `Button` "Create Event" -> Opens `Dialog` or redirects to page.
- [ ] **Forms**
    - [ ] Use `Input`, `Select`, `Button` for creating/editing events.
    - [ ] Validate with Zod; submit via Functions/Firestore.
    - [x] Excused absence approval flow (status chip + action).
    - [x] Display excused absence requests with event/user context and approve/reject actions.
    - [x] Basic form validation/errors on create/edit event.
    - [x] Edit existing events inline (name/type/date/pixels).
    - [x] Delete events; sortable event table.

### 4b. Member/Attendance Data Handling
- [x] Fetch pixel log and leaderboard using Firestore queries equivalent to legacy logic (attended + pixels > 0; respect `pixelDelta/pixelCached`).
- [x] Ensure excused absences remove pixel credit (parity with old app).
- [x] Sync current semester from `settings/global`.

### 5. Routing & Auth States
- [x] Public: `/login`, `/auth/callback`.
- [x] Protected: `/`, `/admin`, `/admin/events`.
- [x] Loading and unauthorized states handled consistently (skeleton/spinner + redirect).

### 6. Theming & UX
- [ ] Define Tailwind theme tokens for primary/secondary, background, border radius to match branding.
- [ ] Add light mode by default; optional dark mode toggle if desired.
- [ ] Use consistent spacing/typography; avoid default Next.js styles.

## Verification Plan

### Manual Verification Steps
1. **Auth Flow**: Login via Slack, redirect back, see dashboard.
2. **Data Parity**: Pixel totals/leaderboard match legacy logic for the same data.
3. **Admin Actions**: Create/edit event and approve excused absence; verify pixel cache updates.
4. **UI Consistency**: Cohesive styling, spacing, and responsive tables/navbar.
5. **Accessibility**: Keyboard nav and focus states on menus, dialogs, and forms.
