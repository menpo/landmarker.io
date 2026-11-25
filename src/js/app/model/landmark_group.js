'use strict';

import * as THREE from 'three';

import { maskedArray } from '../lib/utils';
import { notify } from '../view/notification';
import { closeLoops, resampleCurves } from '../lib/spline';
import Tracker from '../lib/tracker';
import atomicTracker from './atomic';

const { atomicOperation } = atomicTracker;

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
function LandmarkLabel (label, landmarks, mask, anchors, spacing) {
    this.label = label;
    this.mask = mask;
    this.anchors = anchors;     // optional, see lib/spline
    this.spacing = spacing;     // optional
    this.landmarks = maskedArray(landmarks, mask);
}

LandmarkLabel.prototype = Object.create(LandmarkCollectionPrototype);

LandmarkLabel.prototype.toJSON = function () {
    const json = {
        label: this.label,
        mask: this.mask
    };
    if (this.anchors) {
        json.anchors = this.anchors;
    }
    if (this.spacing) {
        json.spacing = this.spacing;
    }
    return json;
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
        return new LandmarkLabel(label.label, this.landmarks, label.mask,
                                 label.anchors, label.spacing);
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
        return new LandmarkLabel(label.label, this.landmarks, label.mask,
                                 label.anchors, label.spacing);
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

// Move the landmarks along the curves that their connectivity makes (the chains
// and loops) so that they are evenly spaced between the anchors of the template,
// or at the fractions that it gives. Only the curves with a selected landmark if
// there is a selection, otherwise all of them; curves with a landmark that has
// not been placed are left. It can be undone. Returns the number of landmarks moved.
LandmarkGroup.prototype.resample = function () {
    let moved = 0;
    // atomicOperation does not return what its function does
    atomicOperation(() => { moved = this._resample(); }).call(this);
    return moved;
};

// The labels that resample works on: those with a selected landmark, or null for all of them
// (no selection). The names to tell the annotator what "Space evenly" is about to touch.
LandmarkGroup.prototype.resampleScope = function () {
    const selected = this.selected().map(lm => lm.get('index'));
    if (!selected.length) {
        return null;
    }
    return this.labels.filter(label => selected.some(i => label.mask.includes(i)))
        .map(label => label.label);
};

LandmarkGroup.prototype._resample = function () {
    const ops = this._applyResample();
    if (ops.length) {
        this.tracker.record(ops);
    }
    return ops.length;
};

// Move the landmarks as resample does, without recording it: the moves, [index, from, to]
LandmarkGroup.prototype._applyResample = function () {
    const selected = this.selected().map(lm => lm.get('index'));
    const points = this._pointList();
    const anchors = [], spacing = {};
    this.labels.forEach(label => {
        (label.anchors || []).forEach(i => anchors.push(i));
        Object.assign(spacing, label.spacing || {});
    });

    return this._applyMoved(resampleCurves(
        points, this.connectivity, anchors, spacing, 0.5,
        selected.length ? selected : null));
};

// The landmarks as [x, y, z] (null where they are not placed)
LandmarkGroup.prototype._pointList = function () {
    return this.landmarks.map(lm => {
        const p = lm.point();
        return p ? [p.x, p.y, p.z] : [null, null, null];
    });
};

// Put the landmarks at `moved` (a list of points) without recording it: the moves, [index, from, to]
LandmarkGroup.prototype._applyMoved = function (moved) {
    const ops = [];
    moved.forEach((p, index) => {
        const was = this.landmarks[index].point();
        if (was && p.every(v => v !== null) &&
            Math.hypot(p[0] - was.x, p[1] - was.y, p[2] - was.z) > 1e-9) {
            const now = new THREE.Vector3(p[0], p[1], p[2]);
            ops.push([index, was.clone(), now]);
            this.landmarks[index].setPoint(now.clone());
        }
    });
    return ops;
};

// Close the loops (the eyes, the mouth) into one curve, the points of the two sides on top
// of each other: see closeLoops in lib/spline. Only the loops with a selected landmark if there
// is a selection, otherwise all of them. It can be undone. Returns the number of landmarks moved.
LandmarkGroup.prototype.closeLoops = function () {
    let moved = 0;
    atomicOperation(() => {
        const selected = this.selected().map(lm => lm.get('index'));
        const anchors = [];
        this.labels.forEach(label => (label.anchors || []).forEach(i => anchors.push(i)));
        const ops = this._applyMoved(closeLoops(
            this._pointList(), this.connectivity, anchors, selected.length ? selected : null));
        if (ops.length) {
            this.tracker.record(ops);
        }
        moved = ops.length;
    }).call(this);
    return moved;
};

// The moves of one landmark after another, as one: [index, from, to] with the first `from`
// and the last `to`
export function mergeMoves (first, second) {
    const merged = first.map(op => op.slice());
    const at = new Map(merged.map((op, k) => [op[0], k]));
    second.forEach(([index, from, to]) => {
        if (at.has(index)) {
            merged[at.get(index)][2] = to;
        } else {
            merged.push([index, from, to]);
        }
    });
    return merged;
}

// The landmarks were just moved (`moves`, [index, from, to], for the tracker): space the curves
// that they are on evenly, and return the moves of both together, so that one undo takes back
// the drag and the spacing. The curves of the selection are spaced, which is what was moved.
LandmarkGroup.prototype.spaceAfterMove = function (moves) {
    let spaced = [];
    atomicOperation(() => { spaced = this._applyResample(); }).call(this);
    return mergeMoves(moves, spaced);
};

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
            this.predictedBy = null;  // saving accepts a proposal: these are the annotation now
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

// The model that proposed the landmarks in a JSON that the server made up from a pre-fit (not
// saved yet: ``"reviewed": false`` and ``"source": "prefit:<model>"``), else null
export function predictedBy (json) {
    const source = typeof json.source === 'string' ? json.source : '';
    return json.reviewed === false && source.startsWith('prefit:') ?
        source.slice('prefit:'.length) : null;
}

LandmarkGroup.parse = function (json, id, type, server, tracker) {
    const group = new LandmarkGroup(
        json.landmarks.points,
        json.landmarks.connectivity,
        json.labels,
        id,
        type,
        server,
        tracker
    );
    group.predictedBy = predictedBy(json);
    return group;
};
