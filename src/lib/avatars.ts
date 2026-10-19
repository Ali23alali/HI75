export const ORBIT_AVATARS = [
  "/avatars/a1.jpg",
  "/avatars/a2.jpg",
  "/avatars/a3.jpg",
  "/avatars/a4.jpg",
  "/avatars/a5.jpg",
  "/avatars/a6.jpg",
  "/avatars/a7.jpg",
  "/avatars/a8.jpg",
  "/avatars/a9.jpg",
  "/avatars/a10.jpg",
] as const;

/** Deterministic fallback avatar for users who haven't uploaded one. */
export function fallbackAvatar(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ORBIT_AVATARS[h % ORBIT_AVATARS.length];
}
