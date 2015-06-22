var assert = require('chai').assert;

var cwd = process.cwd(),
    fs = require('fs');

var Template = require(cwd + '/src/js/app/model/template');

var faceYAMLPath = cwd + '/test/fixtures/face.yml',
    faceJSON = {
    "mouth":{ "points":6 },
    "nose":{ "points":3, "connectivity": ["0 1", "1 2"] },
    "l_eye":{ "points":8, "connectivity": ["0:7", "7 0"] },
    "r_eye":{ "points":8, "connectivity":"cycle" },
    "chin":1
};

// Taken from python server
var LJSON2D = require(cwd + '/test/fixtures/face_2d_ljson.json');
var LJSON3D = require(cwd + '/test/fixtures/face_3d_ljson.json');


describe('Template$constructor', function () {
    var tmpl;

    before(function () {
        tmpl = new Template(faceJSON);
    });

    it('should have the correct size', function () {
        assert.equal(26, tmpl.size);
    });

    it('should have the corrects groups', function () {
        assert.equal(5, tmpl.groups.length);
        tmpl.groups.forEach(function (g) {
            assert.include(
                ['mouth', 'nose', 'l_eye', 'r_eye', 'chin'],
                g.label
            );
        });
    });
});

describe('Template$parseYAML', function () {
    var yamlTmpl, jsonTmpl;

    before(function (done) {
        var faceYAML = fs.readFile(faceYAMLPath, function (err, data) {
            if (err) {
                throw err;
            }
            yamlTmpl = Template.parseYAML(data);
            jsonTmpl = new Template(faceJSON);
            done();
        });
    });

    it('should have the same JSON representation', function () {
        assert.deepEqual(yamlTmpl.toJSON(), jsonTmpl.toJSON());
    });
});

describe('Template#emptyLJSON', function () {
    var tmpl;

    before(function () {
        tmpl = new Template(faceJSON);
    });

    it('should return correct LJSON in 2D', function () {
        var ljson = tmpl.emptyLJSON(2);
        assert.deepEqual(ljson, LJSON2D);
    });

    it('should return correct LJSON in 3D', function () {
        var ljson = tmpl.emptyLJSON(3);
        assert.deepEqual(ljson, LJSON3D);
    });
});
