// Public facade: parseSoundFont(arrayBuffer) -> SoundFont
//
//   riff.js       bytes  -> chunk tree
//   hydra.js      pdta   -> raw record arrays
//   model.js      hydra  -> Preset / Instrument / Sample graph
//   soundfont.js  INFO + sample data access + facade (this file)

import { parseRiff, findChunk, RiffError } from './riff.js';
import { parseHydra } from './hydra.js';
import { buildModel } from './model.js';

export { RiffError } from './riff.js';
export * from './generators.js';
export { SAMPLE_TYPES } from './model.js';

const INFO_STRING_IDS = ['isng', 'INAM', 'irom', 'ICRD', 'IENG', 'IPRD', 'ICOP', 'ICMT', 'ISFT'];

function parseInfo(view, list) {
    const info = {};
    for (const c of list.children) {
        if (c.id === 'ifil' || c.id === 'iver') {
            info[c.id] = `${view.getUint16(c.offset, true)}.${view.getUint16(c.offset + 2, true)}`;
        } else if (INFO_STRING_IDS.includes(c.id)) {
            let s = '';
            for (let i = 0; i < c.size; i++) {
                const ch = view.getUint8(c.offset + i);
                if (ch === 0) break;
                s += String.fromCharCode(ch);
            }
            info[c.id] = s;
        }
    }
    return info;
}

export class SoundFont {
    constructor(buffer, riff, info, hydra, model, smpl, sm24) {
        this.buffer = buffer;
        this.riff = riff;
        this.info = info;
        this.hydra = hydra;
        this.presets = model.presets;
        this.instruments = model.instruments;
        this.samples = model.samples;
        this.warnings = model.warnings;
        this._smpl = smpl;
        this._sm24 = sm24;
    }

    findPreset(bank, program) {
        return this.presets.find(p => p.bank === bank && p.program === program) || null;
    }

    get sampleCount() {
        return this._smpl ? this._smpl.size >> 1 : 0;
    }

    /**
     * Decode PCM frames [from, to) of the smpl chunk to Float32 (-1..1).
     * Uses sm24 for 24-bit precision when present.
     */
    readPcm(from, to) {
        const total = this.sampleCount;
        from = Math.max(0, Math.min(from, total));
        to = Math.max(from, Math.min(to, total));
        const out = new Float32Array(to - from);
        const view = new DataView(this.buffer);
        const base = this._smpl.offset;
        const sm24 = this._sm24;
        if (sm24 && sm24.size >= total) {
            for (let i = 0; i < out.length; i++) {
                const hi = view.getInt16(base + 2 * (from + i), true);
                const lo = view.getUint8(sm24.offset + from + i);
                out[i] = (hi * 256 + lo) / 8388608;
            }
        } else {
            for (let i = 0; i < out.length; i++) {
                out[i] = view.getInt16(base + 2 * (from + i), true) / 32768;
            }
        }
        return out;
    }

    /** PCM of a sample header: the whole sample, loop points made relative. */
    getSampleData(sample) {
        return {
            data: this.readPcm(sample.start, sample.end),
            sampleRate: sample.sampleRate,
            loopStart: sample.startLoop - sample.start,
            loopEnd: sample.endLoop - sample.start,
        };
    }
}

/** @param {ArrayBuffer} buffer */
export function parseSoundFont(buffer) {
    const riff = parseRiff(buffer);
    if (riff.type !== 'sfbk') {
        throw new RiffError(`RIFF form type is "${riff.type}", expected "sfbk"`);
    }
    const infoList = findChunk(riff, 'LIST', 'INFO');
    const sdta = findChunk(riff, 'LIST', 'sdta');
    const pdta = findChunk(riff, 'LIST', 'pdta');
    if (!infoList || !sdta || !pdta) {
        throw new RiffError('sfbk must contain LIST INFO, sdta and pdta');
    }
    const view = new DataView(buffer);
    const info = parseInfo(view, infoList);
    const hydra = parseHydra(buffer, pdta);
    const model = buildModel(hydra);
    return new SoundFont(buffer, riff, info, hydra, model,
        findChunk(sdta, 'smpl'), findChunk(sdta, 'sm24'));
}
