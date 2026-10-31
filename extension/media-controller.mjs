import { finite, targetTime } from '../shared/protocol.mjs';

export class MediaController {
  constructor(video, onAction, now = () => Date.now(), playTimeout = 5000) {
    this.video = video; this.onAction = onAction; this.now = now; this.playTimeout = playTimeout; this.expected = new Map();
    // Some site players call play() after a seek, even when the command was
    // paused. Keep that side effect local; an actual interaction takes priority.
    this.onInteraction = event => { if (event.isTrusted) this.seekPause = null; };
    this.interactionTarget = video.ownerDocument;
    for (const type of ['pointerdown', 'keydown', 'touchstart']) this.interactionTarget?.addEventListener(type, this.onInteraction, true);
    this.handlers = Object.fromEntries(['play', 'pause', 'seeked'].map(type => {
      const handler = () => this.handle(type); video.addEventListener(type, handler); return [type, handler];
    }));
  }
  snapshot() {
    const v = this.video;
    return { time: v.currentTime, duration: Number.isFinite(v.duration) ? v.duration : null, paused: v.paused,
      ready: v.readyState, seeking: v.seeking, rate: v.playbackRate };
  }
  handle(type) {
    if (type === 'play' && this.seekPause?.until >= this.now()) {
      this.expected.delete('play');
      this.expected.set('pause', { until: this.now() + 2000 });
      this.video.pause();
      return;
    }
    const expected = this.expected.get(type);
    if (expected) {
      this.expected.delete(type);
      if (expected.until >= this.now() && (type !== 'seeked' || Math.abs(this.video.currentTime - expected.time) < 0.5)) {
        if (type === 'seeked' && this.seekPause) this.seekPause.until = this.now() + 750;
        return;
      }
    }
    if (type === 'seeked') this.seekPause = null;
    // A real opposite action cancels an outstanding expectation from an older command.
    if (type === 'play') this.expected.delete('pause');
    if (type === 'pause') this.expected.delete('play');
    this.onAction(type === 'seeked' ? 'seek' : type, this.snapshot());
  }
  async apply(command, anchor) {
    if (command.action === 'ready') return this.snapshot();
    this.seekPause = null;
    const paused = command.action === 'wait' || command.paused;
    if (command.action !== 'wait') {
      if (!finite(this.video.duration, 0) || this.video.readyState < 1) throw new Error('Video is not ready. Play it on the page once first');
      const target = targetTime(command.position, anchor, this.video.duration);
      if (Math.abs(this.video.currentTime - target) > 0.08) {
        if (this.video.seekable?.length) {
          let allowed = false;
          for (let i = 0; i < this.video.seekable.length; i++) if (target >= this.video.seekable.start(i) && target <= this.video.seekable.end(i)) allowed = true;
          if (!allowed) throw new Error('The target position is not seekable yet. Retry synchronization later');
        }
        this.expected.set('seeked', { time: target, until: Infinity });
        if (paused) this.seekPause = { until: Infinity };
        this.video.currentTime = target;
      }
    }
    if (paused && !this.video.paused) {
      this.expected.set('pause', { until: this.now() + 2000 });
      this.video.pause();
    } else if (!paused && this.video.paused) {
      this.expected.set('play', { until: this.now() + 2000 });
      let timer;
      try {
        await Promise.race([this.video.play(), new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), this.playTimeout);
        })]);
      } catch (error) {
        this.expected.delete('play');
        if (!this.video.paused) {
          this.expected.set('pause', { until: this.now() + 2000 }); this.video.pause();
        }
        throw new Error(error.message === 'timeout' ? 'Playback timed out. Check video loading and sync again' : 'Browser blocked playback. Click Play on the page once, then sync');
      } finally { clearTimeout(timer); }
    }
    return this.snapshot();
  }
  dispose() {
    for (const [type, handler] of Object.entries(this.handlers)) this.video.removeEventListener(type, handler);
    for (const type of ['pointerdown', 'keydown', 'touchstart']) this.interactionTarget?.removeEventListener(type, this.onInteraction, true);
    this.seekPause = null;
    this.expected.clear();
  }
}
