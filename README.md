# UMD Pixel Redesign (Firebase + Next.js)

Modernized port of `umd-pixel-old` to a Firebase-based stack with a refreshed UI.

## Tech Stack
- Next.js (App Router), TypeScript
- Firebase Auth (Slack custom tokens), Firestore, Cloud Functions, Hosting
- Tailwind CSS + shadcn/ui (neutral theme)
- React Query for data, React Hook Form + Zod for admin forms

## What’s New vs Old
- Shadcn UI: responsive navbar, cards, tables, dialogs
- Admin dashboards:
  - Events: search/sort, bulk pixel set/delete, attendee add via ID/email/paste, excused approvals
  - Members: search/sort, bulk select/add/delete, add to event, edit profile, attendance toggles, pixel history chart, rank
  - Activities: coffee chats/bonding/other with multipliers per member
  - Settings: semester/leaderboard, grant admin; archive/reset guidance
- Member dashboard: pixels + delta, rank, pixel log, activities table, leaderboard toggle
- Functions: includes activities in pixel recalculation; Slack auth callable; triggers for events/excused/activities

## TODO / Next Steps
- Add event detail modal with per-attendee status controls
- Optional: automated CSV export/archive/reset flows (currently manual guidance)
- Optional: show names/emails in all multiplier/attendee listings via cached lookups
