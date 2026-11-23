import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRiff, RiffError } from '../src/riff.js';
import { parseSoundFont, GEN, formatGenAmount, decodeModSource } from '../src/soundfont.js';

const file = readFileSync(new URL('../sample/emuaps_8mb.sf2', import.meta.url));
const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
const sf = parseSoundFont(buffer);

test('hydra record counts follow the spec record sizes', () => {
    assert.equal(sf.hydra.phdr.length, 137);
    assert.equal(sf.hydra.pmod.length, 15830 / 10);
    assert.equal(sf.hydra.imod.length, 17890 / 10);
    assert.equal(sf.hydra.shdr.length, 527);
});

test('terminal records are not exposed in the model', () => {
    assert.equal(sf.presets.length, 136);
    assert.equal(sf.instruments.length, 136);
    assert.equal(sf.samples.length, 526);
    assert.ok(!sf.presets.some(p => p.name === 'EOP'));
    assert.ok(!sf.samples.some(s => s.name === 'EOS'));
});

test('preset zones are limited to their own bag range', () => {
    const p = sf.findPreset(0, 0);
    assert.equal(p.name, 'Piano 1');
    const bags = sf.hydra.phdr[p.index + 1].bagIndex - sf.hydra.phdr[p.index].bagIndex;
    assert.equal(p.zones.length + (p.globalZone ? 1 : 0), bags);
    for (const z of p.zones) assert.ok(z.instrument && z.instrument.kind === 'instrument');
});

test('every instrument zone points to a sample; objects are shared', () => {
    for (const inst of sf.instruments) {
        for (const z of inst.zones) assert.equal(z.sample.kind, 'sample');
    }
    const insts = sf.presets.flatMap(p => p.zones.map(z => z.instrument));
    for (const i of insts) assert.equal(i, sf.instruments[i.index]);
});

test('signed generator amounts are decoded as signed', () => {
    const neg = sf.hydra.igen.filter(g => typeof g.amount === 'number' && g.amount < 0);
    assert.ok(neg.length > 0);
    const kr = sf.hydra.igen.find(g => g.oper === GEN.keyRange);
    assert.ok(kr.amount.lo <= kr.amount.hi);
});

test('unit formatting', () => {
    assert.equal(formatGenAmount(GEN.attackVolEnv, 0), '1 s');
    assert.equal(formatGenAmount(GEN.attackVolEnv, 1200), '2 s');
    assert.equal(formatGenAmount(GEN.initialAttenuation, 100), '10 dB');
    assert.equal(formatGenAmount(GEN.keyRange, { lo: 60, hi: 72 }), 'C4–C5 (60–72)');
    assert.equal(formatGenAmount(GEN.pan, -500), '50 % L');
});

test('modulator source decoding uses 7-bit index', () => {
    const s = decodeModSource((1 << 7) | 0x4a); // CC 74
    assert.equal(s.controller, 'CC74');
    assert.equal(decodeModSource(0x0502).controller, 'noteOnVelocity');
});

test('sample PCM decoding', () => {
    const s = sf.samples[0];
    const { data, loopStart, loopEnd } = sf.getSampleData(s);
    assert.equal(data.length, s.end - s.start);
    assert.ok(loopStart >= 0 && loopEnd <= data.length);
    assert.ok(data.every(v => v >= -1 && v < 1));
});

test('INFO chunk', () => {
    assert.match(sf.info.ifil, /^2\.\d+$/);
    assert.equal(typeof sf.info.INAM, 'string');
});

test('RIFF walker pads odd chunks and rejects bad input', () => {
    // RIFF(4) 'test' + 'abc ' size 3 + pad + 'def ' size 0
    const bytes = new Uint8Array(12 + 8 + 4 + 8);
    const dv = new DataView(bytes.buffer);
    const put = (o, s) => [...s].forEach((c, i) => (bytes[o + i] = c.charCodeAt(0)));
    put(0, 'RIFF'); dv.setUint32(4, bytes.length - 8, true); put(8, 'test');
    put(12, 'abc '); dv.setUint32(16, 3, true);
    put(24, 'def '); dv.setUint32(28, 0, true);
    const r = parseRiff(bytes.buffer);
    assert.deepEqual(r.children.map(c => c.id), ['abc ', 'def ']);
    assert.throws(() => parseRiff(new ArrayBuffer(4)), RiffError);
    dv.setUint32(16, 1000, true);
    assert.throws(() => parseRiff(bytes.buffer), RiffError);
});

test('parse is fast', () => {
    const t = performance.now();
    parseSoundFont(buffer);
    assert.ok(performance.now() - t < 500);
});

test('preset-level generators are formatted as offsets', () => {
    assert.equal(formatGenAmount(GEN.initialFilterFc, 1200, true), '+1200 cent (×2)');
    assert.equal(formatGenAmount(GEN.attackVolEnv, -1200, true), '-1200 tcent (×0.5)');
    assert.equal(formatGenAmount(GEN.keyRange, { lo: 0, hi: 1 }, true), 'C-1–C#-1 (0–1)');
});
