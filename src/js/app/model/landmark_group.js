'use strict';

import THREE from 'three';

import { maskedArray } from '../lib/utils';
import { atomicOperation } from './atomic';

import Landmark from './landmark';

// Define behavior shared between Lists and Groups
var LandmarkCollectionPrototype = Object.create(null);

LandmarkCollectionPrototype.selected = function () {
    return this.landmarks.filter(lm => lm.isSelected());
};

LandmarkCollectionPrototype.isEmpty = function () {
    return this.landmarks.every(lm => lm.isEmpty());
};

LandmarkCollectionPrototype.deselectAll = atomicOperation(function () {
    this.landmarks.forEach(lm => lm.deselect());
});

LandmarkCollectionPrototype.selectAll = atomicOperation(function () {
    this.landmarks.forEach(lm => lm.select());
});

function _validateConnectivity (nLandmarks, connectivity) {
    let a, b;
    for (let i = 0; i < connectivity.length; i++) {
        [a, b] = connectivity[i];
        if (a < 0 || a >= nLandmarks || b < 0 || b >= nLandmarks) {
            // we have bad connectivity!
            throw new Error(
                "Illegal connectivity encountered - [" + a + ", " + b +
                "] not permitted in group of " + nLandmarks + " landmarks");
        }

    }
}

// LandmarkLabel is a 'playlist' of landmarks from the LandmarkGroup.
function LandmarkLabel (label, landmarks, mask) {
    this.label = label;
    this.mask = mask;
    this.landmarks = maskedArray(landmarks, mask);
}

LandmarkLabel.prototype = Object.create(LandmarkCollectionPrototype);

LandmarkLabel.prototype.toJSON = function () {
    return {
        label: this.label,
        mask: this.mask
    };
};

// LandmarkGroup is the container for all the landmarks for a single asset.
function LandmarkGroup (
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
}

LandmarkGroup.prototype = Object.create(LandmarkCollectionPrototype);

LandmarkGroup.prototype.nextAvailable = function () {
    for (let i = 0; i < this.landmarks.length; i++) {
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

// Sets the next available landmark to be either the first empty one,
// or if originLm is provided from the set, the first empty on after
// the originLm in storage order which is assumed to be logical order
// (Loop over all lms to clear the next available flag)
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
    const lm = this.nextAvailable();
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

function parseLJSONv1 (/*json, id, type, server*/) {
    console.log('parsing v1 landmarks...');
}

function parseLJSONv2 (json, id, type, server, log) {
    console.log('parsing v2 landmarks...');
    return new LandmarkGroup(
        json.landmarks.points, json.landmarks.connectivity, json.labels,
        id, type, server, log);
}

const LJSONParsers = {
    1: parseLJSONv1,
    2: parseLJSONv2
};

export default {
    LandmarkGroup,
    parseGroup: function (json, id, type, server, log) {
        return LJSONParsers[json.version](json, id, type, server, log);
    }
};
