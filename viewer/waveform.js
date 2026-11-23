// Waveform rendering with per-column min/max envelope (no aliasing).

function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    return { ctx, w, h };
}

function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawEnvelope(ctx, data, from, to, x0, x1, h) {
    const n = to - from;
    const cols = x1 - x0;
    const mid = h / 2;
    ctx.beginPath();
    if (n <= cols) {
        // fewer samples than pixels: draw a polyline through the samples
        for (let i = 0; i < n; i++) {
            const x = x0 + (i + 0.5) * cols / n;
            const y = mid - data[from + i] * mid;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        return;
    }
    for (let c = 0; c < cols; c++) {
        const a = from + Math.floor(c * n / cols);
        const b = Math.max(a + 1, from + Math.floor((c + 1) * n / cols));
        let min = 1, max = -1;
        for (let i = a; i < b; i++) {
            const v = data[i];
            if (v < min) min = v;
            if (v > max) max = v;
        }
        ctx.moveTo(x0 + c + 0.5, mid - max * mid);
        ctx.lineTo(x0 + c + 0.5, mid - min * mid + 1);
    }
    ctx.stroke();
}

/** Whole sample with the loop region shaded. */
export function drawWaveform(canvas, data, loopStart, loopEnd) {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.fillStyle = css('--wave-bg');
    ctx.fillRect(0, 0, w, h);
    if (loopEnd > loopStart && data.length > 0) {
        const xs = loopStart / data.length * w;
        const xe = loopEnd / data.length * w;
        ctx.fillStyle = css('--wave-loop');
        ctx.fillRect(xs, 0, Math.max(1, xe - xs), h);
    }
    ctx.strokeStyle = css('--wave-axis');
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    ctx.strokeStyle = css('--wave-line');
    ctx.lineWidth = 1;
    drawEnvelope(ctx, data, 0, data.length, 0, w, h);
}

/**
 * Loop seam: the last `span` samples before loopEnd joined to the first
 * `span` samples from loopStart, i.e. exactly what is heard at the wrap.
 */
export function drawLoopSeam(canvas, data, loopStart, loopEnd, span = 200) {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.fillStyle = css('--wave-bg');
    ctx.fillRect(0, 0, w, h);
    if (!(loopEnd > loopStart)) return;
    span = Math.min(span, loopEnd - loopStart);
    const half = Math.floor(w / 2);
    ctx.fillStyle = css('--wave-loop');
    ctx.fillRect(half, 0, w - half, h);
    ctx.strokeStyle = css('--wave-axis');
    ctx.beginPath();
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.moveTo(half + 0.5, 0); ctx.lineTo(half + 0.5, h);
    ctx.stroke();
    ctx.strokeStyle = css('--wave-line');
    ctx.lineWidth = 1.5;
    // draw both halves as one continuous signal
    const joined = new Float32Array(span * 2);
    joined.set(data.subarray(loopEnd - span, loopEnd), 0);
    joined.set(data.subarray(loopStart, loopStart + span), span);
    drawEnvelope(ctx, joined, 0, joined.length, 0, w, h);
}
