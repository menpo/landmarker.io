/**
 *
 * Adapted from https://github.com/mrdoob/three.js/blob/master/examples/js/loaders/STLLoader.js
 * to use in our context.
 *
 * Only keeps the parsing part, no Loader class
 */

'use strict';

var THREE = require('three');

function isBinary(binData) {

    var expect;
    var faceSize;
    var nFaces;
    var reader;
    reader = new DataView(binData);
    faceSize = (32 / 8 * 3) + ((32 / 8 * 3) * 3) + (16 / 8);
    nFaces = reader.getUint32(80, true);
    expect = 80 + (32 / 8) + (nFaces * faceSize);

    if (expect === reader.byteLength) {
        return true;
    }
    // some binary files will have different size from expected,
    // checking characters higher than ASCII to confirm is binary
    var fileLength = reader.byteLength;
    for (var index = 0; index < fileLength; index++) {
        if (reader.getUint8(index, false) > 127) {
            return true;
        }
    }

    return false;
}

function parse(data) {
    console.time('STLLoader');
    var binData = ensureBinary(data);
    const geo = isBinary(binData) ?
                parseBinary(binData) : parseASCII(ensureString(data));
    console.timeEnd('STLLoader');
    return geo;
}

function parseBinary(data) {

    var reader = new DataView(data);
    var faces = reader.getUint32(80, true);

    var r;
    var g;
    var b;
    var hasColors = false;
    var colors;
    var defaultR;
    var defaultG;
    var defaultB;
    var alpha;

    // process STL header
    // check for default color in header ("COLOR=rgba" sequence).
    for (var index = 0; index < 80 - 10; index++) {
        if ((reader.getUint32(index, false) === 0x434F4C4F /*COLO*/ ) &&
            (reader.getUint8(index + 4) === 0x52 /*'R'*/ ) &&
            (reader.getUint8(index + 5) === 0x3D /*'='*/ )) {

            hasColors = true;
            colors = new Float32Array(faces * 3 * 3);

            defaultR = reader.getUint8(index + 6) / 255;
            defaultG = reader.getUint8(index + 7) / 255;
            defaultB = reader.getUint8(index + 8) / 255;
            alpha = reader.getUint8(index + 9) / 255;
        }
    }

    var dataOffset = 84;
    var faceLength = 12 * 4 + 2;

    var offset = 0;

    var geometry = new THREE.BufferGeometry();

    var vertices = new Float32Array(faces * 3 * 3);
    var normals = new Float32Array(faces * 3 * 3);

    for (var face = 0; face < faces; face++) {
        var start = dataOffset + face * faceLength;
        var normalX = reader.getFloat32(start, true);
        var normalY = reader.getFloat32(start + 4, true);
        var normalZ = reader.getFloat32(start + 8, true);

        if (hasColors) {
            var packedColor = reader.getUint16(start + 48, true);
            if ((packedColor & 0x8000) === 0) { // facet has its own unique color
                r = (packedColor & 0x1F) / 31;
                g = ((packedColor >> 5) & 0x1F) / 31;
                b = ((packedColor >> 10) & 0x1F) / 31;
            } else {
                r = defaultR;
                g = defaultG;
                b = defaultB;
            }
        }

        for (var i = 1; i <= 3; i++) {
            var vertexstart = start + i * 12;

            vertices[offset] = reader.getFloat32(vertexstart, true);
            vertices[offset + 1] = reader.getFloat32(vertexstart + 4, true);
            vertices[offset + 2] = reader.getFloat32(vertexstart + 8, true);

            normals[offset] = normalX;
            normals[offset + 1] = normalY;
            normals[offset + 2] = normalZ;

            if (hasColors) {
                colors[offset] = r;
                colors[offset + 1] = g;
                colors[offset + 2] = b;
            }

            offset += 3;
        }
    }

    geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));

    if (hasColors) {
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.hasColors = true;
        geometry.alpha = alpha;
    }

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
}

function parseASCII(data) {

    let nx, ny, nz, vx, vy, vz,
        line, result, state;

    const normals = [], vertices = [];
    const lines = Array.isArray(data) ? data : data.split('\n');

    const PATTERN_SOLID = /^solid.*$/,
          PATTERN_SOLID_END = /^endsolid.*$/,
          PATTERN_FACET = /^facet\s*normal\s+([\d|\.|\+|\-|e|E]+)\s+([\d|\.|\+|\-|e|E]+)\s+([\d|\.|\+|\-|e|E]+)$/,
          PATTERN_FACET_END = /^endfacet$/,
          PATTERN_LOOP = /^outer\s*loop$/,
          PATTERN_LOOP_END = /^endloop$/,
          PATTERN_VERTEX = /^vertex\s+([\d|\.|\+|\-|e|E]+)\s+([\d|\.|\+|\-|e|E]+)\s+([\d|\.|\+|\-|e|E]+)$/;

    for (let i = 0, len = lines.length; i < len; i++) {
        line = lines[i].trim();

        if (line === '') {
            continue; // Ignore empty lines
        }

        if ((result = PATTERN_SOLID.exec(line)) !== null) {
            if (state || i > 0) {
                throw new Error('"solid" should be at the start of the file, ' +
                                `found at line ${i}`);
            } else {
                state = 'SOLID';
            }
        } else if ((result = PATTERN_SOLID_END.exec(line)) !== null) {
            // End of the solid definition, get out
            if (state === 'SOLID') {
                break;
            } else {
                throw new Error(`Unexcpected "endsolid" at line ${i}`);
            }
        } else if ((result = PATTERN_FACET.exec(line)) !== null) {
            if (state === 'SOLID') {
                state = 'FACET';
                [nx, ny, nz] = result.slice(1, 4).map(parseFloat);
            } else {
                throw new Error(`Unexcpected "facet" at line ${i}`);
            }
        } else if ((result = PATTERN_FACET_END.exec(line)) !== null) {
            if (state === "FACET") {
                state = 'SOLID';
            } else {
                throw new Error(`Unexcpected "endfacet" at line ${i}`);
            }
        } else if ((result = PATTERN_LOOP.exec(line)) !== null) {
            if (state === 'FACET') {
                state = 'LOOP';
            } else {
                throw new Error(`Unexcpected "outerloop" at line ${i}`);
            }
        } else if ((result = PATTERN_LOOP_END.exec(line)) !== null) {
            if (state === 'LOOP') {
                state = 'FACET';
            } else {
                throw new Error(`Unexcpected "endloop" at line ${i}`);
            }
        } else if ((result = PATTERN_VERTEX.exec(line)) !== null) {
            if (state === 'LOOP') {
                [vx, vy, vz] = result.slice(1, 4).map(parseFloat);
                vertices.push(vx, vy, vz);
                normals.push(nx, ny, nz);
            } else {
                throw new Error(`Unexcpected "vertex" at line ${i}`);
            }
        } else {
            throw new Error(`Unrecognized line (${i}): "${line}"`);
        }
    }

    const geometry = new THREE.BufferGeometry();

    geometry.addAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(vertices), 3)
    );

    geometry.addAttribute(
        'normal',
        new THREE.BufferAttribute(new Float32Array(normals), 3)
    );

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;

}

function ensureString(buf) {

    if (typeof buf !== "string") {
        var arrayBuffer = new Uint8Array(buf);
        var lines = [], str = '', char;
        for (var i = 0; i < buf.byteLength; i++) {
            char = String.fromCharCode(arrayBuffer[i]);
            if (char === '\n') {
                lines.push(str);
                str = '';
            } else {
                str += char;
            }
        }
        return lines;
    } else {
        return buf;
    }

}

function ensureBinary(buf) {

    if (typeof buf === "string") {
        var arrayBuffer = new Uint8Array(buf.length);
        for (var i = 0; i < buf.length; i++) {
            arrayBuffer[i] = buf.charCodeAt(i) & 0xff; // implicitly assumes little-endian
        }
        return arrayBuffer.buffer || arrayBuffer;
    } else {
        return buf;
    }

}

module.exports = parse;
