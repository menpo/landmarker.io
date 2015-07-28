/**
 *
 * Adapted from https://github.com/mrdoob/three.js/blob/master/examples/js/loaders/STLLoader.js
 * to use in our context.
 *
 * Only keeps the parsing part, no Loader class
 */

'use strict';

import THREE from 'three';

export default function parse (data) {
    console.time('STLLoader');
    const binData = ensureBinary(data);
    const geo = isBinary(binData) ? parseBinary(binData) : parseASCII(binData);
    console.timeEnd('STLLoader');
    return geo;
}

function parseBinary (data) {

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

function isBinary(binData) {
    let expect, faceSize, nFaces, reader;
    reader = new DataView(binData);
    faceSize = (32 / 8 * 3) + ((32 / 8 * 3) * 3) + (16 / 8);
    nFaces = reader.getUint32(80, true);
    expect = 80 + (32 / 8) + (nFaces * faceSize);

    if (expect === reader.byteLength) {
        return true;
    }

    // THREE.js does an additional check now as some files are poorly formed:
    // https://github.com/mrdoob/three.js/pull/5840
    //
    // This is actually very expensive for large ASCII files. I'd rather leave
    // this out for now (and risk not being able to open some malformed
    // binary STLs) than suffer the performance cost (unfortunately large
    // ASCII STLs seem worryingly common in the medical community).

    //// some binary files will have different size from expected,
    //// checking characters higher than ASCII to confirm is binary
    //var fileLength = reader.byteLength;
    //for (var index = 0; index < fileLength; index++) {
    //    if (reader.getUint8(index, false) > 127) {
    //        return true;
    //    }
    //}
    //

    return false;
}

function ensureBinary(buf) {
    if (typeof buf === "string") {
        const arrayBuffer = new Uint8Array(buf.length);
        for (var i = 0; i < buf.length; i++) {
            arrayBuffer[i] = buf.charCodeAt(i) & 0xff; // implicitly assumes little-endian
        }
        return arrayBuffer.buffer || arrayBuffer;
    } else {
        return buf;
    }
}

function countVertices(a) {
    let nVertices = 0, i = 0;
    while (i < a.length) {
        if (isStringInUnit8ArrayAtPosition(a, i, VERTEX_STRING)) {
            nVertices += 1;
            i += VERTEX_STRING.length;
        } else {
            i += 1;
        }
    }
    return nVertices;
}

const VERTEX_STRING = 'vertex';
const PATTERN_VERTEX = /^vertex\s+([\d|\.|\+|\-|e|E]+)\s+([\d|\.|\+|\-|e|E]+)\s+([\d|\.|\+|\-|e|E]+)$/;

function isStringInUnit8ArrayAtPosition(a, i, str) {
    for (var j = 0; j < str.length; j++) {
        if (i + j >= a.length || String.fromCharCode(a[i + j]) !== str[j]) {
            return false;
        }
    }
    return true;
}

function extractStringUntilSentinelFromUnit8ArrayAtPosition(a, i, sentinal) {
    let str = "", c;
    const len = a.length;
    while (i < len) {
        if ((c = String.fromCharCode(a[i])) === sentinal) {
            return str;
        }
        str += c;
        i += 1;
    }
    // we ran out of the array, and the last character wasn't the sentinel.
    // Return an empty string.
    return "";
}

function parseASCII(arrayBuffer) {
    const a = new Uint8Array(arrayBuffer);
    let i = 0;
    let vertexNo = 0;
    let line, vx, vy, vz, result;
    const len = a.length;
    // find the number of vertices in the file and allocate the buffer
    const nVertices = countVertices(a);
    const vertices = new Float32Array(nVertices * 3);
    while (i < len) {
        if (isStringInUnit8ArrayAtPosition(a, i, VERTEX_STRING)) {
            line = extractStringUntilSentinelFromUnit8ArrayAtPosition(a, i, "\n");
            if ((result = PATTERN_VERTEX.exec(line)) !== null) {
                [vx, vy, vz] = result.slice(1, 4).map(parseFloat);
                vertices[3 * vertexNo] = vx;
                vertices[(3 * vertexNo) + 1] = vy;
                vertices[(3 * vertexNo) + 2] = vz;
                vertexNo += 1;
            } else {
                throw new Error(`Unexpected "vertex" at vertex count ${vertexNo}`);
            }
            // budge along to the next line
            i += line.length;
        } else {
            // not 'vertex...' - just go to the next character
            i += 1;
        }
    }

    const geometry = new THREE.BufferGeometry();

    geometry.addAttribute(
        'position',
        new THREE.BufferAttribute(vertices, 3)
    );

    geometry.computeFaceNormals();
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;

}
