// SoundFont2 viewer. Reads only the model layer of src/soundfont.js.
// Navigation is hash based (#preset/3, #instrument/10, #sample/42), so the
// browser's back/forward buttons and links work without extra state.

import { parseSoundFont, formatGenAmount, formatModSource, transformName, noteName, GEN } from '../src/soundfont.js';
import { h, clear } from './dom.js';
import { keyMap } from './keymap.js';
import { drawWaveform, drawLoopSeam } from './waveform.js';
import * as player from './player.js';

const $ = id => document.getElementById(id);
const state = { sf: null, fileName: '', tab: 'presets', filter: '' };

const pad3 = n => String(n).padStart(3, '0');
const presetLabel = p => `${pad3(p.bank)}:${pad3(p.program)} ${p.name}`;
const href = obj => `#${obj.kind}/${obj.index}`;
const link = obj => h('a', { href: href(obj) }, obj.kind === 'preset' ? presetLabel(obj) : obj.name);

// ---------- loading ----------

async function loadBuffer(buffer, name) {
    $('status').textContent = `Parsing ${name}…`;
    const t = performance.now();
    try {
        state.sf = parseSoundFont(buffer);
    } catch (e) {
        state.sf = null;
        $('status').textContent = `Error: ${e.message}`;
        clear($('list'));
        clear($('main'));
        return;
    }
    state.fileName = name;
    const ms = (performance.now() - t).toFixed(1);
    $('status').textContent = `${name} — ${(buffer.byteLength / 1048576).toFixed(1)} MB, parsed in ${ms} ms`;
    renderList();
    route();
}

async function loadUrl(url) {
    $('status').textContent = `Loading ${url}…`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        await loadBuffer(await res.arrayBuffer(), url.split('/').pop());
    } catch (e) {
        $('status').textContent = `Could not load ${url}: ${e.message}. Open a .sf2 file instead.`;
    }
}

function loadFile(file) {
    if (file) file.arrayBuffer().then(buf => loadBuffer(buf, file.name));
}

// ---------- sidebar ----------

function listItems() {
    const sf = state.sf;
    const q = state.filter.toLowerCase();
    const match = label => !q || label.toLowerCase().includes(q);
    switch (state.tab) {
    case 'presets': {
        const groups = new Map();
        for (const p of sf.presets) {
            if (!match(presetLabel(p))) continue;
            if (!groups.has(p.bank)) groups.set(p.bank, []);
            groups.get(p.bank).push({ obj: p, label: presetLabel(p) });
        }
        return [...groups].flatMap(([bank, items]) =>
            [{ heading: bank === 128 ? 'Bank 128 (percussion)' : `Bank ${bank}` }, ...items]);
    }
    case 'instruments':
        return sf.instruments.filter(i => match(i.name))
            .map(i => ({ obj: i, label: `${pad3(i.index)} ${i.name}` }));
    case 'samples':
        return sf.samples.filter(s => match(s.name))
            .map(s => ({ obj: s, label: `${pad3(s.index)} ${s.name}` }));
    }
    return [];
}

function renderList() {
    const list = clear($('list'));
    if (!state.sf) return;
    for (const tab of document.querySelectorAll('#tabs button')) {
        tab.setAttribute('aria-selected', tab.dataset.tab === state.tab);
        const n = state.sf[tab.dataset.tab].length;
        tab.textContent = `${tab.dataset.label} (${n})`;
    }
    const frag = document.createDocumentFragment();
    for (const item of listItems()) {
        if (item.heading) {
            frag.append(h('li', { class: 'heading' }, item.heading));
        } else {
            frag.append(h('li', null, h('a', { href: href(item.obj), 'data-key': href(item.obj) }, item.label)));
        }
    }
    list.append(frag);
    markCurrent();
}

function markCurrent() {
    const cur = location.hash;
    for (const a of $('list').querySelectorAll('a')) {
        const on = a.dataset.key === cur;
        a.classList.toggle('current', on);
        if (on) a.scrollIntoView({ block: 'nearest' });
    }
}

// ---------- detail views ----------

function generatorList(zone, skip, relative) {
    const gens = zone.generators.filter(g => !skip.has(g.oper));
    if (!gens.length) return h('span', { class: 'muted' }, '—');
    return h('dl', { class: 'gens' }, gens.map(g => [
        h('dt', { title: `oper ${g.oper}` }, g.name),
        h('dd', null, formatGenAmount(g.oper, g.amount, relative)),
    ]));
}

function modulatorTable(mods) {
    if (!mods.length) return null;
    return h('details', { class: 'mods' },
        h('summary', null, `${mods.length} modulator${mods.length > 1 ? 's' : ''}`),
        h('table', null,
            h('thead', null, h('tr', null, ['source', 'destination', 'amount', 'amount source', 'transform']
                .map(t => h('th', null, t)))),
            h('tbody', null, mods.map(m => h('tr', null,
                h('td', null, formatModSource(m.src)),
                h('td', null, m.destName),
                h('td', { class: 'num' }, m.amount),
                h('td', null, formatModSource(m.amtSrc)),
                h('td', null, transformName(m.transOper)))))));
}

function zoneTable(owner, targetKey) {
    const terminal = targetKey === 'instrument' ? GEN.instrument : GEN.sampleID;
    const skip = new Set([GEN.keyRange, GEN.velRange, terminal]);
    const relative = targetKey === 'instrument'; // preset level = offsets
    const rows = [];
    if (owner.globalZone) {
        rows.push(h('tr', { class: 'global' },
            h('td', null, 'global'), h('td', null, '—'), h('td', null, '—'), h('td', null, '(applies to all zones)'),
            h('td', null, generatorList(owner.globalZone, skip, relative), modulatorTable(owner.globalZone.modulators))));
    }
    owner.zones.forEach((z, i) => {
        const target = z[targetKey];
        rows.push(h('tr', null,
            h('td', { class: 'num' }, i),
            h('td', null, `${noteName(z.keyRange.lo)}–${noteName(z.keyRange.hi)}`,
                h('div', { class: 'muted' }, `${z.keyRange.lo}–${z.keyRange.hi}`)),
            h('td', null, `${z.velRange.lo}–${z.velRange.hi}`),
            h('td', null, target ? link(target) : h('span', { class: 'error' }, 'missing')),
            h('td', null, generatorList(z, skip, relative), modulatorTable(z.modulators))));
    });
    return h('table', { class: 'zones' },
        h('thead', null, h('tr', null, ['#', 'key', 'vel', targetKey, 'generators'].map(t => h('th', null, t)))),
        h('tbody', null, rows));
}

function zoneKeyMap(owner, targetKey) {
    return keyMap(owner.zones.map((z, i) => ({
        keyRange: z.keyRange, velRange: z.velRange,
        label: `${i}: ${z[targetKey] ? z[targetKey].name : '?'}`,
        href: z[targetKey] ? href(z[targetKey]) : null,
    })));
}

function usedBy(list, empty) {
    if (!list.length) return h('p', { class: 'muted' }, empty);
    return h('ul', { class: 'inline' }, list.map(o => h('li', null, link(o))));
}

function viewPreset(p) {
    return [
        h('p', { class: 'kind' }, 'Preset'),
        h('h2', null, p.name),
        h('p', { class: 'meta' }, `bank ${p.bank} · program ${p.program} · ${p.zones.length} zones`),
        h('h3', null, 'Key map'),
        zoneKeyMap(p, 'instrument'),
        h('h3', null, 'Zones ', h('span', { class: 'muted' }, '(generator values are offsets added to the instrument)')),
        zoneTable(p, 'instrument'),
    ];
}

function viewInstrument(inst) {
    return [
        h('p', { class: 'kind' }, 'Instrument'),
        h('h2', null, inst.name),
        h('p', { class: 'meta' }, `#${inst.index} · ${inst.zones.length} zones`),
        h('h3', null, 'Used by presets'),
        usedBy(inst.usedBy, 'Not used by any preset.'),
        h('h3', null, 'Key map'),
        zoneKeyMap(inst, 'sample'),
        h('h3', null, 'Zones'),
        zoneTable(inst, 'sample'),
    ];
}

function viewSample(smp) {
    const sf = state.sf;
    const pcm = sf.getSampleData(smp);
    const seconds = pcm.data.length / smp.sampleRate;
    const cents = smp.pitchCorrection ? ` ${smp.pitchCorrection > 0 ? '+' : ''}${smp.pitchCorrection} cent` : '';
    const rows = [
        ['type', smp.sampleTypeName + (smp.linkedSample ? ' ' : ''), smp.linkedSample && link(smp.linkedSample)],
        ['root key', `${noteName(smp.originalPitch)} (${smp.originalPitch})${cents}`],
        ['sample rate', `${smp.sampleRate} Hz`],
        ['length', `${pcm.data.length} samples (${seconds.toFixed(3)} s)`],
        ['range', `${smp.start} – ${smp.end}`],
        ['loop', `${smp.startLoop} – ${smp.endLoop}  (relative ${pcm.loopStart} – ${pcm.loopEnd}, `
            + `${pcm.loopEnd - pcm.loopStart} samples)`],
    ];
    const wave = h('canvas', { class: 'wave', 'aria-label': 'Waveform' });
    const seam = h('canvas', { class: 'wave seam', 'aria-label': 'Loop seam' });
    const hasLoop = pcm.loopEnd > pcm.loopStart;
    const out = [
        h('p', { class: 'kind' }, 'Sample'),
        h('h2', null, smp.name),
        h('div', { class: 'buttons' },
            h('button', { onclick: () => player.play(pcm) }, '▶ Play'),
            hasLoop && h('button', { onclick: () => player.play(pcm, { loop: true }) }, '⟳ Play looped'),
            h('button', { onclick: player.stop }, '■ Stop')),
        h('table', { class: 'props' }, h('tbody', null,
            rows.map(([k, ...v]) => h('tr', null, h('th', null, k), h('td', null, v))))),
        h('h3', null, 'Waveform ', h('span', { class: 'muted' }, '(shaded = loop region)')),
        wave,
        hasLoop && h('h3', null, 'Loop seam ', h('span', { class: 'muted' },
            '(end of loop → start of loop; a smooth join means a click-free loop)')),
        hasLoop && seam,
        h('h3', null, 'Used by instruments'),
        usedBy(smp.usedBy, 'Not used by any instrument.'),
    ];
    // canvases need layout before drawing
    requestAnimationFrame(() => {
        drawWaveform(wave, pcm.data, pcm.loopStart, pcm.loopEnd);
        if (hasLoop) drawLoopSeam(seam, pcm.data, pcm.loopStart, pcm.loopEnd);
    });
    return out;
}

function viewInfo() {
    const sf = state.sf;
    const labels = {
        INAM: 'name', isng: 'sound engine', ifil: 'format version', irom: 'ROM', iver: 'ROM version',
        ICRD: 'created', IENG: 'engineer', IPRD: 'product', ICOP: 'copyright', ICMT: 'comment', ISFT: 'software',
    };
    return [
        h('p', { class: 'kind' }, 'File'),
        h('h2', null, sf.info.INAM || state.fileName),
        h('table', { class: 'props' }, h('tbody', null,
            Object.entries(sf.info).filter(([, v]) => v).map(([k, v]) =>
                h('tr', null, h('th', null, labels[k] || k), h('td', null, v))),
            [['presets', sf.presets.length], ['instruments', sf.instruments.length],
                ['samples', sf.samples.length]].map(([k, v]) =>
                h('tr', null, h('th', null, k), h('td', null, v))))),
        sf.warnings.length ? [h('h3', null, 'Warnings'),
            h('ul', null, sf.warnings.map(w => h('li', null, w)))] : null,
        h('p', { class: 'muted' }, 'Choose a preset, instrument or sample on the left.'),
    ];
}

function route() {
    const main = clear($('main'));
    player.stop();
    if (!state.sf) return;
    const m = location.hash.match(/^#(preset|instrument|sample)\/(\d+)$/);
    let content;
    if (m) {
        const idx = Number(m[2]);
        const coll = { preset: state.sf.presets, instrument: state.sf.instruments, sample: state.sf.samples }[m[1]];
        const obj = coll.find(o => o.index === idx);
        if (obj) {
            const tab = m[1] + 's';
            if (state.tab !== tab) { state.tab = tab; renderList(); }
            content = { preset: viewPreset, instrument: viewInstrument, sample: viewSample }[m[1]](obj);
        }
    }
    main.append(...[content || viewInfo()].flat(2).filter(Boolean));
    main.scrollTop = 0;
    markCurrent();
}

// ---------- wiring ----------

for (const tab of document.querySelectorAll('#tabs button')) {
    tab.addEventListener('click', () => { state.tab = tab.dataset.tab; renderList(); });
}
$('filter').addEventListener('input', e => { state.filter = e.target.value; renderList(); });
$('file').addEventListener('change', e => loadFile(e.target.files[0]));
document.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('drop'); });
document.addEventListener('dragleave', () => document.body.classList.remove('drop'));
document.addEventListener('drop', e => {
    e.preventDefault();
    document.body.classList.remove('drop');
    loadFile(e.dataTransfer.files[0]);
});
window.addEventListener('hashchange', route);
let resizeTimer = 0;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (location.hash.startsWith('#sample/')) route(); }, 150);
});

const params = new URLSearchParams(location.search);
loadUrl(params.get('url') || '../sample/emuaps_8mb.sf2');
