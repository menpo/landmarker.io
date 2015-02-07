var _ = require('underscore');
var Backbone = require('../lib/backbonej');
var THREE = require('three');
var atomic = require('./atomic');
var requests = require('../lib/requests');

"use strict";


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
            nextAvailable: false
        }
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
        // reactivate the group to reset next available.
        this.group().resetNextAvailable();
    },

    group: function () {
        return this.get('group');
    },

    toJSON: function () {
        var pointJSON = null;
        var point;
        if (!this.isEmpty()) {
            point = this.point();
            if (this.nDims() == 2) {
                pointJSON = [point.x, point.y];
            } else
            pointJSON = [point.x, point.y, point.z];
        } else {
            if (this.nDims() == 2) {
                pointJSON = [null, null];
            } else {
                pointJSON = [null, null, null];
            }
        }
        return pointJSON;
    }

});


var promiseLandmarkGroup = function (id, type, server) {
    return requests.JSONGetPromise(server.map("landmarks/" + id + '/' + type)).then(
        function (json) {
            console.log(json);
            return parseLJSON[json.version](json, id, type, server);
        }, function (err) {
            console.log('Error in fetching landmark JSON file');
        }
    );
};

var parseLJSONv1 = function (json, id, type, server) {
    console.log('parsing v1 landmarks...');
};


var parseLJSONv2 = function (json, id, type, server) {
    console.log('parsing v2 landmarks...');
    return new LandmarkGroup(json.landmarks.points,
        json.landmarks.connectivity, json.labels, id, type, server);
};

var parseLJSON = {
    1: parseLJSONv1,
    2: parseLJSONv2
};


// Define behavior shared between Lists and Groups

var LandmarkCollectionPrototype = Object.create(null);


LandmarkCollectionPrototype.selected = function () {
    return where(this.landmarks, function (lm) {
        return lm.isSelected();
    });
};

LandmarkCollectionPrototype.deselectAll = atomic.atomicOperation(function () {
    this.landmarks.map(function(lm) {
        lm.deselect();
    });
});

LandmarkCollectionPrototype.selectAll = atomic.atomicOperation(function () {
    this.landmarks.map(function (lm) {
        lm.select();
    });
});


LandmarkCollectionPrototype.deleteSelected = atomic.atomicOperation(function () {
    this.selected().map(function (lm) {
        lm.clear();
    })
});


var _validateConnectivity =  function (nLandmarks, connectivity) {
    var a, b;
    for (var i = 0; i < connectivity.length; i++) {
        a = connectivity[i][0];
        b = connectivity[i][1];
        if (a < 0 || a >= nLandmarks || b < 0 || b >= nLandmarks) {
            // we have bad connectivity!
            throw "Illegal connectivity encountered - [" + a + ", " + b +
            "] not permitted in group of " + nLandmarks + " landmarks";
        }

    }
};


// LandmarkGroup is the container for all the landmarks for a single asset.
var LandmarkGroup = function (points, connectivity, labels, id, type, server) {

    var that = this;
    this.id = id;
    this.type = type;
    this.server = server;

    // 1. Build landmarks from points
    this.landmarks = points.map(function(p) {
        var lmInitObj = {group: that};
        if (p.length == 2) {
            lmInitObj.nDims = 2;
            if (p[0] != null && p[1] != null) {
                // image landmarks always have z = 0
                lmInitObj.point = new THREE.Vector3(p[0], p[1], 0);
            }
        } else if (p.length == 3) {
            lmInitObj.nDims = 3;
            if (p[0] != null && p[1] != null && p[2] != null) {
                lmInitObj.point = new THREE.Vector3(p[0], p[1], p[2]);
            }
        }
        return new Landmark(lmInitObj);
    });

    // 2. Validate and assign connectivity
    _validateConnectivity(this.landmarks.length, connectivity);
    this.connectivity = connectivity;

    // 3. Build labels
    this.labels = labels.map(function(label) {
        return new LandmarkLabel(label.label, that.landmarks, label.mask);
    });

    // make sure we start with a sensible insertion configuration.
    this.resetNextAvailable();
};

LandmarkGroup.prototype = Object.create(LandmarkCollectionPrototype);

LandmarkGroup.prototype.url = function () {
    return this.server.map("landmarks/" + this.id + '/' + this.type)
};

LandmarkGroup.prototype.nextAvailable = function () {
    for (var i = 0; i < this.landmarks.length; i++) {
        if (this.landmarks[i].isNextAvailable()) {
            return this.landmarks[i];
        }
    }
    return null;
};

LandmarkGroup.prototype.clearAllNextAvailable = function () {
    this.landmarks.map(function (l) {
        l.clearNextAvailable();
    });
};

LandmarkGroup.prototype.resetNextAvailable = function () {
    this.clearAllNextAvailable();
    for (var i = 0; i < this.landmarks.length; i++) {
        if (this.landmarks[i].isEmpty()) {
            this.landmarks[i].setNextAvailable();
            return;
        }
    }
};

LandmarkGroup.prototype.insertNew = atomic.atomicOperation(function (v) {
    var lm = this.nextAvailable();
    if (lm == null) {
        // nothing left to insert!
        return null;
    }
    // we are definitely inserting.
    this.deselectAll();
    lm.set({
        point: v.clone(),
        selected: true,
        isEmpty: false,
        nextAvailable: false
    });
    this.resetNextAvailable();
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

LandmarkGroup.prototype.promiseSave = function () {
    return requests.JSONPutPromise(this.url(), this);
};


// LandmarkLabel is a 'playlist' of landmarks from the LandmarkGroup.
var LandmarkLabel = function(label, landmarks, mask) {
    this.label = label;
    this.mask = mask;
    this.landmarks = indexMaskArray(landmarks, mask);
};

LandmarkLabel.prototype = Object.create(LandmarkCollectionPrototype);

LandmarkLabel.prototype.toJSON = function () {
    return {
        label: this.label,
        mask: this.mask
    }
};

exports.promiseLandmarkGroup = promiseLandmarkGroup;
