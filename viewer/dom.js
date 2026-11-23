// Tiny DOM builder. Strings always become text nodes (never innerHTML),
// so names read from a SoundFont file cannot inject markup.

export function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v === null || v === undefined || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') {
            el.addEventListener(k.slice(2), v);
        } else if (k === 'class') {
            el.className = v;
        } else if (k === 'style' && typeof v === 'object') {
            Object.assign(el.style, v);
        } else {
            el.setAttribute(k, v === true ? '' : v);
        }
    }
    append(el, children);
    return el;
}

function append(el, children) {
    for (const c of children) {
        if (c === null || c === undefined || c === false) continue;
        if (Array.isArray(c)) append(el, c);
        else el.append(c instanceof Node ? c : String(c));
    }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs, ...children) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v === null || v === undefined) continue;
        if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v);
    }
    append(el, children);
    return el;
}

export function clear(el) {
    el.replaceChildren();
    return el;
}
