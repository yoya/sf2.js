function viewBanksPresets(sf) {
    console.debug("viewBanksPresets(sf)");
    console.debug(sf);
    var sftitle = document.getElementById('sftitle');
    sftitle.innerHTML = "Banks and Presets";
    var sfback = document.getElementById('sfback');
    sfback.style.visibility = "hidden";
    var sftable = document.getElementById('sftable');
    sftable.innerHTML = null;
    var banks = sf.banks
    var tr = document.createElement('tr');
    var th, td;
    var preset_keylist = ['bank', 'preset', 'name', 'bagNdx', 'library', 'genre'];
    for (idx in preset_keylist) {
        th = document.createElement('th');
        th.innerHTML = preset_keylist[idx];
        tr.appendChild(th);
    }
    sftable.appendChild(tr)
    for (var bankId in banks) {
        var nPreset = 0;
        for (var presetId in banks[bankId]) {
            nPreset++;
        }
        var prevBank = null;
        for (var presetId in banks[bankId]) {
            var preset = banks[bankId][presetId];
            tr = document.createElement('tr');
            for (idx in preset_keylist) {
                var key = preset_keylist[idx];
                var value = preset[key];
                if (key === 'bank' && prevBank === bankId) {
                    continue; // for rowSpan
                }
                td = document.createElement('td');
                td.innerHTML = value;
                if (key === 'bank') {
                    td.setAttribute('rowSpan', nPreset);
                }
                if (key === 'bagNdx') {
                    button = document.createElement('button');
                    td.innerHTML = null;
                    button.innerHTML = value;
                    button.addEventListener('click', viewBags.bind(this, sf, preset, null), false);
                    td.appendChild(button);
                }
                tr.appendChild(td);
                prevBank = bankId;
            }
            sftable.appendChild(tr);
        }
    }
}

function viewBags(sf, preset, inst) {
    console.debug("viewBags(fs, preset_inst)");
    var preset_inst = (inst === null)?preset:inst;
    console.debug(preset_inst);
    var bags = preset_inst['bags'];
    var canvas_wave = document.getElementById("wave");
    var canvas_waveloop = document.getElementById("waveloop");
    canvas_wave.style.visibility = "hidden";
    canvas_waveloop.style.visibility = "hidden";
    var sftitle = document.getElementById('sftitle');
    if (! inst) {
        sftitle.innerHTML = "Bags:"+preset_inst['name'];
    } else {
        sftitle.innerHTML = "InstBags:"+preset_inst['name'];
    }
    var sfback = document.getElementById('sfback');
    sfback.style.visibility = "visible";
    sfback.innerHTML = "back";
    if (inst === null) {
        sfback.addEventListener('click', viewBanksPresets.bind(this, sf), false);
    } else {
        sfback.addEventListener('click', viewBags.bind(this, sf, preset, null), false);
    }
    var sftable = document.getElementById('sftable');
    sftable.innerHTML = null;
    var prevBag = null;
    mod_keylist = ['type', 'p', 'd', 'cc', 'index'];
    for (var bagId = 0, n = bags.length ; bagId < n ; bagId++) {
        var bag = bags[bagId];
        var gens = bag['gens']; 
        var mods = bag['mods'];
        var nGens = 0;
        var nMods = 0;
        for (oper in gens) { nGens++; }
        for (modIdx in mods) { nMods++; }
        for (oper in gens) {
            var gen = gens[oper];
            tr = document.createElement('tr');
            if (bagId !== prevBag) {
                td = document.createElement('td');
                td.innerHTML = bagId;
                td.setAttribute('rowSpan', nGens+nMods);
                tr.appendChild(td);
                prevBag = bagId;
            }
            var gen_value = [];
            gen_value.push('oper:'+oper);
            if (oper == 43 || oper == 44) {
                gen_value.push("lo:"+gen['lo']+"=>hi:"+gen['hi']);
            } else {
                gen_value.push("amount:"+gen['amount']);
            }
            td = document.createElement('td');
            td.innerHTML = gen_value.join(', ');
            if (oper == 41) { // instrument
                button = document.createElement('button');
                button.innerHTML = "inst:"+gen['amount'];
                var inst = gen['inst'];
                button.addEventListener('click', viewInstrument.bind(this, sf, preset, inst), false);
                td.appendChild(button);
            } else if (oper == 53) {// sampleID
                button = document.createElement('button');
                button.innerHTML = "sample:"+gen['amount'];
                var sample = gen['sample'];
                button.addEventListener('click', viewSample.bind(this, sf, preset, inst, sample), false);
                td.appendChild(button);
            }
            tr.appendChild(td);
            sftable.appendChild(tr);
        }
        for (modIdx in mods) {
            var mod = mods[modIdx];
            tr = document.createElement('tr');
            if (bagId !== prevBag) {
                td = document.createElement('td');
                td.setAttribute('rowSpan', nGens+nMods);
                tr.appendChild(td);
                prevBag = bagId;                
            }
            var mod_value = [];
            for (idx in mod_keylist) {
                var key = mod_keylist[idx];
                mod_value.push(key+":"+mod[key]);
            }
            td = document.createElement('td');
            td.innerHTML = mod_value.join(', ');
            tr.appendChild(td);
            sftable.appendChild(tr);
        }
    }
}

function viewInstrument(sf, preset, inst) {
    console.debug("viewInstrument(sf, preset, inst)");
    console.debug(inst);
    viewBags(sf, preset, inst);
}

function viewSample(sf, preset, inst, sample) {
    console.debug("viewSample(sf, preset, inst, sample)");
    console.debug(sample);
    var context = new webkitAudioContext();
    var src = context.createBufferSource();
    src.disconnect(context.destination);
    var sftitle = document.getElementById('sftitle');    
    sftitle.innerHTML = "Sample:"+sample['name'];
    var sfback = document.getElementById('sfback');
    sfback.style.visibility = "visible";
    sfback.innerHTML = "back";
    sfback.addEventListener('click', viewBags.bind(this, sf, preset, inst, false));
    sample_keylist = ['name', 'start', 'end', 'startLoop', 'endLoop', 'sampleRate', 'originalPitch', 'pitchCorrection', 'sampleLink', 'sampleType'];
    var sftable = document.getElementById('sftable');
    
    sftable.innerHTML = null;
    for (idx in sample_keylist) {
        var key = sample_keylist[idx];
        tr = document.createElement('tr');
        td = document.createElement('td');
        td.innerHTML = key+":"+sample[key];
        tr.appendChild(td);
        sftable.appendChild(tr);
    }
    var start     = sample['start']; // maybe, sample offset (not byte offset)
    var end       = sample['end'];
    var startLoop = sample['startLoop'];
    var endLoop   = sample['endLoop'];
    var sampleTable = new Uint8Array(sf.sfbuffer, sf.stda.smpl['offset']); // XXX depend that native endian is little endian.
    var waveTableLength = end - start + 1;
    console.log("waveTableLength:"+waveTableLength);
    var waveTable = new Float32Array(waveTableLength);
    for (i = 0, j= 2*start ; i < waveTableLength; i++) {
        var v = sampleTable[j++] + 0x100 * sampleTable[j++];
        v = (v < 0x8000)?v:(v - 0x10000);
        waveTable[i] = v / 0x8000;
    }
    var waveLoopLength = endLoop - startLoop + 1;
    var waveLoopTable = new Float32Array(waveLoopLength);
    for (i = 0, j = 2*startLoop  ; i < waveLoopLength; i++) {
        var v = sampleTable[j++] + 0x100 * sampleTable[j++];
        v = (v < 0x8000)?v:(v - 0x10000);
        waveLoopTable[i] = v / 0x8000;
    }
    var canvas_wave = document.getElementById("wave");
    var canvas_waveloop = document.getElementById("waveloop");
    canvas_wave.style.visibility = "visible";
    canvas_waveloop.style.visibility = "visible";

    var width_wave = canvas_wave.width;
    var width_waveloop = canvas_waveloop.width;
    var height_wave = canvas_wave.height;
    var height_waveloop = canvas_waveloop.height;
    var ctx_wave = canvas_wave.getContext('2d');    
    var ctx_waveloop = canvas_waveloop.getContext('2d');
    canvas_wave.style.backgroundColor = "rgb(10, 10, 30)";
    canvas_waveloop.style.backgroundColor = "rgb(70, 0, 0)";
    // wave
    ctx_wave.fillStyle = "rgb(70, 0, 0)";
    var x_startLoop = width_wave * (startLoop-start) / (end-start+1) ;
    var x_endLoop = width_wave * (endLoop-start) / (end-start+1);
    ctx_wave.beginPath();
    ctx_wave.lineTo(x_startLoop, 0);
    ctx_wave.lineTo(x_startLoop, height_wave);
    ctx_wave.lineTo(x_endLoop, height_wave);
    ctx_wave.lineTo(x_endLoop, 0);
    ctx_wave.fill();
    ctx_wave.beginPath();
    ctx_wave.strokeStyle = "rgb(200, 255, 255)";
    for (x = 0 ; x < width_wave ; x++) {
        var idx = (x * (waveTableLength / width_wave)) | 0;
        var y = (height_wave / 2) - (height_wave / 2) * waveTable[idx];
        ctx_wave.lineTo(x, y);
    }
    ctx_wave.stroke();
    // waveLoop
    ctx_waveloop.strokeStyle = "rgb(200, 255, 255)";
    ctx_waveloop.beginPath();
    for (x = 0 ; x < width_waveloop ; x++) {
        var idx = (x * (waveLoopLength / width_waveloop)) | 0;
        var y = (height_waveloop / 2) - (height_waveloop / 2) * waveLoopTable[idx];
        ctx_waveloop.lineTo(x, y);
    }
    ctx_waveloop.stroke();
    //
    var src = context.createBufferSource();
    var buf = context.createBuffer(1, waveLoopLength, context.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0 ; i < waveLoopLength ; i++) {
        data[i] = waveLoopTable[i];
    }
    src.buffer = buf;
    src.loop = true;
    src.connect(context.destination);
    src.noteOn(0);
}