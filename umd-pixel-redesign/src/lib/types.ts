import { Timestamp } from "firebase/firestore";

/**
 * Firestore document schemas
 *
 * These interfaces represent the raw document structure in Firestore.
 * Fields are optional where the database might have legacy/missing data.
 * Use Partial<T> when reading potentially incomplete documents.
 */

export interface EventDocument {
  name: string;
  date: Timestamp;
  type: string;
  pixels: number;
  attendees?: string[];
  semesterId?: string;
}

export interface UserDocument {
  firstName: string;
  lastName: string;
  email: string;
  slackId?: string;
  slackEmail?: string; // Legacy field
  isAdmin?: boolean;
  pixels?: number; // Legacy field name
  pixelDelta?: number;
  pixelCached?: number;
  createdAt?: Timestamp;
  lastLogin?: Timestamp;
}

export interface ActivityDocument {
  name: string;
  type: string;
  pixels: number;
  semesterId?: string;
  multipliers?: Record<string, number>;
  createdAt?: Timestamp;
}

export interface ExcusedAbsenceDocument {
  userId: string;
  reason: string;
  status: string;
  createdAt?: Timestamp;
}

export interface SettingsDocument {
  currentSemesterId?: string;
  isLeadershipOn?: boolean;
}

export interface SemesterDocument {
  name: string;
  startDate: Timestamp;
  endDate: Timestamp;
  active: boolean;
}
