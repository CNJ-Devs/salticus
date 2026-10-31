import tls from 'node:tls';
import http from 'node:http';
import os from 'node:os';
import { randomUUID, timingSafeEqual, X509Certificate } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { Bonjour } from 'bonjour-service';
import { loadIdentity, loadConfig, saveConfig, fingerprint } from './identity.mjs';
import { EventGate, VERSION, MAX_MESSAGE_BYTES, validateEvent, validId, validRoomId, finite,
  makeInvite, parseInvite, validateEndpoint } from '../shared/protocol.mjs';

function matchesSecret(value, secret) {
  if (typeof value !== 'string') return false;
  const a = Buffer.from(value), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

function text(value, max = 60) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error('Enter a valid name');
  return value.trim();
}

export class Companion {
  constructor(options) {
    this.options = { apiPort: 37842, peerPort: 37843, peerHost: '::', discovery: true, advertise: [], ...options };
    this.peers = new Map(); this.pending = new Map(); this.discovered = new Map();
    this.sockets = new Set(); this.connecting = new Set(); this.waiting = new Map();
    this.session = randomUUID(); this.sequence = 0; this.gate = new EventGate();
    this.saveQueue = Promise.resolve(); this.stopped = false;
  }

  async start() {
    this.identity = await loadIdentity(this.options.directory);
    this.config = await loadConfig(this.options.directory, this.options.name);
    if (this.config.version !== 1 || !/^[a-f0-9]{64}$/.test(this.config.token) || !this.config.rooms || !this.config.contacts) throw new Error('Unsupported configuration');
    if (this.options.name) { this.config.name = text(this.options.name); await this.persist(); }
    try {
      this.peerServer = tls.createServer({ key: this.identity.key, cert: this.identity.cert,
        requestCert: true, rejectUnauthorized: false, minVersion: 'TLSv1.3', handshakeTimeout: 8000 }, socket => this.attachPeer(socket));
      this.peerServer.maxConnections = 64;
      this.peerServer.on('tlsClientError', () => {});
      await this.listen(this.peerServer, this.options.peerPort, this.options.peerHost);
      this.peerPort = this.peerServer.address().port;
      this.httpServer = http.createServer((req, res) => { res.writeHead(404); res.end('Salticus local companion'); });
      this.wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES, handleProtocols: () => 'salticus' });
      this.httpServer.on('upgrade', (req, socket, head) => {
        const protocols = (req.headers['sec-websocket-protocol'] ?? '').split(',').map(s => s.trim());
        const origin = req.headers.origin;
        if (req.url !== '/extension' || (origin && !/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) ||
            !protocols.includes('salticus') || !protocols.some(p => matchesSecret(p, this.config.token))) {
          socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
        }
        this.wss.handleUpgrade(req, socket, head, ws => this.attachExtension(ws));
      });
      await this.listen(this.httpServer, this.options.apiPort, '127.0.0.1');
      this.apiPort = this.httpServer.address().port;
      this.retryTimer = setInterval(() => this.connectKnown(), 4000);
      this.retryTimer.unref();
      if (this.options.discovery) this.startDiscovery();
      this.connectKnown();
      return this;
    } catch (error) { await this.stop(); throw error; }
  }

  async listen(server, port, host) {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => { server.removeListener('error', reject); resolve(); });
    });
    server.on('error', error => { this.lastError = `Connection listener failed: ${error.code ?? 'unknown'}`; this.publish(); });
  }

  persist() {
    const snapshot = structuredClone(this.config);
    const write = this.saveQueue.then(() => saveConfig(this.options.directory, snapshot));
    this.saveQueue = write.catch(() => {});
    return write;
  }

  endpoints() {
    const hosts = new Set(this.options.advertise);
    for (const entries of Object.values(os.networkInterfaces())) {
      for (const entry of entries ?? []) {
        if (!entry.internal && !(entry.family === 'IPv6' && /^fe80:/i.test(entry.address))) hosts.add(entry.address);
      }
    }
    return [...hosts].slice(0, 16).map(host => ({ host, port: this.peerPort })).filter(validateEndpoint);
  }

  startDiscovery() {
    try {
      this.bonjour = new Bonjour({}, () => { this.discoveryUnavailable = true; this.publish(); });
      this.advertisement = this.bonjour.publish({ name: `Salticus-${this.identity.id.slice(0, 12)}`, type: 'salticus', port: this.peerPort,
        txt: { id: this.identity.id, v: '1' } });
      this.advertisement.on('error', () => { this.discoveryUnavailable = true; this.publish(); });
      this.browser = this.bonjour.find({ type: 'salticus' }, service => {
        const id = service.txt?.id;
        if (!this.config.contacts[id] || id === this.identity.id) return;
        this.discovered.set(id, (service.addresses ?? []).map(host => ({ host, port: service.port })).filter(validateEndpoint).slice(0, 16));
        this.connectKnown();
      });
      this.browser.on('error', () => { this.discoveryUnavailable = true; this.publish(); });
    } catch { this.discoveryUnavailable = true; }
  }

  connectKnown() {
    if (this.stopped) return;
    for (const [id, contact] of Object.entries(this.config.contacts)) {
      if (this.peers.has(id) || !contact.rooms.some(room => this.config.rooms[room])) continue;
      const endpoints = [...(this.discovered.get(id) ?? []), ...(contact.endpoints ?? [])];
      const unique = new Map(endpoints.filter(validateEndpoint).map(e => [`${e.host}:${e.port}`, e]));
      for (const endpoint of [...unique.values()].slice(0, 16)) this.dial(id, endpoint);
    }
  }

  dial(id, endpoint) {
    const attempt = `${id}:${endpoint.host}:${endpoint.port}`;
    if (this.connecting.has(attempt) || this.peers.has(id) || this.stopped) return;
    this.connecting.add(attempt);
    const socket = tls.connect({ host: endpoint.host, port: endpoint.port,
      key: this.identity.key, cert: this.identity.cert, rejectUnauthorized: false, minVersion: 'TLSv1.3' });
    this.sockets.add(socket);
    const timeout = setTimeout(() => socket.destroy(), 7000); timeout.unref();
    socket.on('error', () => {});
    socket.once('close', () => { clearTimeout(timeout); this.sockets.delete(socket); this.connecting.delete(attempt); });
    socket.once('secureConnect', () => {
      clearTimeout(timeout);
      try {
        const cert = socket.getPeerCertificate();
        if (!cert.raw || fingerprint(cert.raw) !== id) { socket.destroy(); return; }
        this.attachPeer(socket, id, endpoint);
      } catch { socket.destroy(); }
    });
  }

  attachPeer(socket, expectedId, endpoint) {
    if (this.stopped) { socket.destroy(); return; }
    this.sockets.add(socket);
    let peerId, hello = false, buffer = Buffer.alloc(0);
    try {
      const cert = socket.getPeerCertificate();
      if (!cert.raw) throw new Error('missing certificate');
      const x509 = new X509Certificate(cert.raw);
      if (Date.parse(x509.validTo) < Date.now() || Date.parse(x509.validFrom) > Date.now()) throw new Error('expired certificate');
      peerId = fingerprint(cert.raw);
      if (peerId === this.identity.id || (expectedId && peerId !== expectedId)) throw new Error('wrong peer');
    } catch { socket.destroy(); return; }
    const handshake = setTimeout(() => socket.destroy(), 7000); handshake.unref();
    socket.setKeepAlive(true, 15000);
    socket.on('error', () => {});
    socket.once('close', () => {
      clearTimeout(handshake); this.sockets.delete(socket);
      if (this.peers.get(peerId)?.socket === socket) {
        this.peers.delete(peerId);
        for (const waits of this.waiting.values()) waits.delete(peerId);
        this.publish();
      }
    });
    if (this.config.contacts[peerId]) this.write(socket, { type: 'hello', v: VERSION, peer: this.identity.id, name: this.config.name,
      rooms: Object.keys(this.config.rooms), endpoints: this.endpoints(),
      waiting: [...this.waiting].filter(([, waits]) => waits.has(this.identity.id)).map(([room, waits]) => ({ room, context: waits.get(this.identity.id) })) });
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      let newline;
      while ((newline = buffer.indexOf(10)) !== -1) {
        if (newline > MAX_MESSAGE_BYTES) { socket.destroy(); return; }
        const line = buffer.subarray(0, newline); buffer = buffer.subarray(newline + 1);
        try {
          const message = JSON.parse(line.toString('utf8'));
          if (!hello) {
            if (message.type !== 'hello' || message.v !== VERSION || message.peer !== peerId ||
                typeof message.name !== 'string' || message.name.length > 60 ||
                !Array.isArray(message.rooms) || message.rooms.length > 64 || !message.rooms.every(validRoomId) ||
                !Array.isArray(message.waiting) || message.waiting.length > 32 ||
                !message.waiting.every(wait => validRoomId(wait.room) && typeof wait.context === 'string' && wait.context.length <= 120) ||
                !Array.isArray(message.endpoints) || message.endpoints.length > 16 || !message.endpoints.every(validateEndpoint)) throw new Error('invalid hello');
            const shared = message.rooms.filter(room => this.config.rooms[room]);
            if (!shared.length) throw new Error('no shared room');
            const contact = this.config.contacts[peerId];
            if (!contact || shared.some(room => !contact.rooms.includes(room))) {
              if (this.pending.size < 32) this.pending.set(peerId, { id: peerId, name: message.name, rooms: shared,
                endpoints: message.endpoints, seenAt: Date.now() });
              this.publish();
              if (!contact) { socket.destroy(); return; }
            }
            const rooms = shared.filter(room => contact.rooms.includes(room));
            if (!rooms.length) throw new Error('room not authorized');
            const existing = this.peers.get(peerId);
            const outbound = !!expectedId, preferOutbound = this.identity.id < peerId;
            if (existing) {
              if (existing.outbound === preferOutbound || outbound !== preferOutbound) { socket.destroy(); return; }
              existing.socket.destroy();
            }
            hello = true; clearTimeout(handshake);
            this.peers.set(peerId, { socket, outbound, name: message.name, rooms, endpoint });
            for (const wait of message.waiting) if (rooms.includes(wait.room)) {
              if (!this.waiting.has(wait.room)) this.waiting.set(wait.room, new Map());
              this.waiting.get(wait.room).set(peerId, wait.context);
            }
            if (contact.name !== message.name) {
              contact.name = message.name;
              this.persist().catch(() => { this.lastError = 'Could not save the device name'; this.publish(); });
            }
            this.scheduleRoster();
            this.publish();
          } else if (message.type === 'event') {
            const event = validateEvent(message.event);
            const peer = this.peers.get(peerId);
            if (peer?.socket !== socket || event.sender !== peerId || !peer.rooms.includes(event.room)) throw new Error('unauthorized event');
            if (this.gate.accept(event)) {
              this.updateWaiting(event);
              this.notify({ type: 'event', event }); this.publish();
            }
          } else if (message.type === 'roster') {
            const peer = this.peers.get(peerId);
            if (peer?.socket !== socket || !Array.isArray(message.members) || message.members.length > 64) throw new Error('invalid roster');
            let changed = false;
            for (const member of message.members) {
              if (!/^[a-f0-9]{64}$/.test(member.id) || typeof member.name !== 'string' || !member.name.trim() || member.name.length > 60 ||
                  !Array.isArray(member.rooms) || member.rooms.length > 32 || !member.rooms.every(room => peer.rooms.includes(room)) ||
                  !Array.isArray(member.endpoints) || member.endpoints.length > 16 || !member.endpoints.every(validateEndpoint)) throw new Error('invalid member');
              if (member.id === this.identity.id || !member.rooms.length) continue;
              const previous = this.config.contacts[member.id];
              if (!previous && Object.keys(this.config.contacts).length >= 64) continue;
              const rooms = [...new Set([...(previous?.rooms ?? []), ...member.rooms])];
              if (!previous || rooms.length !== previous.rooms.length) {
                this.config.contacts[member.id] = { name: previous?.name ?? member.name,
                  endpoints: previous?.endpoints ?? member.endpoints, rooms, introducedBy: previous?.introducedBy ?? peerId };
                this.pending.delete(member.id); changed = true;
              }
            }
            if (changed) {
              this.persist().catch(() => { this.lastError = 'Could not save room participants'; this.publish(); });
              this.connectKnown(); this.scheduleRoster(); this.publish();
            }
          } else throw new Error('invalid message');
        } catch { socket.destroy(); return; }
      }
      // Bound clients that never finish a message, after parsing complete lines.
      if (buffer.length > MAX_MESSAGE_BYTES) socket.destroy();
    });
  }

  write(socket, message) {
    if (socket.destroyed) return;
    const data = `${JSON.stringify(message)}\n`;
    if (Buffer.byteLength(data) > MAX_MESSAGE_BYTES || socket.writableLength > MAX_MESSAGE_BYTES * 4) { socket.destroy(); return; }
    socket.write(data);
  }

  scheduleRoster() {
    if (this.rosterTimer || this.stopped) return;
    this.rosterTimer = setTimeout(() => {
      this.rosterTimer = null;
      for (const peer of this.peers.values()) {
        const roster = { type: 'roster', members: [] };
        const members = [{ id: this.identity.id, name: this.config.name, endpoints: this.endpoints(), rooms: peer.rooms },
          ...Object.entries(this.config.contacts).map(([id, contact]) => ({ id, ...contact }))];
        for (const member of members) {
          const rooms = member.rooms.filter(room => peer.rooms.includes(room));
          if (!rooms.length) continue;
          const item = { id: member.id, name: member.name, endpoints: member.endpoints, rooms };
          roster.members.push(item);
          if (Buffer.byteLength(JSON.stringify(roster)) > MAX_MESSAGE_BYTES - 512) { roster.members.pop(); break; }
        }
        this.write(peer.socket, roster);
      }
    }, 50);
    this.rosterTimer.unref();
  }

  updateWaiting(event) {
    if (!this.waiting.has(event.room)) this.waiting.set(event.room, new Map());
    const waits = this.waiting.get(event.room);
    if (event.action === 'wait') waits.set(event.sender, event.context);
    if (event.action === 'ready') waits.delete(event.sender);
  }

  attachExtension(ws) {
    ws.on('error', () => {});
    ws.on('message', async bytes => {
      let request;
      try {
        request = JSON.parse(bytes.toString());
        if (!validId(request.id)) throw new Error('Invalid request');
        const data = await this.command(request.method, request.args ?? {});
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ id: request.id, ok: true, data }));
      } catch (error) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ id: request?.id, ok: false, error: error.message }));
      }
    });
    ws.send(JSON.stringify({ type: 'status', data: this.status() }));
  }

  status() {
    return { peer: this.identity.id, name: this.config.name, rooms: Object.entries(this.config.rooms).map(([id, room]) => ({ id, name: room.name })),
      peers: Object.entries(this.config.contacts).map(([id, contact]) => ({ id, name: contact.name, rooms: contact.rooms,
        connected: this.peers.has(id), route: this.peers.get(id)?.endpoint ? 'Direct connection' : (this.peers.has(id) ? 'Inbound direct connection' : 'Disconnected') })),
      pending: [...this.pending.values()].map(({ id, name, rooms }) => ({ id, name, rooms })),
      waiting: Object.fromEntries([...this.waiting].map(([room, waits]) => [room, Object.fromEntries(waits)])),
      discoveryUnavailable: !!this.discoveryUnavailable, lastError: this.lastError ?? null };
  }

  notify(message) {
    const serialized = JSON.stringify(message);
    for (const ws of this.wss?.clients ?? []) {
      if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < MAX_MESSAGE_BYTES * 4) ws.send(serialized);
    }
  }
  publish() { if (this.identity && this.config) this.notify({ type: 'status', data: this.status() }); }

  async command(method, args) {
    if (method === 'status') return this.status();
    if (method === 'createRoom') {
      if (Object.keys(this.config.rooms).length >= 32) throw new Error('Room limit reached');
      const id = randomUUID(); this.config.rooms[id] = { name: text(args.name) };
      await this.persist(); this.publish(); return { room: id, invite: this.invite(id) };
    }
    if (method === 'invite') return { invite: this.invite(args.room) };
    if (method === 'join') {
      const invite = parseInvite(args.invite);
      if (invite.peer === this.identity.id) throw new Error('This is your own invitation. Send it to your partner');
      if (Object.keys(this.config.rooms).length >= 32 && !this.config.rooms[invite.room]) throw new Error('Room limit reached');
      this.config.rooms[invite.room] ??= { name: invite.name };
      const previous = this.config.contacts[invite.peer];
      this.config.contacts[invite.peer] = { name: previous?.name ?? 'My partner', endpoints: invite.endpoints,
        rooms: [...new Set([...(previous?.rooms ?? []), invite.room])] };
      await this.persist();
      const peer = this.peers.get(invite.peer);
      if (peer && !peer.rooms.includes(invite.room)) { peer.socket.destroy(); this.peers.delete(invite.peer); }
      this.connectKnown(); this.publish(); return { room: invite.room };
    }
    if (method === 'approve') {
      const pending = this.pending.get(args.peer);
      if (!pending || Date.now() - pending.seenAt > 120000) throw new Error('Join request expired. Ask your partner to retry');
      const previous = this.config.contacts[args.peer];
      this.config.contacts[args.peer] = { name: text(pending.name), rooms: [...new Set([...(previous?.rooms ?? []), ...pending.rooms])], endpoints: pending.endpoints };
      await this.persist(); this.pending.delete(args.peer);
      this.peers.get(args.peer)?.socket.destroy(); this.peers.delete(args.peer);
      this.connectKnown(); this.publish(); return {};
    }
    if (method === 'send') {
      if (!validRoomId(args.room) || !Object.hasOwn(this.config.rooms, args.room)) throw new Error('Select a room first');
      if (!finite(args.position)) throw new Error('Invalid playback position');
      if (['play', 'sync', 'seek'].includes(args.action) && !args.paused &&
          [...(this.waiting.get(args.room)?.values() ?? [])].includes(args.context)) throw new Error('A participant is still waiting. Each person must clear their own wait first');
      const event = validateEvent({ v: VERSION, id: randomUUID(), session: this.session, seq: ++this.sequence,
        sender: this.identity.id, room: args.room, context: args.context, action: args.action, position: args.position, paused: args.paused });
      this.gate.accept(event); this.updateWaiting(event);
      let recipients = 0;
      for (const peer of this.peers.values()) if (peer.rooms.includes(event.room)) { this.write(peer.socket, { type: 'event', event }); recipients++; }
      this.publish(); return { recipients, event };
    }
    throw new Error('Unsupported operation');
  }

  invite(room) {
    if (!validRoomId(room) || !Object.hasOwn(this.config.rooms, room)) throw new Error('Room not found');
    return makeInvite({ v: VERSION, room, name: this.config.rooms[room].name, peer: this.identity.id, endpoints: this.endpoints() });
  }

  async stop() {
    this.stopped = true; clearInterval(this.retryTimer); clearTimeout(this.rosterTimer);
    this.browser?.stop(); this.advertisement?.stop(); this.bonjour?.destroy();
    for (const socket of this.sockets) socket.destroy();
    for (const client of this.wss?.clients ?? []) client.terminate();
    this.wss?.close();
    await Promise.all([this.peerServer, this.httpServer].filter(s => s?.listening).map(s => new Promise(resolve => s.close(resolve))));
    await this.saveQueue;
  }
}
