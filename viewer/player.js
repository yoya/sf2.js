// Sample playback. The AudioContext is created on the first user gesture
// (autoplay policy) and reused.

let ctx = null;
let current = null;

function context() {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

export function stop() {
    if (current) {
        try { current.stop(); } catch (e) { /* already stopped */ }
        current.disconnect();
        current = null;
    }
}

/**
 * @param {{data:Float32Array, sampleRate:number, loopStart:number, loopEnd:number}} pcm
 * @param {{loop?:boolean, duration?:number}} opts
 */
export function play(pcm, { loop = false, duration = Infinity } = {}) {
    stop();
    const ac = context();
    const buf = ac.createBuffer(1, Math.max(1, pcm.data.length), pcm.sampleRate);
    buf.copyToChannel(pcm.data, 0);
    const src = ac.createBufferSource();
    src.buffer = buf;
    if (loop && pcm.loopEnd > pcm.loopStart) {
        src.loop = true;
        src.loopStart = pcm.loopStart / pcm.sampleRate;
        src.loopEnd = pcm.loopEnd / pcm.sampleRate;
    }
    src.connect(ac.destination);
    src.start();
    if (src.loop && Number.isFinite(duration)) src.stop(ac.currentTime + duration);
    src.onended = () => { if (current === src) current = null; };
    current = src;
}
