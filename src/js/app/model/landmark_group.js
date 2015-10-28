'use strict';

import THREE from 'three';

import { maskedArray } from '../lib/utils';
import { notify } from '../view/notification';
import Tracker from '../lib/tracker';
import { atomicOperation } from './atomic';

import Landmark from './landmark';

// Define behavior shared between Lists and Groups
const LandmarkCollectionPrototype = Object.create(null);

LandmarkCollectionPrototype.selected = function () {
    return this.landmarks.filter(lm => lm.isSelected());
};

LandmarkCollectionPrototype.isEmpty = function () {
    return this.landmarks.every(lm => lm.isEmpty());
};

LandmarkCollectionPrototype.hasEmpty = function () {
    return this.landmarks.some(lm => lm.isEmpty());
};

LandmarkCollectionPrototype.deselectAll = atomicOperation(function () {
    this.landmarks.forEach(lm => lm.deselect());
});

LandmarkCollectionPrototype.selectAll = atomicOperation(function () {
    this.landmarks.forEach(lm => lm.select());
});

function _validateConnectivity (nLandmarks, connectivity) {
    let a, b;

    if (!connectivity) {
        return [];
    }

    for (let i = 0; i < connectivity.length; i++) {
        [a, b] = connectivity[i];
        if (a < 0 || a >= nLandmarks || b < 0 || b >= nLandmarks) {
            // we have bad connectivity!
            throw new Error(
                "Illegal connectivity encountered - [" + a + ", " + b +
                "] not permitted in group of " + nLandmarks + " landmarks");
        }

    }

    return connectivity;
}

function _pointToVector ([x, y, z]) {
    let n, v;

    n = z === undefined ? 2 : 3;
    if (n === 2) {
        z = 0;
    }

    if (x !== null && y !== null && z !== null) {
        v = new THREE.Vector3(x, y, z);
    }

    return [v, n];
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
export default function LandmarkGroup (
    points, connectivity, labels, id, type, server, tracker
) {
    this.id = id;
    this.type = type;
    this.server = server;
    this.tracker = tracker || new Tracker();

    // 1. Build landmarks from points
    this.landmarks = points.map((p, index) => {
        const [point, nDims] = _pointToVector(p);
        const lmInitObj = {group: this, index, nDims, point};
        return new Landmark(lmInitObj);
    });

    // 2. Validate and assign connectivity (if there is any, it's not mandatory)
    this.connectivity = _validateConnectivity(this.landmarks.length,
                                              connectivity);

    // 3. Build labels
    this.labels = labels.map((label) => {
        return new LandmarkLabel(label.label, this.landmarks, label.mask);
    });

    // make sure we start with a sensible insertion configuration.
    this.resetNextAvailable();
    this.tracker.recordState(this.toJSON(), true);
    window.lmg = this;
}

LandmarkGroup.prototype = Object.create(LandmarkCollectionPrototype);

// Restor landmarks from json saved, should be of the same template so
// no hard checking ot resetting the labels
LandmarkGroup.prototype.restore = atomicOperation(function ({
    landmarks,
    labels
}) {
    const {points, connectivity} = landmarks;

    this.landmarks.forEach(lm => lm.clear());
    points.forEach((p, i) => {
        const [v] = _pointToVector(p);
        if (v) {
            this.landmarks[i].setPoint(v);
        }
    });

    this.connectivity = _validateConnectivity(this.landmarks.length,
                                              connectivity);

    delete this.labels;
    this.labels = labels.map((label) => {
        return new LandmarkLabel(label.label, this.landmarks, label.mask);
    });

    this.resetNextAvailable();
});

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
    this.tracker.record(ops);
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

    this.tracker.record([
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
            points: this.landmarks.map(lm => lm.toJSON()),
            connectivity: this.connectivity
        },
        labels: this.labels.map(label => label.toJSON()),
        version: 2
    };
};

LandmarkGroup.prototype.save = function () {
    return this.server
        .saveLandmarkGroup(this.id, this.type, this.toJSON())
        .then(() => {
            this.tracker.recordState(this.toJSON(), true);
            notify({type: 'success', msg: 'Save Completed'});
        }, () => {
            notify({type: 'error', msg: 'Save Failed'});
        });
};

LandmarkGroup.prototype.undo = function () {
    this.tracker.undo((ops) => {
        ops.forEach(([index, start]) => {
            if (!start) {
                this.landmarks[index].clear();
            } else {
                this.landmarks[index].setPoint(start.clone());
            }
        });
        this.resetNextAvailable();
    }, (json) => {
        this.restore(json);
    });
};

LandmarkGroup.prototype.redo = function () {
    this.tracker.redo((ops) => {
        ops.forEach(([index, , end]) => {
            if (!end) {
                this.landmarks[index].clear();
            } else {
                this.landmarks[index].setPoint(end.clone());
            }
        });
        this.resetNextAvailable();
    }, (json) => {
        this.restore(json);
    });
};

LandmarkGroup.prototype.completeGroups = function () {
    this.labels.forEach((label) => {
        // May be a way to review the structure as this is n^2 worse
        if (label.landmarks.some(lm => lm.isSelected())) {
            label.selectAll();
        }
    });
};

LandmarkGroup.parse = function (json, id, type, server, tracker) {
    return new LandmarkGroup(
        json.landmarks.points,
        json.landmarks.connectivity,
        json.labels,
        id,
        type,
        server,
        tracker
    );
};
