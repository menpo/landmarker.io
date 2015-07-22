'use strict';

import _ from 'underscore';
import Backbone from 'backbone';

export default Backbone.Model.extend({

    defaults: function () {
        return {
            point: null,
            selected: false,
            nextAvailable: false,
            index: null
        };
    },

    initialize: function () {
        _.bindAll(this, 'nDims', 'point', 'setPoint', 'isEmpty',
            'isSelected', 'select', 'selectAndDeselectRest', 'deselect',
            'isNextAvailable', 'setNextAvailable', 'clearNextAvailable',
            'clear', 'group', 'toJSON');
    },

    nDims: function () {
        return this.get('nDims');
    },

    point: function () {
        return this.get('point');
    },

    setPoint: function (p) {
        this.set('point', p);
    },

    isEmpty: function () {
        return !this.has('point');
    },

    isSelected: function () {
        return this.get('selected');
    },

    select: function () {
        if (!this.isEmpty() && !this.isSelected()) {
            this.set('selected', true);
        }
    },

    selectAndDeselectRest: function () {
        this.group().deselectAll();
        this.select();
    },

    deselect: function () {
        if(this.isSelected()) {
            this.set('selected', false);
        }
    },

    isNextAvailable: function () {
        return this.get('nextAvailable');
    },

    setNextAvailable: function () {
        this.group().clearAllNextAvailable();
        this.set('nextAvailable', true);
    },

    clearNextAvailable: function () {
        if (this.isNextAvailable()) {
            this.set('nextAvailable', false);
        }
    },

    clear: function() {
        this.set({ point: null, selected: false });
    },

    group: function () {
        return this.get('group');
    },

    toJSON: function () {
        var pointJSON = null;
        var point;
        if (!this.isEmpty()) {
            point = this.point();
            if (this.nDims() === 2) {
                pointJSON = [point.x, point.y];
            } else {
                pointJSON = [point.x, point.y, point.z];
            }
        } else {
            if (this.nDims() === 2) {
                pointJSON = [null, null];
            } else {
                pointJSON = [null, null, null];
            }
        }
        return pointJSON;
    }

});
