"use strict";

var yaml = require('js-yaml'),
    _ = require('underscore');

var CYCLE_CONNECTIVITY_LABELS = ['cycle', 'circular'];
var NULL_POINT = {2: [null, null], 3: [null, null, null]};

/**
 * @class Template
 * Representation of a landmarks template, can be exported to JSON and YAML
 * and parsed from YAML or JSON
 *
 * @param {Object} json
 */
function Template (json) {
    this._template = json;
    this._emptyLmGroup = { 2: undefined, 3: undefined };

    this.size = 0;
    this.groups = [];

    Object.keys(this._template).forEach((label) => {

        let group = this._template[label],
            connectivity = [],
            size;

        if (!isNaN(group)) {
            size = Number(group);
        } else {
            let rawConnectivity = group['connectivity'] || [];
            size = group['points'];

            if (CYCLE_CONNECTIVITY_LABELS.indexOf(rawConnectivity) > -1) {
                rawConnectivity = [`0:${size - 1}`, `${size - 1} 0`];
            } else if (!Array.isArray(connectivity)) {
                rawConnectivity = [];
            }

            rawConnectivity.forEach(function (item) {
                if (item.indexOf(':') > -1) {
                    let [start, end] = item.split(':').map(Number);
                    for (var i = start; i < end; i++) {
                        connectivity.push([i, i+1]);
                    }
                } else {
                    connectivity.push(item.split(' ').map(Number));
                }
            });
        }

        this.groups.push({label, size, connectivity });
        this.size += size;
    });
}

/**
 * parseYAML: read a YAML file and return a valid Template
 * @param  {string} rawData
 * @return {Template}
 */
Template.parseYAML = function (rawData) {
    let json = yaml.safeLoad(rawData);
    return new Template(json);
}

// For compatibility
Template.parseJSON = function (json) {
    return new Template(json);
}

/**
 * Reverse LJSON from previous landmark and return a compliant template
 * @param  {Object} ljson
 * @return {Template}
 */
Template.parseLJSON = function (ljson) {
    let template = {};
    ljson.labels.forEach(function ({label, mask}) {
        template[label] = {points: mask.length, connectivity: []};
        ljson.landmarks.connectivity.forEach(function ([x1, x2]) {
            if (mask.indexOf(x1) > -1) {
                let offset = mask[0]
                template[label].connectivity.push(
                    `${x1 - offset} ${x2 - offset}`);
            }
        });
    });
    return new Template(template);
}

Template.Parsers = {
    'yaml': Template.parseYAML,
    'yml': Template.parseYAML,
    'json': Template.parseJSON,
    'ljson': Template.parseLJSON
}

Template.prototype.toYAML = function () {
    return yaml.safeDump(this._template);
}

Template.prototype.toJSON = function () {
    return JSON.stringify(this._template);
}

/**
 * Lazily return empty landmarking data to be used with a new asset and usable
 * through LandmarkGroup
 * @param  {Number} dims=2
 * @return {Object}
 */
Template.prototype.emptyLJSON = function (dims=2) {

    if (this._emptyLmGroup[dims]) {
        return _.clone(this._emptyLmGroup[dims])
    }

    let offset = 0,
        globalConnectivity = [],
        labels = [];

    this.groups.forEach(function ({label, size, connectivity}) {
        connectivity.forEach(function ([s, e]) {
            globalConnectivity.push([s + offset, e + offset]);
        });
        labels.push({label, mask: _.range(offset, offset + size)});
        offset += size;
    });

    let points = _.range(this.size).map(function () {
        return NULL_POINT[dims];
    });

    this._emptyLmGroup[dims] = {
        labels,
        version: 2,
        landmarks: { connectivity: globalConnectivity, points }
    };

    return _.clone(this._emptyLmGroup[dims])
}

module.exports = Template;
