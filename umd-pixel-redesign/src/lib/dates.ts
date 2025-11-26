type FirestoreDate = {
  toDate?: () => Date;
};

/**
 * Normalizes Firestore Timestamp/Date/string/number into a Date instance.
 */
export function toDate(val: unknown): Date {
  if (
    typeof val === "object" &&
    val !== null &&
    "toDate" in val &&
    typeof (val as FirestoreDate).toDate === "function"
  ) {
    return (val as FirestoreDate).toDate?.() ?? new Date();
  }
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  return new Date();
}
