// Simple per-user rate limiter backed by a module-level Map.
// Works on Railway (single persistent process). Not suitable for horizontally-scaled deployments —
// use Redis or a DB timestamp check there instead.
const lastCall = new Map<string, number>()

// Returns true (allowed) if the user hasn't hit the endpoint within minIntervalMs.
// Side-effects: updates the timestamp when allowing.
export function rateLimit(userId: string, route: string, minIntervalMs: number): boolean {
  const key = `${userId}:${route}`
  const now = Date.now()
  const last = lastCall.get(key) ?? 0
  if (now - last < minIntervalMs) return false
  lastCall.set(key, now)
  return true
}
