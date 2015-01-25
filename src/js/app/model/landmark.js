var _ = require('underscore');
var Backbone = require('../lib/backbonej');
var THREE = require('three');
var atomic = require('./atomic');
var JSONPromise = require('../lib/getpromise').JSONPromise;

"use strict";


var _validateJSONGroup =  function (json_group) {
    var nLandmarks = json_group.landmarks.length;
    var c = json_group.connectivity;
    var a, b;
    for (var i = 0; i < c.length; i++) {
        a = c[i][0];
        b = c[i][1];
        if (a < 0 || a >= nLandmarks || b < 0 || b >= nLandmarks) {
            // we have bad connectivity!
            throw "Bad connectivity on landmark group " + json_group.label +
            " connectivity [" + a + ", " + b +
            "] not permitted in group of length " + nLandmarks;
        }

    }
};


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

var invertMask = function(mask) {
    return map(mask, function(i) {
        return !i;
    });
};

var map = function(a, f) {
    var b = [];
    for (var i = 0; i < a.length; i++) {
        b.push(f(a[i]));
    }
    return b;
};

var mapMethod = function(a, m) {
    var b = [];
    for (var i = 0; i < a.length; i++) {
        b.push(a[i][m]());
    }
    return b;
};


var _where = function(x) {
    return function(a, f) {
        return booleanMaskArray(a, x(a, f));
    };
};


var where = _where(map);
var whereMethod = _where(mapMethod);

var whereNotMethod = function(a, m) {
        return booleanMaskArray(a, invertMask(mapMethod(a, m)));
};



var Landmark = Backbone.Model.extend({

    defaults: function () {
        return {
            point: null,
            selected: false,
            index: 0,
            nextAvailable: false
        }
    },

    isNextAvailable: function () {
        return this.get('nextAvailable');
    },

    setNextAvailable: function () {
        if (!this.isNextAvailable()) {
            this.set('nextAvailable', true);
        }
    },

    clearNextAvailable: function () {
        if (this.isNextAvailable()) {
            this.set('nextAvailable', false);
        }
    },

    initialize: function () {
        _.bindAll(this, 'point', 'setPoint', 'select', 'deselect',
            'isSelected', 'isEmpty', 'clear', 'group', 'toJSON');
        this.set('isEmpty', this.isEmpty());
    },

    point: function() {
        return this.get('point');
    },

    setPoint: function (p) {
        this.set('point', p);
        if (this.get('isEmpty')) {
            this.set('isEmpty', false);
        }
    },

    select: function () {
        if (!this.isEmpty() && !this.isSelected()) {
            this.set('selected', true);
        }
        return this;
    },

    deselect: function () {
        if(this.isSelected()) {
            return this.set('selected', false);
        }
    },

    isSelected: function () {
        return this.get('selected');
    },

    isEmpty: function () {
        return !this.has('point');
    },

    clear: function() {
        this.set({
            point: null,
            selected: false,
            isEmpty: true
        });
        // reactivate the group to reset next available.
        this.get('group').collection.resetNextAvailable();
    },

    group: function () {
        this.get('group');
    },

    toJSON: function () {
        var pointJSON = null;
        var point;
        if (!this.isEmpty()) {
            point = this.point();
            if (this.get('ndims') == 2) {
                pointJSON = [point.x, point.y];
            } else
            pointJSON = [point.x, point.y, point.z];
        } else {
            if (this.get('ndims') == 2) {
                pointJSON = [null, null];
            } else {
                pointJSON = [null, null, null];
            }
        }
        return {
            point: pointJSON
        }
    }

});

var LandmarkList = Backbone.Collection.extend({

    comparator: 'index',

    selected: function () {
        return this.where({selected: true});
    },

    empty: function () {
        return this.filter(function(landmark) {
            return landmark.isEmpty();
        });
    },

    nonempty: function () {
        return this.filter(function(landmark) {
            return !landmark.isEmpty();
        });
    },

    selectAll: atomic.atomicOperation(function () {
        this.forEach(function(landmark) {
            landmark.select();
        });
    }),

    clearAllNextAvailable: atomic.atomicOperation(function () {
        this.forEach(function(landmark) {
            landmark.clearNextAvailable();
        });
    }),

    deselectAll: atomic.atomicOperation(function () {
        this.forEach(function(landmark) {
            landmark.deselect();
        });
    })

});

var LandmarkGroup = Backbone.Model.extend({

    defaults : function () {
        return {
            landmarks: new LandmarkList,
            label: 'group_label',
            active: false,
            connectivity: []
        };
    },

    connectivity: function () {
        return this.get('connectivity');
    },

    isActive: function () {
        return this.get('active');
    },

    activate: atomic.atomicOperation(function () {
        if (!this.isActive()) {
            this.collection.deselectAll();
            this.collection.deactivateAll();
            this.set('active', true);
            this.landmarks().deselectAll();
            this.collection.resetNextAvailable();
        }
    }),

    deactivate: function () {
        if (this.isActive()) {
            this.set('active', false);
        }
    },

    label: function () {
        return this.get('label');
    },

    landmarks: function () {
        return this.get('landmarks');
    },

    toJSON: function () {
        return {
            landmarks: this.landmarks(),
            connectivity: this.connectivity(),
            label: this.label()
        };
    }

});

var LandmarkGroupList = Backbone.Collection.extend({

    t_mesh: LandmarkGroup,

    active: function () {
        return this.findWhere({active: true});
    },

    withLabel: function (label) {
        return this.findWhere({label: label});
    },

    labelsToGroups: function () {
        var result = {};
        this.each(function (group) {
            result[group.label()] = group;
        });
        return result;
    },

    deactivateAll: atomic.atomicOperation(function () {
        this.each(function(group) {
            group.deactivate();
        });
    }),

    resetNextAvailable: atomic.atomicOperation(function () {
        this.clearAllNextAvailable();
        var next = this.nextAvailable();
        if (next) {
            next.setNextAvailable();
        }
    }),

    clearAllNextAvailable: atomic.atomicOperation(function () {
        this.each(function(group) {
            group.landmarks().clearAllNextAvailable();
        });
    }),

    deselectAll: atomic.atomicOperation(function () {
        this.each(function(group) {
            group.landmarks().deselectAll();
        });
    }),

    nonempty: function () {
        return _.flatten(this.map(function(group) {
            return group.landmarks().nonempty();
        }));
    },

    activeIndex: atomic.atomicOperation(function (i) {
        // firstly, deactivate everything
        this.each(function(group) {
            group.set('active', false);
        });
        // then, enable the requested index
        this.at(i).set('active', true);
    }),

    activeLabel: atomic.atomicOperation(function (label) {
        // firstly, deactivate everything
        this.each(function(group) {
            group.set('active', false);
        });
        // then, enable the requested index
        this.withLabel(label).set('active', true);
    }),

    nextAvailable: function () {
        var group, lms, lm, i, j;
        // hunt through for a space in all groups
        for(i = 0; i < this.length; i++) {
            group = this.at(i);
            lms = group.landmarks();
            for(j = 0; j < lms.length; j++) {
                lm = lms.at(j);
                if (lm.isEmpty()) {
                    return lm;
                }
            }
        }
        return null;
    }

});

var LandmarkSet = Backbone.Model.extend({

    urlRoot: "landmarks",

    groups: function () {
        return this.get('groups');
    },

    url: function () {
        var url = this.urlRoot + '/' + this.id + '/' + this.get('type');
        return this.get('server').map(url);
    },

    defaults: function () {
        return {
            groups: new LandmarkGroupList
        };
    },

    insertNew: atomic.atomicOperation(function (v) {
        var lm = this.groups().nextAvailable();
        if (!lm) {
            // nothing left to insert!
            return null;
        }
        if (!lm.isNextAvailable()) {
            console.log('ERROR: nextAvailable is incorrectly set!');
        }
        // we are definitely inserting.
        lm.get('group').activate();
        lm.collection.deselectAll();
        lm.set({
            point: v.clone(),
            selected: true,
            isEmpty: false,
            nextAvailable: false
        });
        var nextLm = this.groups().nextAvailable();
        if (nextLm) {
            nextLm.setNextAvailable();
        }
        return lm;
    }),

    deleteSelected: atomic.atomicOperation(function () {
        var lms = this.groups().active().landmarks().selected();
        _.each(lms, function (lm) {
            lm.clear();
        });
    }),

    selectAllInActiveGroup: atomic.atomicOperation(function () {
        this.groups().active().landmarks().selectAll();
    }),

    deselectAllInActiveGroup: atomic.atomicOperation(function () {
        this.groups().active().landmarks().deselectAll();
    }),

    parse: function (json, options) {
        if (!options.parse) {
            return;
        }
        var landmarkGroupList = new LandmarkGroupList(
            _.map(json.groups, function (json_group) {
                var ndims;
                _validateJSONGroup(json_group);

                // make the group so we can attach the landmarks
                var group = new LandmarkGroup(
                    {
                        label: json_group.label,
                        connectivity: json_group.connectivity
                    });
                var lmList = new LandmarkList(
                    _.map(json_group.landmarks, function (json_lm) {
                        var x, y, z, point;
                        var index = _.indexOf(json_group.landmarks, json_lm);
                        if (json_lm.point === null) {
                            return new Landmark({index: index});
                        }
                        x = json_lm.point[0];
                        y = json_lm.point[1];
                        if (json_lm.point.length == 3) {
                            ndims = 3;
                            // if any value is null, the point is null
                            if (json_lm.point[0] === null ||
                                json_lm.point[1] === null ||
                                json_lm.point[2] === null) {
                                point = null;
                            } else {
                                // grab the z and go!
                                z = json_lm.point[2];
                                point = new THREE.Vector3(x, y, z);
                            }
                        } else if (json_lm.point.length == 2) {
                            ndims = 2;
                            // if any value is null, the point is null
                            if (json_lm.point[0] === null ||
                                json_lm.point[1] === null) {
                                point = null;
                            } else {
                                // 2D landmarks always have z == 0
                                point = new THREE.Vector3(x, y, 0);
                            }
                        }
                        return new Landmark({
                            point: point,
                            index: index,
                            group: group,
                            ndims: ndims
                        });
                    })
                );
                // now attach the landmark list to the group and return
                group.set('landmarks', lmList);
                return group;
            })
        );
        landmarkGroupList.at(0).activate();
        landmarkGroupList.resetNextAvailable();
        return {groups: landmarkGroupList};
    },

    toJSON: function () {
        return {
            groups: this.get('groups'),
            version: 1
        };
    },

    saveWithCallbacks: function (success, failure) {
        console.log('save called');
        this.save(null,
            {
                parse: false,
                success: function () {
                    console.log('successfully saved');
                    if (success) {
                        success();
                    }
                },
                error: function () {
                    console.log('could not save.');
                    if (failure) {
                        failure();
                    }
                }
        });
    }
});

exports.Landmark = Landmark;
exports.LandmarkList = LandmarkList;
exports.LandmarkGroup = LandmarkGroup;
exports.LandmarkGroupList = LandmarkGroupList;
exports.LandmarkSet = LandmarkSet;


window.promiseLandmarkGroup = function (id, type, server) {
    return JSONPromise(server.map("landmarks/" + id + '/' + type)).then(
        function (json) {
            console.log(json);
            return parseLJSON[json.version](json);
        }, function (err) {
            console.log('Error in fetching landmark JSON file');
        }
    );
};

var NewLandmarkGroup = function (points, connectivity, labels) {
    this.points = points;
    this.connectivity = connectivity;
    this.labels = labels;
};


var LandmarkCollectionPrototype = Object.create(null);


LandmarkCollectionPrototype.selected = function () {
    return whereMethod(this.landmarks, 'isSelected');
};

LandmarkCollectionPrototype.deselectAll = function () {
    return mapMethod(this.landmarks, 'deselect');
};

LandmarkCollectionPrototype.selectAll = function () {
    return mapMethod(this.landmarks, 'select');
};

LandmarkCollectionPrototype.empty = function () {
    return whereMethod(this.landmarks, 'isEmpty');
};

LandmarkCollectionPrototype.nonempty = function () {
    return whereNotMethod(this.landmarks, 'select');
};

LandmarkCollectionPrototype.nextAvailable = function () {

};

var LandmarkLabel = function(label, landmarks) {
    this.label = label;
    this.landmarks = landmarks;
};

var parseLJSONv1 = function (json) {
    console.log('parsing v1 landmarks...');
};


var parseLJSONv2 = function (json) {
    console.log('parsing v2 landmarks...');
    var jsonPoints = json.landmarks.points;
    var lmInitObj, i, p, jsonLabel, labelLandmarks;
    var points = [];
    var connectivity = [];
    var labels = [];
    for(i = 0; i < jsonPoints.length; i++) {
        p = jsonPoints[i];
        lmInitObj = {};
        if (p.length == 2) {
            if (p[0] != null && p[1] != null) {
                // image landmarks always have z = 0
                lmInitObj.point = new THREE.Vector3(p[0], p[1], 0);
            }
        } else if (p.length == 3) {
            if (p[0] != null && p[1] != null && p[2] != null) {
                lmInitObj.point = new THREE.Vector3(p[0], p[1], p[2]);
            }
        }
        points.push(new Landmark(lmInitObj));
    }

    if (json.landmarks.hasOwnProperty('connectivity')) {
        connectivity = json.landmarks.connectivity;
    }

    for(i = 0; i < json.labels.length; i++) {
        jsonLabel = json.labels[i];
        labelLandmarks = indexMaskArray(points, jsonLabel.mask);
        labels.push(new LandmarkLabel(jsonLabel.label, labelLandmarks))
    }
    return new NewLandmarkGroup(points, connectivity, labels);
};

var parseLJSON = {
    1: parseLJSONv1,
    2: parseLJSONv2
};
