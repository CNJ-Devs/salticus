import { MediaController } from './media-controller.mjs';

if (!globalThis.__salticusContent) {
  globalThis.__salticusContent = true;
  const documentKey = crypto.randomUUID();
  const videos = new Map();
  let controller, boundId, boundUrl;
  const notify = message => { try { chrome.runtime.sendMessage({ ...message, documentKey }).catch(() => {}); } catch {} };
  function scan(root = document) {
    for (const video of root.querySelectorAll('video')) {
      if (![...videos.values()].includes(video)) videos.set(crypto.randomUUID(), video);
    }
    for (const element of root.querySelectorAll('*')) if (element.shadowRoot) scan(element.shadowRoot);
    for (const [id, video] of videos) if (!video.isConnected) videos.delete(id);
  }
  function list() {
    scan();
    return [...videos].map(([id, video], index) => {
      const rect = video.getBoundingClientRect();
      return { id, label: `Video ${index + 1}`, time: video.currentTime,
        duration: Number.isFinite(video.duration) ? video.duration : null,
        paused: video.paused, ready: video.readyState,
        visible: rect.width > 0 && rect.height > 0,
        area: rect.width * rect.height, documentKey };
    });
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.channel !== 'salticus-player') return;
    (async () => {
      if (message.method === 'list') return { players: list(), documentKey };
      if (message.method === 'unbind') { controller?.dispose(); controller = null; boundId = null; return {}; }
      if (message.method === 'bind') {
        scan(); const video = videos.get(message.player);
        if (!video) throw new Error('The player changed. Scan again');
        controller?.dispose(); boundId = message.player; boundUrl = location.href;
        controller = new MediaController(video, (action, state) => notify({ type: 'playerAction', action, state, player: boundId }));
        return { state: controller.snapshot(), documentKey };
      }
      if (!controller || !controller.video.isConnected || location.href !== boundUrl) throw new Error('Video binding expired. Bind it again');
      if (message.method === 'snapshot') return controller.snapshot();
      if (message.method === 'apply') return controller.apply(message.event, message.anchor);
      throw new Error('Unknown player operation');
    })().then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error.message }));
    return true;
  });
  setInterval(() => {
    if (controller && (!controller.video.isConnected || location.href !== boundUrl)) {
      controller.dispose(); controller = null; notify({ type: 'bindingLost', player: boundId }); boundId = null;
    }
  }, 1000);
}
