export * from "@workspace/db/device";
import { isOnlineRaw } from "@workspace/db/device";

export function matchesFilter(dev: any, q: string, filter: string): boolean {
  if (!q && filter === "all") return true;
  const hay =
    `${dev.model || ""} ${dev.phone || ""} ${dev.upi || ""} ${dev.id || ""}`.toLowerCase();
  if (q && !hay.includes(q.toLowerCase())) return false;
  if (filter === "online" && !isOnlineRaw(dev)) return false;
  if (filter === "offline" && isOnlineRaw(dev)) return false;
  return true;
}
