// "Hydra" layer: the nine pdta sub-chunks decoded into flat, immutable record
// arrays exactly as stored in the file (terminal records included).
// No cross references are resolved here; that is the model layer's job.

import { RiffError } from './riff.js';
import { decodeGenAmount } from './generators.js';

function readString(view, o, len) {
    let s = '';
    for (let i = 0; i < len; i++) {
        const c = view.getUint8(o + i);
        if (c === 0) break;
        s += String.fromCharCode(c);
    }
    return s.trimEnd();
}

// field readers: [name, reader(view, o) , byteLength]
const u8 = name => [name, (v, o) => v.getUint8(o), 1];
const s8 = name => [name, (v, o) => v.getInt8(o), 1];
const u16 = name => [name, (v, o) => v.getUint16(o, true), 2];
const s16 = name => [name, (v, o) => v.getInt16(o, true), 2];
const u32 = name => [name, (v, o) => v.getUint32(o, true), 4];
const str20 = name => [name, (v, o) => readString(v, o, 20), 20];

const BAG = [u16('genIndex'), u16('modIndex')];
const MOD = [u16('srcOper'), u16('destOper'), s16('amount'), u16('amtSrcOper'), u16('transOper')];
const GEN = [u16('oper'), u16('rawAmount')];

export const RECORD_LAYOUTS = {
    phdr: [str20('name'), u16('preset'), u16('bank'), u16('bagIndex'),
        u32('library'), u32('genre'), u32('morphology')],
    pbag: BAG,
    pmod: MOD,
    pgen: GEN,
    inst: [str20('name'), u16('bagIndex')],
    ibag: BAG,
    imod: MOD,
    igen: GEN,
    shdr: [str20('name'), u32('start'), u32('end'), u32('startLoop'), u32('endLoop'),
        u32('sampleRate'), u8('originalPitch'), s8('pitchCorrection'),
        u16('sampleLink'), u16('sampleType')],
};

const recordSize = layout => layout.reduce((n, f) => n + f[2], 0);
export const RECORD_SIZES = Object.fromEntries(
    Object.entries(RECORD_LAYOUTS).map(([k, l]) => [k, recordSize(l)]));

function readRecords(view, chunk, id) {
    const layout = RECORD_LAYOUTS[id];
    const size = RECORD_SIZES[id];
    if (chunk.size % size !== 0) {
        throw new RiffError(`${id} size ${chunk.size} is not a multiple of ${size}`);
    }
    const count = chunk.size / size;
    if (count < 1) {
        throw new RiffError(`${id} has no terminal record`);
    }
    const records = new Array(count);
    for (let i = 0, o = chunk.offset; i < count; i++, o += size) {
        const r = {};
        let fo = o;
        for (const [name, read, len] of layout) {
            r[name] = read(view, fo);
            fo += len;
        }
        if (layout === GEN) {
            r.amount = decodeGenAmount(r.oper, r.rawAmount);
        }
        records[i] = Object.freeze(r);
    }
    return Object.freeze(records);
}

/**
 * @param {ArrayBuffer} buffer
 * @param {object} pdta  LIST 'pdta' chunk from parseRiff()
 */
export function parseHydra(buffer, pdta) {
    const view = new DataView(buffer);
    const hydra = {};
    for (const id of Object.keys(RECORD_LAYOUTS)) {
        const chunk = pdta.children.find(c => c.id === id);
        if (!chunk) {
            throw new RiffError(`pdta is missing the "${id}" chunk`);
        }
        hydra[id] = readRecords(view, chunk, id);
    }
    validateHydra(hydra);
    return Object.freeze(hydra);
}

// Index fields must be non-decreasing and stay inside the referenced array,
// otherwise zone ranges cannot be resolved safely.
function validateHydra(h) {
    const check = (headers, field, target, name) => {
        let prev = 0;
        for (let i = 0; i < headers.length; i++) {
            const v = headers[i][field];
            if (v < prev || v >= target.length) {
                throw new RiffError(`${name}[${i}].${field}=${v} is out of order or range (0..${target.length - 1})`);
            }
            prev = v;
        }
    };
    check(h.phdr, 'bagIndex', h.pbag, 'phdr');
    check(h.pbag, 'genIndex', h.pgen, 'pbag');
    check(h.pbag, 'modIndex', h.pmod, 'pbag');
    check(h.inst, 'bagIndex', h.ibag, 'inst');
    check(h.ibag, 'genIndex', h.igen, 'ibag');
    check(h.ibag, 'modIndex', h.imod, 'ibag');
}
