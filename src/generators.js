// SoundFont 2.04 generator / modulator definitions (spec section 8).
// Single source of truth for names, amount types, units and defaults.

// amount kinds: 's16' signed, 'u16' unsigned/index/flags, 'range' {lo,hi}
const G = (name, kind, unit, def) => ({ name, kind, unit, default: def });

export const GENERATORS = [
    /*  0 */ G('startAddrsOffset', 's16', 'smpl', 0),
    /*  1 */ G('endAddrsOffset', 's16', 'smpl', 0),
    /*  2 */ G('startloopAddrsOffset', 's16', 'smpl', 0),
    /*  3 */ G('endloopAddrsOffset', 's16', 'smpl', 0),
    /*  4 */ G('startAddrsCoarseOffset', 's16', 'smpl32k', 0),
    /*  5 */ G('modLfoToPitch', 's16', 'cent', 0),
    /*  6 */ G('vibLfoToPitch', 's16', 'cent', 0),
    /*  7 */ G('modEnvToPitch', 's16', 'cent', 0),
    /*  8 */ G('initialFilterFc', 's16', 'abscent', 13500),
    /*  9 */ G('initialFilterQ', 's16', 'cB', 0),
    /* 10 */ G('modLfoToFilterFc', 's16', 'cent', 0),
    /* 11 */ G('modEnvToFilterFc', 's16', 'cent', 0),
    /* 12 */ G('endAddrsCoarseOffset', 's16', 'smpl32k', 0),
    /* 13 */ G('modLfoToVolume', 's16', 'cB', 0),
    /* 14 */ G('unused1', 's16', '', 0),
    /* 15 */ G('chorusEffectsSend', 's16', 'permille', 0),
    /* 16 */ G('reverbEffectsSend', 's16', 'permille', 0),
    /* 17 */ G('pan', 's16', 'pan', 0),
    /* 18 */ G('unused2', 's16', '', 0),
    /* 19 */ G('unused3', 's16', '', 0),
    /* 20 */ G('unused4', 's16', '', 0),
    /* 21 */ G('delayModLFO', 's16', 'timecent', -12000),
    /* 22 */ G('freqModLFO', 's16', 'abscent', 0),
    /* 23 */ G('delayVibLFO', 's16', 'timecent', -12000),
    /* 24 */ G('freqVibLFO', 's16', 'abscent', 0),
    /* 25 */ G('delayModEnv', 's16', 'timecent', -12000),
    /* 26 */ G('attackModEnv', 's16', 'timecent', -12000),
    /* 27 */ G('holdModEnv', 's16', 'timecent', -12000),
    /* 28 */ G('decayModEnv', 's16', 'timecent', -12000),
    /* 29 */ G('sustainModEnv', 's16', 'permille', 0),
    /* 30 */ G('releaseModEnv', 's16', 'timecent', -12000),
    /* 31 */ G('keynumToModEnvHold', 's16', 'tcent/key', 0),
    /* 32 */ G('keynumToModEnvDecay', 's16', 'tcent/key', 0),
    /* 33 */ G('delayVolEnv', 's16', 'timecent', -12000),
    /* 34 */ G('attackVolEnv', 's16', 'timecent', -12000),
    /* 35 */ G('holdVolEnv', 's16', 'timecent', -12000),
    /* 36 */ G('decayVolEnv', 's16', 'timecent', -12000),
    /* 37 */ G('sustainVolEnv', 's16', 'cB', 0),
    /* 38 */ G('releaseVolEnv', 's16', 'timecent', -12000),
    /* 39 */ G('keynumToVolEnvHold', 's16', 'tcent/key', 0),
    /* 40 */ G('keynumToVolEnvDecay', 's16', 'tcent/key', 0),
    /* 41 */ G('instrument', 'u16', 'index', null),
    /* 42 */ G('reserved1', 's16', '', 0),
    /* 43 */ G('keyRange', 'range', 'key', { lo: 0, hi: 127 }),
    /* 44 */ G('velRange', 'range', 'vel', { lo: 0, hi: 127 }),
    /* 45 */ G('startloopAddrsCoarseOffset', 's16', 'smpl32k', 0),
    /* 46 */ G('keynum', 's16', 'key', -1),
    /* 47 */ G('velocity', 's16', 'vel', -1),
    /* 48 */ G('initialAttenuation', 's16', 'cB', 0),
    /* 49 */ G('reserved2', 's16', '', 0),
    /* 50 */ G('endloopAddrsCoarseOffset', 's16', 'smpl32k', 0),
    /* 51 */ G('coarseTune', 's16', 'semitone', 0),
    /* 52 */ G('fineTune', 's16', 'cent', 0),
    /* 53 */ G('sampleID', 'u16', 'index', null),
    /* 54 */ G('sampleModes', 'u16', 'sampleModes', 0),
    /* 55 */ G('reserved3', 's16', '', 0),
    /* 56 */ G('scaleTuning', 's16', 'cent/key', 100),
    /* 57 */ G('exclusiveClass', 'u16', '', 0),
    /* 58 */ G('overridingRootKey', 's16', 'key', -1),
    /* 59 */ G('unused5', 's16', '', 0),
    /* 60 */ G('endOper', 's16', '', 0),
];

export const GEN = Object.freeze(Object.fromEntries(GENERATORS.map((g, i) => [g.name, i])));

export function generatorInfo(oper) {
    return GENERATORS[oper] || G(`unknown(${oper})`, 's16', '', 0);
}

/** Interpret the raw 16-bit genAmount according to the generator's kind. */
export function decodeGenAmount(oper, raw) {
    switch (generatorInfo(oper).kind) {
    case 'range': return { lo: raw & 0xff, hi: raw >> 8 };
    case 'u16': return raw;
    default: return raw >= 0x8000 ? raw - 0x10000 : raw;
    }
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function noteName(key) {
    return NOTE_NAMES[key % 12] + (Math.floor(key / 12) - 1);
}

const round = (v, d) => Number(v.toFixed(d));

/** Human readable value with unit conversion, e.g. -12000 timecent -> "0.001 s". */
// Preset-level generators are offsets added to the instrument value (spec 8.5),
// so they must not be converted as absolute times / frequencies.
const RELATIVE_UNITS = new Set(['timecent', 'abscent', 'cB', 'permille', 'pan', 'cent',
    'cent/key', 'tcent/key', 'semitone']);

function formatRelative(unit, amount) {
    const sign = amount > 0 ? '+' : '';
    switch (unit) {
    case 'timecent':
        return `${sign}${amount} tcent (×${round(Math.pow(2, amount / 1200), 3)})`;
    case 'abscent':
        return `${sign}${amount} cent (×${round(Math.pow(2, amount / 1200), 3)})`;
    case 'cB': return `${sign}${round(amount / 10, 1)} dB`;
    case 'permille':
    case 'pan': return `${sign}${round(amount / 10, 1)} %`;
    default: return `${sign}${amount} ${unit}`;
    }
}

/**
 * @param {boolean} [relative] true for preset-level generators (offsets)
 */
export function formatGenAmount(oper, amount, relative = false) {
    const info = generatorInfo(oper);
    if (relative && RELATIVE_UNITS.has(info.unit)) {
        return formatRelative(info.unit, amount);
    }
    switch (info.unit) {
    case 'key':
        if (info.kind === 'range') {
            return `${noteName(amount.lo)}–${noteName(amount.hi)} (${amount.lo}–${amount.hi})`;
        }
        return amount < 0 ? 'off' : `${noteName(amount)} (${amount})`;
    case 'vel':
        if (info.kind === 'range') return `${amount.lo}–${amount.hi}`;
        return amount < 0 ? 'off' : String(amount);
    case 'timecent': {
        if (amount <= -32768) return '0 s';
        return `${round(Math.pow(2, amount / 1200), 4)} s`;
    }
    case 'abscent':
        return `${round(8.176 * Math.pow(2, amount / 1200), 2)} Hz`;
    case 'cB': return `${round(amount / 10, 1)} dB`;
    case 'permille': return `${round(amount / 10, 1)} %`;
    case 'pan':
        if (amount === 0) return 'center';
        return `${round(Math.abs(amount) / 10, 1)} % ${amount < 0 ? 'L' : 'R'}`;
    case 'cent': return `${amount} cent`;
    case 'cent/key': return `${amount} cent/key`;
    case 'tcent/key': return `${amount} tcent/key`;
    case 'semitone': return `${amount} semitone`;
    case 'smpl': return `${amount} smpl`;
    case 'smpl32k': return `${amount} × 32768 smpl`;
    case 'sampleModes':
        return ['no loop', 'loop', 'unused(2)', 'loop + release'][amount & 3] || String(amount);
    default:
        return String(amount);
    }
}

// --- Modulators ---

const GENERAL_CONTROLLERS = {
    0: 'noController', 2: 'noteOnVelocity', 3: 'noteOnKeyNumber',
    10: 'polyPressure', 13: 'channelPressure', 14: 'pitchWheel',
    16: 'pitchWheelSensitivity', 127: 'link',
};
const SOURCE_TYPES = ['linear', 'concave', 'convex', 'switch'];
const TRANSFORMS = { 0: 'linear', 2: 'absolute' };

/** Decode SFModulator (source operator) bit fields. */
export function decodeModSource(bits) {
    const index = bits & 0x7f;
    const cc = (bits >> 7) & 1;
    return {
        raw: bits,
        index,
        cc: !!cc,
        direction: (bits >> 8) & 1 ? 'max→min' : 'min→max',
        polarity: (bits >> 9) & 1 ? 'bipolar' : 'unipolar',
        type: SOURCE_TYPES[bits >> 10] || `type${bits >> 10}`,
        controller: cc ? `CC${index}` : (GENERAL_CONTROLLERS[index] || `general${index}`),
    };
}

export function formatModSource(src) {
    if (!src.cc && src.index === 0) return '—';
    return `${src.controller} (${src.type}, ${src.polarity}, ${src.direction})`;
}

export function transformName(t) {
    return TRANSFORMS[t] || `transform${t}`;
}
