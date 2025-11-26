# UMD Pixel Redesign (Firebase + Next.js)

Modernized port of `umd-pixel-old` to a Firebase-based stack with a refreshed UI.

## Tech Stack
- Next.js (App Router), TypeScript
- Firebase Auth (Slack custom tokens), Firestore, Cloud Functions, Hosting
- Tailwind CSS + shadcn/ui (neutral theme)
- React Query for data, React Hook Form + Zod for admin forms

## Development
- Install: `npm install`
- Run dev: `npm run dev` (http://localhost:3000)
- Lint: `npm run lint`
- Functions: `npm install --prefix functions` then `npm run build --prefix functions`

## What’s New vs Old
- Shadcn UI: responsive navbar, cards, tables, dialogs
- Admin dashboards:
  - Events: search/sort, bulk pixel set/delete, attendee add via ID/email/paste, excused approvals
  - Members: search/sort, bulk select/add/delete, add to event, attendance toggles, pixel history chart, rank, per-semester pixel adjustment
  - Activities: coffee chats/bonding/other with multipliers per member
  - Settings: semester/leaderboard, grant admin; archive/reset guidance
- Member dashboard: pixels + delta, rank, pixel log, activities table, leaderboard toggle
- Functions: includes activities in pixel recalculation; Slack auth callable; triggers for events/excused/activities

## Admin Notes
- Set `currentSemesterId` in Admin Settings; pixels, events, activities, and adjustments scope to that semester.
- Recalculate all scores after changing semesters to reset totals.
- Add members via Slack picker (no manual add).
- Pixel adjustments are per-semester; saving triggers a single-user recalc.
- Events start with no attendees; add via Members page or Manage attendees on events.
- Excused requests are semester-scoped; approve/reject in Admin Dashboard.

## TODO / Next Steps
- Add event detail modal with per-attendee status controls.
- Optional: show names/emails in all multiplier/attendee listings via cached lookups.
- Add `semesterId` to `excused_absences` docs and query with `where("semesterId", "==", currentSemesterId)` to avoid cross-semester scans.
