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
  pixelDelta?: number; // Canonical field
  pixeldelta?: number; // Legacy casing
  pixels?: number; // Legacy field name
  pixelCached?: number; // Cached total
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

export interface SlackUser {
  id: string;
  name: string;
  real_name: string;
  email: string;
  image_original?: string;
}
