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
    var face_size;
    var n_faces;
    var reader;
    reader = new DataView(binData);
    face_size = (32 / 8 * 3) + ((32 / 8 * 3) * 3) + (16 / 8);
    n_faces = reader.getUint32(80, true);
    expect = 80 + (32 / 8) + (n_faces * face_size);

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
    var binData = ensureBinary(data);
    return isBinary(binData) ?
           parseBinary(binData) : parseASCII(ensureString(data));
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

    return geometry;
}

function parseASCII(data) {

    var geometry;
    var length;
    var normal;
    var patternFace;
    var patternNormal;
    var patternVertex;
    var result;
    var text;
    geometry = new THREE.Geometry();
    patternFace = /facet([\s\S]*?)endfacet/g;

    while ((result = patternFace.exec(data)) !== null) {

        text = result[0];
        patternNormal = /normal[\s]+([\-+]?[0-9]+\.?[0-9]*([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+/g;

        while ((result = patternNormal.exec(text)) !== null) {
            normal = new THREE.Vector3(parseFloat(result[1]), parseFloat(result[3]), parseFloat(result[5]));
        }

        patternVertex = /vertex[\s]+([\-+]?[0-9]+\.?[0-9]*([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+/g;

        while ((result = patternVertex.exec(text)) !== null) {
            geometry.vertices.push(new THREE.Vector3(parseFloat(result[1]), parseFloat(result[3]), parseFloat(result[5])));
        }

        length = geometry.vertices.length;

        geometry.faces.push(new THREE.Face3(length - 3, length - 2, length - 1, normal));

    }

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;

}

function ensureString(buf) {

    if (typeof buf !== "string") {
        var array_buffer = new Uint8Array(buf);
        var str = '';
        for (var i = 0; i < buf.byteLength; i++) {
            str += String.fromCharCode(array_buffer[i]); // implicitly assumes little-endian
        }
        return str;
    } else {
        return buf;
    }

}

function ensureBinary(buf) {

    if (typeof buf === "string") {
        var array_buffer = new Uint8Array(buf.length);
        for (var i = 0; i < buf.length; i++) {
            array_buffer[i] = buf.charCodeAt(i) & 0xff; // implicitly assumes little-endian
        }
        return array_buffer.buffer || array_buffer;
    } else {
        return buf;
    }

}

module.exports = parse;
