// Matching identifies the same page/episode/version, never only the same title.
export async function mediaIdentity(player) {
  if (!Number.isFinite(player.duration) || player.duration < 60) return null;
  let url;
  try { url = new URL(player.pageUrl); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  const query = [...url.searchParams].filter(([key]) => !/^(utm_.*|fbclid|gclid|token|access_token|auth|signature|expires|key)$/i.test(key)).sort(([a], [b]) => a.localeCompare(b));
  const canonical = JSON.stringify([url.hostname.replace(/^www\./, ''), url.pathname, query, url.hash,
    (player.pageTitle ?? '').trim(), Math.round(player.duration)]);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return `auto:${[...new Uint8Array(hash)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
export function choosePlayer(players) {
  const usable = players.filter(p => p.visible && p.ready >= 1 && Number.isFinite(p.duration) && p.duration >= 60).sort((a, b) => b.area - a.area);
  return usable.length === 1 || (usable.length > 1 && usable[0].area > usable[1].area * 1.8) ? usable[0] : null;
}
