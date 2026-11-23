// Key-range map: one row per zone, laid over a 128-key keyboard.
// Zones are HTML boxes positioned in % so labels never get distorted;
// the keyboard itself is a stretched SVG (no text inside).

import { h, s } from './dom.js';
import { noteName } from '../src/soundfont.js';

const BLACK = new Set([1, 3, 6, 8, 10]);
const pct = key => `${(key / 128) * 100}%`;

function keyboard() {
    const svg = s('svg', { class: 'keyboard', viewBox: '0 0 128 1', preserveAspectRatio: 'none' });
    for (let k = 0; k < 128; k++) {
        svg.append(s('rect', {
            x: k, y: 0, width: 1, height: 1,
            class: BLACK.has(k % 12) ? 'key-black' : 'key-white',
        }));
    }
    return svg;
}

/**
 * @param {Array<{keyRange, velRange, label, href}>} rows
 */
export function keyMap(rows) {
    const grid = [];
    for (let k = 0; k <= 120; k += 12) {
        grid.push(h('div', { class: 'octave', style: { left: pct(k) } }));
    }
    const zoneRows = rows.map((r, i) => {
        const velFull = r.velRange.lo === 0 && r.velRange.hi === 127;
        const text = r.label + (velFull ? '' : `  [vel ${r.velRange.lo}–${r.velRange.hi}]`);
        return h('div', { class: 'km-row' },
            h('a', {
                class: `km-zone zone-${i % 6}${velFull ? '' : ' vel-split'}`,
                href: r.href || null,
                style: { left: pct(r.keyRange.lo), width: pct(r.keyRange.hi - r.keyRange.lo + 1) },
                title: `${r.label}\nkey ${noteName(r.keyRange.lo)}–${noteName(r.keyRange.hi)}`
                    + ` (${r.keyRange.lo}–${r.keyRange.hi})\nvel ${r.velRange.lo}–${r.velRange.hi}`,
            }, h('span', null, text)));
    });
    const labels = [];
    for (let k = 0; k < 128; k += 12) {
        labels.push(h('span', { style: { left: pct(k) } }, noteName(k)));
    }
    return h('div', { class: 'keymap' },
        h('div', { class: 'km-rows' }, grid, zoneRows),
        keyboard(),
        h('div', { class: 'km-labels' }, labels));
}
