/** Programme guide geometry: every service is a block from its start to now. */

const HOUR = 3600;
const STEPS = [1, 2, 3, 6, 12, 24, 48];

/** Hours shown by the guide: the review threshold plus a quarter of it. */
export function guideHours(reviewHours: number) {
  return Math.min(210, Math.max(2, Math.round(reviewHours * 1.25)));
}

/** Left edge of a service block, 0 (window start) to 1 (now). */
export function blockStart(elapsedSeconds: number, hours: number) {
  const start = 1 - elapsedSeconds / (hours * HOUR);
  return { start: Math.max(0, Math.min(1, start)), clipped: start < 0 };
}

/** Position of the review threshold on the guide. */
export function thresholdAt(reviewHours: number, hours: number) {
  return Math.max(0, 1 - reviewHours / hours);
}

/** Share of the review threshold already spent, for the simplified age meter. */
export function ageShare(elapsedSeconds: number, reviewHours: number) {
  return Math.min(1, elapsedSeconds / (reviewHours * HOUR));
}

/** Round local hours across the window, about five of them. */
export function guideTicks(now: number, hours: number) {
  const step = STEPS.find((s) => s >= hours / 6) ?? 48;
  const start = now - hours * HOUR * 1000;
  const first = new Date(start);
  first.setMinutes(0, 0, 0);
  const ticks: { at: number; x: number }[] = [];
  for (let at = first.getTime(); at < now; at += HOUR * 1000) {
    const date = new Date(at);
    if (at > start && date.getHours() % step === 0)
      ticks.push({ at, x: (at - start) / (now - start) });
  }
  return ticks;
}

/** "14:00" today, "Thu 14:00" another day. */
export function clockLabel(at: number, now: number, locale: string) {
  const date = new Date(at);
  const time = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return date.toDateString() === new Date(now).toDateString()
    ? time
    : `${date.toLocaleDateString(locale, { weekday: "short" })} ${time}`;
}
