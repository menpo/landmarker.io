'use strict';

var _ = require('underscore');
var Backbone = require('backbone');
var THREE = require('three');
var atomicOperation = require('./atomic').atomicOperation;

var indexMaskArray = function (a, mask) {
    var masked = [];
    for(var i = 0; i < mask.length; i++) {
        masked.push(a[mask[i]]);
    }
    return masked;
};

var booleanMaskArray = function (a, mask) {
    var masked = [];
    for(var i = 0; i < mask.length; i++) {
        if (mask[i]) {
            masked.push(a[i]);
        }
    }
    return masked;
};

var where = function(a, f) {
    var mask = a.map(f);
    return booleanMaskArray(a, mask);
};

var Landmark = Backbone.Model.extend({

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

// Define behavior shared between Lists and Groups
var LandmarkCollectionPrototype = Object.create(null);

LandmarkCollectionPrototype.selected = function () {
    return where(this.landmarks, function (lm) {
        return lm.isSelected();
    });
};

LandmarkCollectionPrototype.isEmpty = function () {
    return this.landmarks.every(lm => lm.isEmpty());
};

LandmarkCollectionPrototype.deselectAll = atomicOperation(function () {
    this.landmarks.forEach(function(lm) {
        lm.deselect();
    });
});

LandmarkCollectionPrototype.selectAll = atomicOperation(function () {
    this.landmarks.forEach(function (lm) {
        lm.select();
    });
});

var _validateConnectivity = function (nLandmarks, connectivity) {
    var a, b;
    for (var i = 0; i < connectivity.length; i++) {
        a = connectivity[i][0];
        b = connectivity[i][1];
        if (a < 0 || a >= nLandmarks || b < 0 || b >= nLandmarks) {
            // we have bad connectivity!
            throw new Error(
                "Illegal connectivity encountered - [" + a + ", " + b +
                "] not permitted in group of " + nLandmarks + " landmarks");
        }

    }
};

// LandmarkGroup is the container for all the landmarks for a single asset.
var LandmarkGroup = function (
    points, connectivity, labels, id, type, server, log
) {
    this.id = id;
    this.type = type;
    this.server = server;
    this.log = log;

    // 1. Build landmarks from points
    this.landmarks = points.map((p, index) => {
        var lmInitObj = {group: this, index};
        if (p.length === 2) {
            lmInitObj.nDims = 2;
            if (p[0] !== null && p[1] !== null) {
                // image landmarks always have z = 0
                lmInitObj.point = new THREE.Vector3(p[0], p[1], 0);
            }
        } else if (p.length === 3) {
            lmInitObj.nDims = 3;
            if (p[0] !== null && p[1] !== null && p[2] !== null) {
                lmInitObj.point = new THREE.Vector3(p[0], p[1], p[2]);
            }
        }
        return new Landmark(lmInitObj);
    });

    // 2. Validate and assign connectivity (if there is any, it's not mandatory)
    if (connectivity !== undefined) {
        _validateConnectivity(this.landmarks.length, connectivity);
    } else {
        connectivity = [];
    }
    this.connectivity = connectivity;

    // 3. Build labels
    this.labels = labels.map((label) => {
        return new LandmarkLabel(label.label, this.landmarks, label.mask);
    });

    // make sure we start with a sensible insertion configuration.
    this.resetNextAvailable();
    this.log.reset(this.toJSON());
};

LandmarkGroup.prototype = Object.create(LandmarkCollectionPrototype);

LandmarkGroup.prototype.nextAvailable = function () {
    for (var i = 0; i < this.landmarks.length; i++) {
        if (this.landmarks[i].isNextAvailable()) {
            return this.landmarks[i];
        }
    }
    return null;
};

LandmarkGroup.prototype.clearAllNextAvailable = function () {
    this.landmarks.forEach(function (l) {
        l.clearNextAvailable();
    });
};

/**
 * Sets the next available landmark to be either the first empty one,
 * or if originLm is provided from the set, the first empty on after
 * the originLm in storage order which is assumed to be logical order
 * (Loop over all lms to clear the next available flag)
 *
 * @param {Landmark} originLm
 * @return {Landmark | undefined}
 */
LandmarkGroup.prototype.resetNextAvailable = function (originLm) {

    let first, next, pastOrigin = !originLm;

    this.landmarks.forEach((lm) => {
        lm.clearNextAvailable();
        pastOrigin = pastOrigin || lm === originLm;

        if (lm.isEmpty() && (!next || !first)) {
            if (!next && pastOrigin) {
                next = lm;
            } else if (!first && !pastOrigin) {
                first = lm;
            }
        }
    });

    next = !next ? first : next;          // Nothing was found after the origin
    if (next) {
        next.setNextAvailable();
    }

    return next;
};

LandmarkGroup.prototype.deleteSelected = atomicOperation(function () {
    const ops = [];
    this.selected().forEach(function (lm) {
        ops.push([lm.get('index'), lm.point().clone(), undefined]);
        lm.clear();
    });
    // reactivate the group to reset next available.
    this.resetNextAvailable();
    this.log.push(ops);
});

LandmarkGroup.prototype.insertNew = atomicOperation(function (v) {
    var lm = this.nextAvailable();
    if (lm === null) {
        return null;    // nothing left to insert!
    }
    // we are definitely inserting.
    this.deselectAll();
    this.setLmAt(lm, v);
    this.resetNextAvailable(lm);
});

LandmarkGroup.prototype.setLmAt = atomicOperation(function (lm, v) {

    if (!v) {
        return;
    }

    this.log.push([
        [ lm.get('index'),
         lm.point() ? lm.point().clone() : undefined,
         v.clone() ]
    ]);

    lm.set({
        point: v.clone(),
        selected: true,
        isEmpty: false,
        nextAvailable: false
    });
});

LandmarkGroup.prototype.toJSON = function () {
    return {
        landmarks: {
            points: this.landmarks,
            connectivity: this.connectivity
        },
        labels: this.labels,
        version: 2
    };
};

LandmarkGroup.prototype.save = function () {
    this.log.save(this.toJSON());
    return this.server.saveLandmarkGroup(this.id, this.type, this.toJSON());
};

// LandmarkLabel is a 'playlist' of landmarks from the LandmarkGroup.
var LandmarkLabel = function(label, landmarks, mask) {
    this.label = label;
    this.mask = mask;
    this.landmarks = indexMaskArray(landmarks, mask);
};

LandmarkGroup.prototype.undo = function () {
    this.log.undo((ops) => {
        ops.forEach(([index, start]) => {
            if (!start) {
                this.landmarks[index].clear();
            } else {
                this.landmarks[index].setPoint(start.clone());
            }
        });
    });
};

LandmarkGroup.prototype.redo = function () {
    this.log.redo((ops) => {
        ops.forEach(([index, , end]) => {
            if (!end) {
                this.landmarks[index].clear();
            } else {
                this.landmarks[index].setPoint(end.clone());
            }
        });
    });
};

LandmarkLabel.prototype = Object.create(LandmarkCollectionPrototype);

LandmarkLabel.prototype.toJSON = function () {
    return {
        label: this.label,
        mask: this.mask
    };
};

var parseLJSONv1 = function (/*json, id, type, server*/) {
    console.log('parsing v1 landmarks...');
};

var parseLJSONv2 = function (json, id, type, server, log) {
    console.log('parsing v2 landmarks...');
    return new LandmarkGroup(
        json.landmarks.points, json.landmarks.connectivity, json.labels,
        id, type, server, log);
};

var LJSONParsers = {
    1: parseLJSONv1,
    2: parseLJSONv2
};

module.exports = {
    Landmark,
    LandmarkGroup,
    parseGroup: function (json, id, type, server, log) {
        return LJSONParsers[json.version](json, id, type, server, log);
    }
};
