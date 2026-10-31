import test from 'node:test';
import assert from 'node:assert/strict';
import { MediaController } from '../extension/media-controller.mjs';

class Video extends EventTarget {
  paused = true; duration = 3600; readyState = 4; seeking = false; playbackRate = 1; time = 588;
  get currentTime() { return this.time; }
  set currentTime(value) { this.time = value; this.dispatchEvent(new Event('seeked')); }
  play() { if (this.blocked) return Promise.reject(new Error('NotAllowedError')); this.paused = false; this.dispatchEvent(new Event('play')); return Promise.resolve(); }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
}
test('remote seek and play do not echo; the next real user pause still broadcasts', async () => {
  const video = new Video(), events = [];
  const controller = new MediaController(video, (action, state) => events.push({ action, state }));
  await controller.apply({ action: 'sync', position: 60, paused: false }, 588);
  assert.equal(video.currentTime, 648); assert.equal(video.paused, false); assert.equal(events.length, 0);
  video.pause();
  assert.equal(events.length, 1); assert.equal(events[0].action, 'pause');
  controller.dispose(); video.play(); assert.equal(events.length, 1);
});
test('waiting preserves local position and ready never resumes playback', async () => {
  const video = new Video(), controller = new MediaController(video, () => {});
  await video.play(); await controller.apply({ action: 'wait' }, 0);
  assert.equal(video.currentTime, 588); assert.equal(video.paused, true);
  await controller.apply({ action: 'ready' }, 0); assert.equal(video.paused, true);
});
test('a site resuming after a remote paused seek stays paused without echo', async () => {
  const video = new Video(), events = [], controller = new MediaController(video, action => events.push(action));
  Object.defineProperty(video, 'currentTime', {
    get() { return this.time; },
    set(value) { this.time = value; this.seeking = true; },
  });
  await controller.apply({ action: 'sync', position: 60, paused: true }, 588);
  await video.play();
  assert.equal(video.paused, true); assert.deepEqual(events, []);
  video.seeking = false; video.dispatchEvent(new Event('seeked'));
  // The site resumes asynchronously after its seeked handler, as yifan does.
  await new Promise(resolve => setTimeout(resolve, 0));
  await video.play();
  assert.equal(video.currentTime, 648); assert.equal(video.paused, true); assert.deepEqual(events, []);
  controller.onInteraction({ isTrusted: true });
  await video.play();
  assert.equal(video.paused, false); assert.deepEqual(events, ['play']);
});
test('an explicit play command overrides paused-seek correction immediately', async () => {
  const video = new Video(), events = [], controller = new MediaController(video, action => events.push(action));
  await controller.apply({ action: 'sync', position: 60, paused: true }, 588);
  await controller.apply({ action: 'play', position: 60, paused: false }, 588);
  assert.equal(video.paused, false); assert.deepEqual(events, []);
});
test('autoplay rejection is reported and does not swallow a subsequent user play', async () => {
  const video = new Video(), events = [], controller = new MediaController(video, action => events.push(action));
  video.blocked = true;
  await assert.rejects(controller.apply({ action: 'sync', position: 0, paused: false }, 588), /Browser blocked/);
  video.blocked = false; await video.play(); assert.deepEqual(events, ['play']);
});
test('an out-of-range alignment does not change the player', async () => {
  const video = new Video(), controller = new MediaController(video, () => {});
  await assert.rejects(controller.apply({ action: 'sync', position: -600, paused: false }, 588), /out of range/);
  assert.equal(video.currentTime, 588); assert.equal(video.paused, true);
});
test('a pending play promise times out and leaves the controller usable for pause', async () => {
  const video = new Video(); video.play = () => { video.paused = false; return new Promise(() => {}); };
  const events = [], controller = new MediaController(video, action => events.push(action), () => Date.now(), 20);
  await assert.rejects(controller.apply({ action: 'sync', position: 0, paused: false }, 588), /timed out/);
  assert.equal(video.paused, true); assert.deepEqual(events, []);
  await controller.apply({ action: 'pause', position: 1, paused: true }, 588);
  assert.equal(video.currentTime, 589);
});
