// Model layer: resolves hydra index ranges into
//   Preset -> Zone[] -> Instrument -> Zone[] -> Sample
// Built eagerly in one linear pass; every object is created exactly once and
// shared by reference. Terminal records (EOP / EOI / EOS) are dropped.

import { GEN, generatorInfo, decodeModSource } from './generators.js';

export const SAMPLE_TYPES = {
    1: 'mono', 2: 'right', 4: 'left', 8: 'linked',
    0x8001: 'ROM mono', 0x8002: 'ROM right', 0x8004: 'ROM left', 0x8008: 'ROM linked',
};

function buildSamples(shdr) {
    const samples = [];
    for (let i = 0; i < shdr.length - 1; i++) {
        const r = shdr[i];
        samples.push({
            kind: 'sample',
            index: i,
            name: r.name,
            start: r.start,
            end: r.end,                 // exclusive
            startLoop: r.startLoop,
            endLoop: r.endLoop,         // exclusive
            sampleRate: r.sampleRate,
            originalPitch: r.originalPitch,
            pitchCorrection: r.pitchCorrection,
            sampleLink: r.sampleLink,
            sampleType: r.sampleType,
            sampleTypeName: SAMPLE_TYPES[r.sampleType] || `unknown(${r.sampleType})`,
            linkedSample: null,
            usedBy: [],                 // instruments
        });
    }
    for (const s of samples) {
        if (s.sampleType & 0x0e && s.sampleLink < samples.length) {
            s.linkedSample = samples[s.sampleLink];
        }
    }
    return samples;
}

function buildModulator(r) {
    return {
        src: decodeModSource(r.srcOper),
        dest: r.destOper,
        destName: r.destOper & 0x8000 ? `link→mod#${r.destOper & 0x7fff}`
            : generatorInfo(r.destOper).name,
        amount: r.amount,
        amtSrc: decodeModSource(r.amtSrcOper),
        transOper: r.transOper,
    };
}

/**
 * Build zones for header i of `headers` (phdr or inst).
 * terminalOper: GEN.instrument for presets, GEN.sampleID for instruments.
 * resolve(oper, amount) returns the referenced object (instrument / sample).
 */
function buildZones(headers, i, bags, gens, mods, terminalOper, resolve, warnings, owner) {
    const zones = [];
    let globalZone = null;
    const bagStart = headers[i].bagIndex;
    const bagEnd = headers[i + 1].bagIndex;         // exclusive
    for (let b = bagStart; b < bagEnd; b++) {
        const genStart = bags[b].genIndex, genEnd = bags[b + 1].genIndex;
        const modStart = bags[b].modIndex, modEnd = bags[b + 1].modIndex;
        const zone = {
            index: b - bagStart,
            generators: [],            // in file order
            modulators: [],
            keyRange: { lo: 0, hi: 127 },
            velRange: { lo: 0, hi: 127 },
            instrument: null,
            sample: null,
        };
        for (let g = genStart; g < genEnd; g++) {
            const { oper, amount } = gens[g];
            zone.generators.push({ oper, name: generatorInfo(oper).name, amount });
            if (oper === GEN.keyRange) zone.keyRange = amount;
            else if (oper === GEN.velRange) zone.velRange = amount;
            else if (oper === terminalOper) {
                const target = resolve(amount);
                if (!target) warnings.push(`${owner}: zone ${zone.index} references missing #${amount}`);
                if (terminalOper === GEN.instrument) zone.instrument = target;
                else zone.sample = target;
            }
        }
        for (let m = modStart; m < modEnd; m++) {
            zone.modulators.push(buildModulator(mods[m]));
        }
        const last = zone.generators[zone.generators.length - 1];
        const isTerminated = last && last.oper === terminalOper;
        if (isTerminated) {
            zones.push(zone);
        } else if (b === bagStart) {
            globalZone = zone;          // spec 7.3 / 7.7: first zone without terminal gen
        } else {
            warnings.push(`${owner}: zone ${zone.index} has no ${generatorInfo(terminalOper).name}; ignored`);
        }
    }
    return { globalZone, zones };
}

export function buildModel(h) {
    const warnings = [];
    const samples = buildSamples(h.shdr);

    const instruments = [];
    for (let i = 0; i < h.inst.length - 1; i++) {
        const name = h.inst[i].name;
        const { globalZone, zones } = buildZones(h.inst, i, h.ibag, h.igen, h.imod,
            GEN.sampleID, idx => samples[idx] || null, warnings, `inst#${i} "${name}"`);
        instruments.push({ kind: 'instrument', index: i, name, globalZone, zones, usedBy: [] });
    }

    const presets = [];
    for (let i = 0; i < h.phdr.length - 1; i++) {
        const r = h.phdr[i];
        const { globalZone, zones } = buildZones(h.phdr, i, h.pbag, h.pgen, h.pmod,
            GEN.instrument, idx => instruments[idx] || null, warnings, `preset#${i} "${r.name}"`);
        presets.push({
            kind: 'preset', index: i, name: r.name, bank: r.bank, program: r.preset,
            library: r.library, genre: r.genre, morphology: r.morphology,
            globalZone, zones,
        });
    }

    // reverse references (deduplicated)
    for (const p of presets) {
        for (const z of p.zones) {
            if (z.instrument && !z.instrument.usedBy.includes(p)) z.instrument.usedBy.push(p);
        }
    }
    for (const inst of instruments) {
        for (const z of inst.zones) {
            if (z.sample && !z.sample.usedBy.includes(inst)) z.sample.usedBy.push(inst);
        }
    }

    presets.sort((a, b) => a.bank - b.bank || a.program - b.program);
    return { presets, instruments, samples, warnings };
}
