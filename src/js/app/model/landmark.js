'use strict';

import _ from 'underscore';
import Backbone from 'backbone';

export default Backbone.Model.extend({

    defaults: function () {
        return {
            point: null,
            selected: false,
            nextAvailable: false,
            occluded: false,
            index: null
        };
    },

    initialize: function () {
        _.bindAll(this, 'nDims', 'point', 'setPoint', 'isEmpty',
            'isSelected', 'select', 'selectAndDeselectRest', 'deselect',
            'isNextAvailable', 'setNextAvailable', 'clearNextAvailable',
            'clear', 'group', 'toJSON', 'isOccluded', 'setOccluded');
        // a landmark that leaves the picture is occluded (and one that comes back is not)
        this.on('change:point', this._autoOcclude);
    },

    isOccluded: function () {
        return !!this.get('occluded');
    },

    setOccluded: function (occluded) {
        this.set('occluded', !!occluded);
    },

    // The point changed: past the edge of the image the landmark is occluded, as it is
    // out of the frame. It is not occluded any more when it comes back, unless it was marked
    // occluded by hand while inside, which a move inside the image does not change.
    _autoOcclude: function () {
        const group = this.group();
        if (!group || !group.isOutside) {
            return;
        }
        const now = this.point();
        if (!now) {
            this.set('occluded', false);
        } else if (group.isOutside(now)) {
            this.set('occluded', true);
        } else {
            const before = this.previous('point');
            if (before && group.isOutside(before)) {
                this.set('occluded', false);
            }
        }
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
        this.set({ point: null, selected: false, occluded: false });
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
