// Generic RIFF chunk walker.
// Knows nothing about SoundFont: it only turns bytes into a chunk tree.

export class RiffError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RiffError';
    }
}

export function readFourCC(view, offset) {
    return String.fromCharCode(
        view.getUint8(offset), view.getUint8(offset + 1),
        view.getUint8(offset + 2), view.getUint8(offset + 3));
}

/**
 * Parse a RIFF file.
 * @param {ArrayBuffer} buffer
 * @returns {{id:'RIFF', type:string, offset:number, size:number, children:Chunk[]}}
 *
 * Chunk = { id, offset (start of data), size (data bytes), type?, children? }
 * `type` and `children` exist only for RIFF / LIST chunks.
 */
export function parseRiff(buffer) {
    const view = new DataView(buffer);
    if (view.byteLength < 12) {
        throw new RiffError('file too short for a RIFF header');
    }
    const root = readChunk(view, 0, view.byteLength);
    if (root.chunk.id !== 'RIFF') {
        throw new RiffError(`not a RIFF file (found "${root.chunk.id}")`);
    }
    return root.chunk;
}

function readChunk(view, offset, limit) {
    if (offset + 8 > limit) {
        throw new RiffError(`chunk header at ${offset} runs past end (${limit})`);
    }
    const id = readFourCC(view, offset);
    const size = view.getUint32(offset + 4, true);
    const dataOffset = offset + 8;
    const dataEnd = dataOffset + size;
    if (dataEnd > limit) {
        throw new RiffError(`chunk "${id}" at ${offset} (size ${size}) runs past end (${limit})`);
    }
    const chunk = { id, offset: dataOffset, size };
    if (id === 'RIFF' || id === 'LIST') {
        if (size < 4) {
            throw new RiffError(`${id} chunk at ${offset} has no form type`);
        }
        chunk.type = readFourCC(view, dataOffset);
        chunk.children = [];
        let o = dataOffset + 4;
        while (o + 8 <= dataEnd) {
            const child = readChunk(view, o, dataEnd);
            chunk.children.push(child.chunk);
            o = child.next;
        }
    }
    // RIFF chunks are padded to an even length.
    return { chunk, next: dataEnd + (size & 1) };
}

/** Find a direct child: findChunk(list, 'LIST', 'pdta') or findChunk(list, 'phdr'). */
export function findChunk(parent, id, type) {
    return (parent.children || []).find(
        c => c.id === id && (type === undefined || c.type === type)) || null;
}
