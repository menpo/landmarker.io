'use strict';

var assert = require('chai').assert;

var cwd = process.cwd();
var fs = require('fs');

var Template = require(cwd + '/src/js/app/template');

var faceYAMLPath = cwd + '/test/fixtures/face.yml',
    faceJSON = {
        'groups': [
            {
                'label': 'mouth',
                'points': 6
            },
            {
                'label': 'nose',
                'points': 3,
                'connectivity': ['0 1', '1 2']
            },
            {
                'label': 'l_eye',
                'points': 8,
                'connectivity': ['0:7', '7 0']
            },
            {
                'label': 'r_eye',
                'points': 8,
                'connectivity': 'cycle'
            },
            {
                'label': 'chin',
                'points': 1
            }
        ]
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
    var yamlTmpl, jsonTmpl, faceYAML;

    before(function (done) {
        fs.readFile(faceYAMLPath, function (err, data) {
            if (err) {
                throw err;
            }
            faceYAML = data.toString();
            yamlTmpl = Template.parseYAML(faceYAML);
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

describe('Template$parseLJSON', function () {
    var ljsonTmpl, jsonTmpl;

    before(function () {
        jsonTmpl = new Template(faceJSON);
    });

    it('should have the correct data', function () {
        ljsonTmpl = Template.parseLJSON(jsonTmpl.emptyLJSON(2));
        assert.deepEqual(ljsonTmpl.groups, jsonTmpl.groups);
        assert.deepEqual(ljsonTmpl.size, jsonTmpl.size);
    });

    it('should accept a string', function () {
        ljsonTmpl = Template.parseLJSON(JSON.stringify(jsonTmpl.emptyLJSON(2)));
        assert.deepEqual(ljsonTmpl.groups, jsonTmpl.groups);
        assert.deepEqual(ljsonTmpl.size, jsonTmpl.size);
    });
});

describe('Template$parseJSON', function () {
    var jsonTmpl2, jsonTmpl;

    before(function () {
        jsonTmpl = new Template(faceJSON);
    });

    it('should accept a string', function () {
        jsonTmpl2 = Template.parseJSON(JSON.stringify(faceJSON));
        assert.deepEqual(jsonTmpl2.groups, jsonTmpl.groups);
        assert.deepEqual(jsonTmpl2.size, jsonTmpl.size);
    });
});
