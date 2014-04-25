var Backbone = require('backbone');
var _ = require('underscore');
Backbone.$ = require('jquery');
var THREE = require('three');

"use strict";

// TODO implement history
var Landmark = Backbone.Model.extend({

    defaults: function () {
        return {
            point: null,
            selected: false,
            index: 0
        }
    },

    initialize: function () {
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

//        validate: function(attrs, options) {
//            var x  = 1;
//            console.log(attrs);
//            if (attrs.hasOwnProperty('point') &&
//                attrs.point !== null &&
//                !(attrs.point instanceof THREE.Vector3)) {
//                return "didn't pass a valid point";
//            }
//        },

    isEmpty: function () {
        return !this.has('point');
    },

    clear: function() {
        this.set({
            point: null,
            selected: false,
            isEmpty: true
        });
    },

    toJSON: function () {
        var pointJSON = null;
        var point;
        if (!this.isEmpty()) {
            point = this.point();
            pointJSON = [point.x, point.y, point.z];
            // TODO handle 2D case here
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

    deselectAll: function () {
        this.forEach(function(landmark) {
            landmark.deselect();
        });
    }

});

var LandmarkGroup = Backbone.Model.extend({

    // TODO check the list in here is OK
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
            this.collection.deactivateAll();
            this.set('active', true);
            this.landmarks().deselectAll();
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
            connectivity: this.connectivity()
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

    toJSON: function () {
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

    advanceActiveGroup: function () {
        var activeIndex = this.indexOf(this.active());
        if (activeIndex < this.length - 1) {
            // we can advance!
            this.activeIndex(activeIndex + 1);
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
        var activeGroup = this.groups().active();
        var insertedLandmark = null;
        if (activeGroup.landmarks().empty().length !== 0) {
            // get rid of current selection
            activeGroup.landmarks().deselectAll();
            // get the first empty landmark and set it
            insertedLandmark = activeGroup.landmarks().empty()[0];
            // TODO this is explicit for efficiency - does it help?
            insertedLandmark.set({
                point: v.clone(),
                selected: true,
                isEmpty: false
            });
            if (activeGroup.landmarks().empty().length === 0) {
                // depleted this group! Auto-advance to the next if we can
                this.groups().advanceActiveGroup();
            }
        }
        return insertedLandmark;
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
            _.map(json.groups, function (group, label) {
                var lmList = new LandmarkList(
                    _.map(group.landmarks, function (lm) {
                        var x, y, z;
                        var index = _.indexOf(group.landmarks, lm);
                        if (lm.point === null) {
                            return new Landmark({index: index});
                        } else if (lm.point.length == 3) {
                            x = lm.point[0];
                            y = lm.point[1];
                            z = lm.point[2];
                            return new Landmark({
                                point: new THREE.Vector3(x, y, z),
                                index: index
                            });
                        } else if (lm.point.length == 2) {
                            x = lm.point[0];
                            y = lm.point[1];
                            return new Landmark({
                                point: new THREE.Vector2(x, y),
                                index: index
                            });
                        }
                    })
                );
                return new LandmarkGroup(
                    {
                        landmarks: lmList,
                        label: label,
                        connectivity: group.connectivity
                    });
            })
        );
        landmarkGroupList.at(0).activate();
        return {groups: landmarkGroupList};
    },

    toJSON: function () {
        return {
            groups: this.get('groups'),
            version: 1
        };
    }
});

exports.Landmark = Landmark;
exports.LandmarkList = LandmarkList;
exports.LandmarkGroup = LandmarkGroup;
exports.LandmarkGroupList = LandmarkGroupList;
exports.LandmarkSet = LandmarkSet;
