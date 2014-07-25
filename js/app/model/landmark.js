var _ = require('underscore');
var Backbone = require('../lib/backbonej');
var THREE = require('three');

"use strict";

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

    t_mesh: Landmark,

    comparator: 'index',

    initEmpty: function (n) {
        var landmarks = [];
        var landmark;
        for (var i = 0; i < n; i++) {
            landmark = new Landmark;
            landmark.set('index', i);
            landmarks.push(landmark);
        }
        this.reset(landmarks);
    },

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

    nSelected: function () {
        return this.selected().length;
    },

    selectAll: function () {
        this.forEach(function(landmark) {
            landmark.select();
        });
    },

    clearAllNextAvailable: function () {
        this.forEach(function(landmark) {
            landmark.clearNextAvailable();
        });
    },

    deselectAll: function () {
        this.forEach(function(landmark) {
            landmark.deselect();
        });
    }

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

    activate: function () {
        if (!this.isActive()) {
            this.collection.deselectAll();
            this.collection.deactivateAll();
            this.set('active', true);
            this.landmarks().deselectAll();
            this.collection.resetNextAvailable();
        }
    },

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

    initEmpty: function (label, n) {
        this.set('label', label);
        this.landmarks().initEmpty(n);
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

//    toJSON: function () {
//        var result = {};
//        this.each(function (group) {
//            result[group.label()] = group;
//        });
//        return result;
//    },

    labelsToGroups: function () {
        var result = {};
        this.each(function (group) {
            result[group.label()] = group;
        });
        return result;
    },

    initEmpty: function (labels, ns) {
        this.reset();  // clear any existing groups
        var group;
        var groups = [];
        if (labels.length !== ns.length) {
            throw("labels and ns need to be the same length");
        }
        for (var i = 0; i < labels.length; i++) {
            group = new LandmarkGroup;
            group.initEmpty(labels[i], ns[i]);
            groups.push(group)
        }
        this.reset(groups);
        this.activeIndex(0);
    },

    deactivateAll: function () {
        this.each(function(group) {
            group.deactivate();
        });
    },

    resetNextAvailable: function () {
        this.clearAllNextAvailable();
        var next = this.nextAvailable();
        if (next) {
            next.setNextAvailable();
        }
    },

    clearAllNextAvailable: function () {
        this.each(function(group) {
            group.landmarks().clearAllNextAvailable();
        });
    },

    deselectAll: function () {
        this.each(function(group) {
            group.landmarks().deselectAll();
        });
    },

    nonempty: function () {
        return _.flatten(this.map(function(group) {
            return group.landmarks().nonempty();
        }));
    },

    activeIndex: function (i) {
        // firstly, deactivate everything
        this.each(function(group) {
            group.set('active', false);
        });
        // then, enable the requested index
        this.at(i).set('active', true);
    },

    activeLabel: function (label) {
        // firstly, deactivate everything
        this.each(function(group) {
            group.set('active', false);
        });
        // then, enable the requested index
        this.withLabel(label).set('active', true);
    },

    nextAvailable: function () {
        var group, lms, lm, i, j;
        var activeGroup = this.active();
        if (activeGroup.landmarks().empty().length !== 0) {
            // The active group has a space left - next for insertion is
            // highest of these
            return activeGroup.landmarks().empty()[0];
        } else {
            // no space in active group - hunt through for a space in all groups
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
    }

});

var LandmarkSet = Backbone.Model.extend({

    urlRoot: "landmarks",
    urlTemplateRoot: "templates",


    url: function () {
        var url;
        if (this.get('from_template')) {
            url = this.urlTemplateRoot + '/' + this.get('type');
        } else {
            url = this.urlRoot + '/' + this.id + '/' + this.get('type');
        }
        return this.get('server').map(url);
    },

    defaults: function () {
        return {
            groups: new LandmarkGroupList
        };
    },

    groups: function () {
        return this.get('groups');
    },

    insertNew: function (v) {
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
    },

    deleteSelected: function () {
        var lms = this.groups().active().landmarks().selected();
        _.each(lms, function (lm) {
            lm.clear();
        });
    },

    selectAllInActiveGroup: function () {
        this.groups().active().landmarks().selectAll();
    },

    parse: function (json, options) {
        if (!options.parse) {
            return;
        }
        var landmarkGroupList = new LandmarkGroupList(
            _.map(json.groups, function (json_group) {
                var ndims;
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
