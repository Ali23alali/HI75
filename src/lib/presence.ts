/** Presence status — mirrors the `users.status` check constraint. */
export type PresenceStatus = "online" | "idle" | "dnd";

/** Display order used by the status picker. */
export const PRESENCE_ORDER: readonly PresenceStatus[] = ["online", "idle", "dnd"];

/** Narrow a DB value (plain `string`) to PresenceStatus, defaulting to `"online"`. */
export function toPresenceStatus(value: string | null | undefined): PresenceStatus {
  return value === "idle" || value === "dnd" ? value : "online";
}
