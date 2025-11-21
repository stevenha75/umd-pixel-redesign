# Firestore Schema Documentation

## Collections

### `users`
Represents a member of the organization.
- **Document ID**: Slack User ID (preferred) or Auto-generated UUID.
- **Fields**:
  - `firstName` (string): First name.
  - `lastName` (string): Last name.
  - `email` (string): Email address (from Slack).
  - `slackId` (string): Slack User ID.
  - `isAdmin` (boolean): Administrative privileges.
  - `pixels` (number): Current calculated pixel total (cached).
  - `pixelDelta` (number): Manual adjustment to pixel count.

### `events`
Represents a club event or activity.
- **Document ID**: Auto-generated UUID.
- **Fields**:
  - `name` (string): Event name.
  - `semesterId` (string): Reference to `semesters` document.
  - `date` (timestamp): Date and time of the event.
  - `pixels` (number): Base pixel value for attendance.
  - `type` (string): Event type. Options:
    - `GBM`
    - `other_mandatory`
    - `sponsor_event`
    - `other_prof_dev`
    - `social`
    - `other_optional`
    - `pixel_activity`
    - `special`
  - `attendees` (array<string>): List of User IDs who attended.

### `events/{eventId}/excused_absences` (Subcollection)
Represents a request for an excused absence for a specific event.
- **Document ID**: Auto-generated UUID.
- **Fields**:
  - `userId` (string): Reference to `users` document.
  - `reason` (string): Reason for absence.
  - `status` (string): 'pending' | 'approved' | 'rejected' (Maps to `isApproved`: "Yes"/"No").

### `semesters`
Represents an academic semester.
- **Document ID**: Auto-generated UUID.
- **Fields**:
  - `name` (string): Semester name (e.g., "Fall 2023").
  - `startDate` (timestamp): Start date.
  - `endDate` (timestamp): End date.
  - `active` (boolean): Whether this is the current semester.

### `settings`
Global application settings.
- **Document ID**: `global`
- **Fields**:
  - `currentSemesterId` (string): Reference to the active `semesters` document.
  - `isLeadershipOn` (boolean): Visibility of leaderboard.
