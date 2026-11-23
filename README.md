# sf2.js

SoundFont 2 (.sf2) parser and browser viewer. No dependencies, no build step.

## Layers

```
src/riff.js        bytes  -> RIFF chunk tree (generic, pad-byte aware)
src/hydra.js       pdta   -> 9 raw record arrays, table driven, validated
src/generators.js  generator / modulator definitions, unit formatting
src/model.js       hydra  -> Preset -> Zone[] -> Instrument -> Zone[] -> Sample
src/soundfont.js   facade: parseSoundFont(), INFO, PCM decoding (smpl + sm24)
viewer/            browser UI; depends only on src/soundfont.js
test/              node:test against sample/emuaps_8mb.sf2
```

Each layer only reads the one below it. The model is built eagerly in one
linear pass (≈15 ms for the 7.6 MB sample); every Instrument / Sample object
is created once and shared. Terminal records (EOP/EOI/EOS) are not exposed.

## Library

```js
import { parseSoundFont } from './src/soundfont.js';

const sf = parseSoundFont(arrayBuffer);
const piano = sf.findPreset(0, 0);
for (const zone of piano.zones) {
    console.log(zone.keyRange, zone.instrument.name);
}
const { data, sampleRate, loopStart, loopEnd } = sf.getSampleData(sf.samples[0]);
```

Parse errors throw `RiffError`. Non-fatal problems are collected in `sf.warnings`.

## Viewer

```sh
npm run serve      # python3 -m http.server 8000
open http://localhost:8000/viewer/
```

Open or drop any .sf2 file, or pass `?url=path/to/file.sf2`.
Presets / instruments / samples are linked both ways (`usedBy`), shown with a
key-range map, named generators with converted units, decoded modulators, and
a min/max waveform with loop-seam view and playback.

## Test

```sh
npm test
```
