/**
 * Task surface for the SVG badge change — `# Spec: badgeSvg`.
 *
 * Re-export of the honest badge renderer so the capability is reachable from
 * the drift check regardless of how shield scans exports. No logic lives here.
 */
export {
  readReceipt,
  deriveBadgeStatus,
  fallbackStatus,
  renderBadgeSvg,
  renderBadgeMarkdown,
  writeBadge,
} from "../skills/out/badge.js";
export type { BadgeStatus, BadgeResult } from "../skills/out/badge.js";
