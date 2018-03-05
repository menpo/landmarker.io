'use strict';

import THREE from 'three';

import { maskedArray } from '../lib/utils';
import { notify } from '../view/notification';
import Tracker from '../lib/tracker';
import { atomicOperation } from './atomic';
import _ from 'underscore';
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

    if(connectivity.length != nLandmarks){
        alert('!!! Previous asset is not same as current !!! It may copy not in proper way !!!')
        return;
    }
    for (let i = 0; i < connectivity.length; i++) {
        [a, b] = connectivity[i];

        if (a < 0 || a >= nLandmarks || b < 0 || b >= nLandmarks) {
            // we have bad connectivity!
            throw new Error(
                "Illegal connectivity encountered - [" + a + ", " + b +
                "] not permitted in group of " + nLandmarks + " landmarks");
            // alert('You can copy previous only in similar preset!')
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
    points, connectivity, bad, invisible, labels, id, type, server, tracker
) {
    this.id = id;
    this.type = type;
    this.server = server;
    this.tracker = tracker || new Tracker();
    // 1. Build landmarks from points
    this.landmarks = points.map((p, index) => {
        //p - x,y coord of point
        const [point, nDims] = _pointToVector(p);
        var badSlug;
        var invisibleSlug;
        bad ? badSlug = bad[index] : badSlug = false;
        invisible ? invisibleSlug = invisible[index] : invisibleSlug = false;
        const lmInitObj = {group: this, point, index, nDims, bad: badSlug, invisible: invisibleSlug};
        // const lmInitObj = {group: this, point, index, nDims};
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
    // window.lmg = this;
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
        if (v && this.landmarks[i]) {
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

LandmarkGroup.prototype.insertNew = atomicOperation(function (v, invisible, bad) {
    const lm = this.nextAvailable();
    if (lm === null) {
        return null;    // nothing left to insert!
    }

    if(!invisible && !bad){
        var invisible = false;
        var bad = false;
    }

    // we are definitely inserting.
    this.deselectAll();
    this.setLmAt(lm, v, invisible, bad);
    this.resetNextAvailable(lm);
});

LandmarkGroup.prototype.setLmAt = atomicOperation(function (lm, v, invisible, bad) {
    if (!v) {
        return;
    }
    this.tracker.record([
        [ lm.get('index'),
         lm.point() ? lm.point().clone() : undefined,
         v.clone() ]
    ]);

    if(!invisible && !bad){
        var invisible = false;
        var bad = false;
    }

    lm.set({
        point: v.clone(),
        selected: true,
        isEmpty: false,
        invisible: invisible,
        bad: bad
    });

});
//track
LandmarkGroup.prototype.toJSON = function () {
    return {
        landmarks: {
            points: this.landmarks.map(lm => lm.toJSON()),
            connectivity: this.connectivity,
            invisible: this.landmarks.map(lm => lm.attributes.invisible),
            bad: this.landmarks.map(lm => lm.attributes.bad)
        },
        labels: this.labels.map(label => label.toJSON()),
        gender: null,
        typeOfPhoto: null,
        version: 2
    };
};


LandmarkGroup.prototype.save = function (gender, typeOfPhoto) {
    let json = this.toJSON();
    json.gender = gender;
    json.typeOfPhoto = typeOfPhoto;
    return this.server
        .saveLandmarkGroup(this.id, this.type, json, gender, typeOfPhoto)
        .then(() => {
            this.tracker.recordState(this.toJSON(), true);
            notify({type: 'success', msg: 'Save Completed'});
        }, () => {
            notify({type: 'error', msg: 'Save Failed'});
        });
};


//compact points to needed size
LandmarkGroup.prototype.compactArray = function(array, size){
    if(array.length == size){
        return array;
    }

    if(array.length < size){
        while (array.length != size){
            //actually dont know why group w set automatically ¯\_(ツ)_/¯
            array.push(new Landmark({index: array.length, group: this}));
        }
    } else if (array.length > size){
        array = array.slice(0, size)
    }
    return array;
}

//setting all points to null
LandmarkGroup.prototype.nullPoints = function (array) {
    for(let i = 0;i < array.length; i++){
        array[i].attributes.point = null;
    }
    return array;
}


LandmarkGroup.prototype.setPreset = function (obj) {
    this.landmarks = this.compactArray(this.nullPoints(this.landmarks), parseInt(obj.points));
    if(obj.orientation == 0){
        //FRONTAL
        if(obj.contour == 'cycle') {
            if(obj.points == '49'){
                var mask = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48];
                this.label = new LandmarkLabel(obj.contour, this.landmarks, mask);
                this.connectivity = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13],[13,14],[14,15],[15,16],[16,17],[17,18],[18,19],[19,20],[20,21],[21,22],[22,23],[23,24],[24,25],[25,26],[26,27],[27,28],[28,29],[29,30],[30,31],[31,32],[32,33],[33,34],[34,35],[35,36],[36,37],[37,38],[38,39],[39,40],[40,41],[41,42],[42,43],[43,44],[44,45],[45,46],[46,47],[47,48],[48,0]];
            }
        } else if(obj.contour == 'circuit'){
            if(obj.points == '59'){
                var mask = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58];
                this.label = new LandmarkLabel(obj.contour, this.landmarks, mask);
                this.connectivity = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13],[13,14],[14,15],[15,16],[16,17],[17,18],[18,19],[19,20],[20,21],[21,22],[22,23],[23,24],[24,25],[25,26],[26,27],[27,28],[28,29],[29,30],[30,31],[31,32],[33,32],[32,34],[34,35],[35,36],[36,37],[37,38],[38,39],[39,40],[40,41],[41,42],[42,43],[43,44],[44,46],[45,46],[46,47],[47,48],[48,49],[49,50],[50,51],[51,52],[52,53],[53,54],[54,55],[55,56],[56,57],[57,58],[58,0]];
            }
        }
    } else {
        //SIDE
        if(obj.contour == 'cycle') {
            if(obj.points == '36'){
                var mask = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35];
                this.label = new LandmarkLabel(obj.contour, this.landmarks, mask);
                this.connectivity = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13],[13,14],[14,15],[15,16],[16,17],[17,18],[18,19],[19,20],[20,21],[21,22],[22,23],[23,24],[24,25],[25,26],[26,27],[27,28],[28,29],[29,30],[30,31],[31,32],[32,33],[33,34],[34,35],[35,0]];
            } else if(obj.points == '37'){
                var mask = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36];
                this.label = new LandmarkLabel(obj.contour, this.landmarks, mask);
                this.connectivity = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13],[13,14],[14,15],[15,16],[16,17],[17,18],[18,19],[19,20],[20,21],[21,22],[22,23],[23,24],[24,25],[25,26],[26,27],[27,28],[28,29],[29,30],[30,31],[31,32],[32,23],[23,33],[33,34],[34,35],[35,36],[36,0]];
            }
        } else if(obj.contour == 'circuit'){
            //maby later
        }
    }
   Backbone.on('redrawPreset', function() {} );
   Backbone.trigger('redrawPreset');
   Backbone.on('redrawCols', function() {} );
   Backbone.trigger('redrawCols', {label: this.label, lmg: this.landmarks});
   this.landmarks[0].setNextAvailable()

};

LandmarkGroup.prototype.markAsBad = function () { // z - mark as bad
        var selected = this.selected()[0];

        if(selected){
            var lm =  _.find(this.landmarks.reverse(), function(landmark){
                return landmark.attributes.index == selected.attributes.index;
            });

            if(lm && selected) {
                lm.set({
                    bad: !selected.attributes.bad,
                    invisible: false,
                    point: selected.point()
                })
            }

            Backbone.on('redrawDots', function() {} );
            Backbone.trigger('redrawDots', lm);

            var lastDot = _.find(this.landmarks.reverse(), function(landmark){
                return landmark.attributes.point == null;
            })
            if(lastDot){
            this.landmarks[lastDot.attributes.index].setNextAvailable()
            }
        }
}

LandmarkGroup.prototype.markAsInvisible = function () { // a - mark as invisible
        var selected = this.selected()[0];

        if(selected){
            var lm =  _.find(this.landmarks.reverse(), function(landmark){
                return landmark.attributes.index == selected.attributes.index;
            });
            if(lm && selected) {
                lm.set({
                    bad: false,
                    invisible: !selected.attributes.invisible,
                    point: selected.point()
                })
            }

            Backbone.on('redrawDots', function() {} );
            Backbone.trigger('redrawDots', lm);

            var lastDot = _.find(this.landmarks.reverse(), function(landmark){
                return landmark.attributes.point == null;
            })
            if(lastDot){
            this.landmarks[lastDot.attributes.index].setNextAvailable()
            }
        }
}

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
        json.landmarks.bad,
        json.landmarks.invisible,
        json.labels,
        id,
        type,
        server,
        tracker
    );
};
