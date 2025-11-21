# Frontend Implementation Plan (Phase 6)

This plan outlines the steps to rebuild the frontend of `umd-pixel-redesign` using Next.js 14+ (App Router), Tailwind CSS, and **shadcn/ui**. It is designed to ensure **strict alignment** with the legacy `umd-pixel-old` application while using modern components.

## Goal
Recreate the user interface for Members and Admins with feature parity, connecting to the new Firebase backend.

## User Review Required
> [!IMPORTANT]
> I will be using **shadcn/ui** for components. This requires running `npx shadcn-ui@latest init` and adding specific components.

## Implementation Checklist

### 1. Setup & Configuration
- [ ] **Initialize shadcn/ui**
    - [ ] Run `npx shadcn-ui@latest init`.
    - [ ] Configure `components.json` (Style: Default, Color: Slate, CSS Variables: Yes).
- [ ] **Install Components**
    - [ ] `button` (for Navbar, Actions)
    - [ ] `table` (for Pixel Log, Leaderboard)
    - [ ] `card` (for Dashboard sections)
    - [ ] `avatar` (for User Profile)
    - [ ] `dropdown-menu` (for User Menu)
    - [ ] `input`, `label`, `select` (for Admin Forms)
    - [ ] `toast` (for notifications)

### 2. Core Components
- [ ] **Navbar** (`src/components/Navbar.tsx`)
    - [ ] **Logo**: Display Hack4Impact Logo.
    - [ ] **Admin Button**: `Button` variant="ghost" or "outline". Show ONLY if `user.isAdmin`.
    - [ ] **User Menu**: `DropdownMenu` with Avatar and Logout option.
    - [ ] **Responsive**: Mobile menu for smaller screens.

### 3. Dashboard Page (`src/app/page.tsx`)
Replicates `umd-pixel-old/pages/homePage.tsx`.

- [ ] **Header Section**
    - [ ] **Welcome Message**: "Welcome, {firstName} {lastName}!"
    - [ ] **Pixel Summary**: `Card` displaying "You have {pixels} pixels".
    - [ ] **Email Info**: Text display.

- [ ] **Pixel Log Table**
    - [ ] **Component**: `Table` from shadcn/ui.
    - [ ] **Columns**: Date, Name, Type, Attendance, Pixels Allocated, Pixels Earned.
    - [ ] **Pagination**: Implement simple pagination controls.

- [ ] **Manual Adjustment Section**
    - [ ] **Component**: `Card` or `Alert` component.
    - [ ] **Condition**: Only show if `pixelDelta != 0`.

- [ ] **Leaderboard Section**
    - [ ] **Condition**: Check `settings/global` -> `isLeadershipOn`.
    - [ ] **Component**: `Table`.
    - [ ] **Content**: Top 10 users.

### 4. Admin Portal (`src/app/admin/...`)
- [ ] **Admin Layout**
    - [ ] Sidebar using `Button` variants for navigation.
- [ ] **Events Management**
    - [ ] `Table` listing events.
    - [ ] `Button` "Create Event" -> Opens `Dialog` or redirects to page.
- [ ] **Forms**
    - [ ] Use `Input`, `Select`, `Button` for creating/editing events.

## Verification Plan

### Manual Verification Steps
1.  **UI Consistency**: Verify shadcn components look cohesive.
2.  **Functionality**: Test all interactive elements (buttons, dropdowns, inputs).
3.  **Responsiveness**: Ensure tables and navbar adapt to mobile.
