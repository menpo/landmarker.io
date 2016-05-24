'use strict';

import yaml from 'js-yaml';
import _ from 'underscore';

import defaults from './defaults';

const CYCLE_CONNECTIVITY_LABEL = 'cycle';
const NULL_POINT = {2: [null, null], 3: [null, null, null]};

/**
 * @class Template
 * Representation of a landmarks template, can be exported to JSON and YAML
 * and parsed from YAML or JSON
 *
 * @param {Object} json
 */
export default function Template (json) {
    this._template = json.groups;

    if (!this._template) {
        throw new ReferenceError(
            'Missing top-level "groups" or "template" key');
    }

    if (!Array.isArray(this._template)) {
        throw new Error('Groups should be an array');
    }

    this._emptyLmGroup = { 2: undefined, 3: undefined };

    this.size = 0;
    this.groups = [];

    this._template.forEach(group => {

        const connectivity = [], label = group.label;

        let rawConnectivity = group.connectivity || [];
        const size = group.points;

        if (CYCLE_CONNECTIVITY_LABEL === rawConnectivity) {
            rawConnectivity = [`0:${size - 1}`, `${size - 1} 0`];
        } else if (!Array.isArray(connectivity)) {
            rawConnectivity = [];
        }

        rawConnectivity.forEach(function (item) {
            if (item.indexOf(':') > -1) {
                const [start, end] = item.split(':').map(Number);
                for (var i = start; i < end; i++) {
                    connectivity.push([i, i + 1]);
                }
            } else {
                connectivity.push(item.split(' ').map(Number));
            }
        });

        this.groups.push({label, size, connectivity});
        this.size += size;
    });
}

/**
 * parseYAML: read a YAML file and return a valid Template
 * @param  {string} rawData
 * @return {Template}
 */
Template.parseYAML = function (rawData) {
    const json = yaml.safeLoad(rawData);
    return new Template(json);
};

// For compatibility
Template.parseJSON = function (json) {
    if (typeof json === 'string') {
        json = JSON.parse(json);
    }
    return new Template(json);
};

/**
 * Reverse LJSON from previous landmark and return a compliant template
 * @param  {Object} ljson
 * @return {Template}
 */
Template.parseLJSON = function (ljson) {
    if (typeof ljson === 'string') {
        ljson = JSON.parse(ljson);
    }

    const template = [];
    ljson.labels.forEach(function ({label, mask}) {
        const group = {label, points: mask.length, connectivity: []};
        if (ljson.landmarks.connectivity) {
            ljson.landmarks.connectivity.forEach(function ([x1, x2]) {
                if (mask.indexOf(x1) > -1) {
                    const offset = mask[0];
                    group.connectivity.push(`${x1 - offset} ${x2 - offset}`);
                }
            });
        }
        template.push(group);
    });

    return new Template({groups: template});
};

Template.Parsers = {
    'yaml': Template.parseYAML,
    'yml': Template.parseYAML,
    'json': Template.parseJSON,
    'ljson': Template.parseLJSON
};

Template.prototype.toYAML = function () {
    return yaml.safeDump({groups: this._template});
};

Template.prototype.toJSON = function () {
    return JSON.stringify({groups: this._template});
};

/**
 * Lazily return empty landmarking data to be used with a new asset and usable
 * through LandmarkGroup
 * @param  {Number} dims=2
 * @return {Object}
 */
Template.prototype.emptyLJSON = function (dims=2) {

    if (this._emptyLmGroup[dims]) {
        return _.clone(this._emptyLmGroup[dims]);
    }

    let offset = 0;
    const globalConnectivity = [],
          labels = [];

    this.groups.forEach(function ({label, size, connectivity}) {
        connectivity.forEach(function ([s, e]) {
            globalConnectivity.push([s + offset, e + offset]);
        });
        labels.push({label, mask: _.range(offset, offset + size)});
        offset += size;
    });

    const points = _.range(this.size).map(() => NULL_POINT[dims]);

    this._emptyLmGroup[dims] = {
        labels,
        version: 2,
        landmarks: { connectivity: globalConnectivity, points }
    };

    return _.clone(this._emptyLmGroup[dims]);
};

Template.prototype.validate = function (json, dims=2) {

    if (typeof json === 'string') {
        json = JSON.parse(json);
    }

    const ljson = this.emptyLJSON(dims);
    let ok;

    ok = json.version === ljson.version;
    ok = ok && _.isEqual(json.labels, ljson.labels);
    ok = ok && json.landmarks && _.isEqual(json.landmarks.connectivity,
                                           ljson.landmarks.connectivity);
    ok = ok && ljson.landmarks.points.every(p => p.length === dims);
    return [ok, ok ? json : ljson];
};

let _defaults;

Template.loadDefaultTemplates = function () {
    if (!_defaults) {
        _defaults = {};
        Object.keys(defaults).forEach(key => {
            _defaults[key] = new Template(defaults[key]);
        });
    }
    return _defaults;
};
