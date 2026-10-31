export const VERSION = 1;
export const MAX_MESSAGE_BYTES = 32 * 1024;
export const ACTIONS = new Set(['sync', 'play', 'pause', 'seek', 'wait', 'ready']);
export const DEFAULT_CONTEXT = 'Current content';

export function finite(value, min = -172800, max = 172800) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function validId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

export function validRoomId(value) {
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
}

export function validateEvent(event) {
  if (!event || event.v !== VERSION || !validId(event.id) || !validId(event.session) ||
      !validRoomId(event.room) || !/^[a-f0-9]{64}$/.test(event.sender) ||
      !Number.isSafeInteger(event.seq) || event.seq < 1 ||
      !ACTIONS.has(event.action) || typeof event.context !== 'string' ||
      !event.context.trim() || event.context.length > 120 ||
      !finite(event.position) || typeof event.paused !== 'boolean') {
    throw new Error('Invalid synchronization message');
  }
  return event;
}

export function targetTime(position, anchor, duration = Infinity) {
  if (!finite(position) || !finite(anchor, 0)) throw new Error('Invalid anchor or position');
  const target = position + anchor;
  // Clamping would silently align different scenes. Ask for a new anchor instead.
  if (target < 0 || (Number.isFinite(duration) && target > duration)) {
    throw new Error('Target position is out of range for this video. Re-align the anchors');
  }
  return target;
}

export class EventGate {
  constructor() { this.sequences = new Map(); this.ids = new Set(); }
  accept(event) {
    validateEvent(event);
    const key = `${event.sender}:${event.session}`;
    if (this.ids.has(event.id) || event.seq <= (this.sequences.get(key) ?? 0)) return false;
    this.ids.add(event.id);
    this.sequences.set(key, event.seq);
    if (this.ids.size > 2048) this.ids.delete(this.ids.values().next().value);
    if (this.sequences.size > 512) this.sequences.delete(this.sequences.keys().next().value);
    return true;
  }
}

export function makeInvite(data) {
  validateInvite(data);
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `salticus://join/${btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}`;
}

export function parseInvite(text) {
  const prefix = 'salticus://join/';
  if (typeof text !== 'string' || text.length > 8192 || !text.trim().startsWith(prefix)) throw new Error('Invalid Salticus invitation');
  try {
    const encoded = text.trim().slice(prefix.length).replaceAll('-', '+').replaceAll('_', '/');
    const json = new TextDecoder().decode(Uint8Array.from(atob(encoded), c => c.charCodeAt(0)));
    return validateInvite(JSON.parse(json));
  } catch { throw new Error('Invitation is invalid or its version is unsupported'); }
}

export function validateEndpoint(endpoint) {
  return endpoint && typeof endpoint.host === 'string' && endpoint.host.length <= 253 &&
    /^[a-zA-Z0-9.:%_-]+$/.test(endpoint.host) && Number.isInteger(endpoint.port) && endpoint.port > 0 && endpoint.port <= 65535;
}

export function validateInvite(data) {
  if (!data || data.v !== VERSION || !validRoomId(data.room) || typeof data.name !== 'string' ||
      !data.name.trim() || data.name.length > 60 || !/^[a-f0-9]{64}$/.test(data.peer) ||
      !Array.isArray(data.endpoints) || data.endpoints.length > 16 ||
      !data.endpoints.every(validateEndpoint)) throw new Error('Invalid invitation format');
  return data;
}
