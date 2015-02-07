var _ = require('underscore');
var Backbone = require('../lib/backbonej');
var $ = require('jquery');
var Notification = require('./notification');
var atomic = require('../model/atomic');

"use strict";


// Renders a single Landmark. Should update when constituent landmark
// updates and that's it.
var LandmarkView = Backbone.View.extend({

    tagName: "div",

    events: {
        click: "select",
        dblclick: "selectAll"
    },

    initialize: function () {
        this.listenTo(this.model, 'change', this.render);
    },

    render: function () {
        //console.log("Landmark:render - " + this.model.get('index') +
        //"(" + this.cid + ", " + this.model.cid + ")");
        var html = $("<div></div>");
        html.addClass("Lm", this.model.isEmpty());

        html.toggleClass("Lm-Empty", this.model.isEmpty());
        html.toggleClass("Lm-Value", !this.model.isEmpty());
        html.toggleClass("Lm-Selected", this.model.isSelected());
        html.toggleClass("Lm-NextAvailable", this.model.isNextAvailable());


        // in case our element is already live replace the content
        this.$el.replaceWith(html);
        // now set the element back so we have a handle. If this is the
        // first time then we have gotten a handle for the future
        this.setElement(html);
        return this;
    },

    select: atomic.atomicOperation(function (event) {
        if (event.shiftKey) {
            // shift takes precedence.
            return;
        } else if ((event.ctrlKey || event.metaKey)) {
            if (this.model.isSelected()) {
                this.model.deselect();
            } else {
                this.model.select();
            }
        } else if (this.model.isEmpty()) {
            // user is clicking on an empty landmark - mark it as the next for
            // insertion
            this.model.setNextAvailable();
        } else {
            this.model.selectAndDeselectRest();
        }
    }),

    selectAll: function (event) {
        // TODO fix up
        this.model.collection.selectAll();
    }
});

// Renders the LandmarkList. Don't think this ListView should ever have to
// render (as we build a fresh View each time a group is activated
// and de-activated)
var LandmarkListView = Backbone.View.extend({

    tagName: 'div',

    initialize : function() {
        _.bindAll(this, 'render', 'renderOne');
        this.lmViews = [];
        this.render();
    },

    render: function() {
        this.cleanup();
        this.$el.empty();
        this.$el.addClass('LmGroup-Flex');
        this.collection.map(this.renderOne);
        return this;
    },

    renderOne : function(model) {
        //console.log("NEW: LandmarkView (LandmarkList.renderOne())");
        var lm = new LandmarkView({model: model});
        // reset the view's element to it's template
        this.$el.append(lm.render().$el);
        this.lmViews.push(lm);
        return this;
    },

    cleanup: function () {
        // remove any views we already have bound
        _.each(this.lmViews, function(lm) {lm.remove()});
        this.lmViews = [];
    }

});

var LandmarkGroupLabelView = Backbone.View.extend({

    className: "LmGroup-Label",

    initialize : function() {
        var label = this.model.label;
        this.$el.html(label);
    }
});


// Renders a single LandmarkGroup. Either the view is closed and we just
// render the header (LandmarkGroupButtonView) or this group is active and
// we render all the landmarks (LandmarkListView) as well as the header.
var LandmarkGroupView = Backbone.View.extend({

    tagName: 'div',

    initialize : function() {
        _.bindAll(this, 'render');
        this.landmarkList = null;
        this.label = null;
        this.render();
    },

    render: function () {
        this.cleanup();
        this.$el.empty();
        this.$el.addClass('LmGroup');
        this.landmarkList = new LandmarkListView(
            {collection: this.model.landmarks});
        this.label = new LandmarkGroupLabelView({model: this.model});
        this.$el.append(this.label.render().$el);
        this.$el.append(this.landmarkList.render().$el);
        return this;
    },

    cleanup: function () {
        if (this.landmarkList) {
            // already have a list view! clean it up + remove
            this.landmarkList.cleanup();
            this.landmarkList.remove();
            this.landmarkList = null;
        }
        if (this.label) {
            // already have a label view! remove
            this.label.remove();
            this.label = null;
        }
    }
});


// Renders a collection of LandmarkGroups. At any one time one of these
// will be expanded - the rest closed. This View is indifferent - it just
// builds LandmarkGroupView's and asks them to render in turn.
var LandmarkGroupListView = Backbone.View.extend({

    initialize : function() {
        _.bindAll(this, 'render', 'renderOne');
        this.groups = [];
        this.render();
    },

    render: function() {
        this.cleanup();
        this.$el.empty();
        this.collection.map(this.renderOne);
        return this;
    },

    renderOne : function(label) {
        var group = new LandmarkGroupView({model: label});
        // reset the view's element to it's template
        this.$el.append(group.render().$el);
        this.groups.push(group);
        return this;
    },

    cleanup: function () {
        _.each(this.groups, function(group) {
            group.cleanup();
            group.remove();
        });
        this.groups = [];
    }

});


var SaveRevertView = Backbone.View.extend({

    el: '#saveRevert',

    initialize : function() {
        _.bindAll(this, 'render', 'save', 'revert');
        //this.listenTo(this.model, "all", this.render);
        // make a spinner to listen for save calls on these landmarks
        this.spinner = new Notification.LandmarkSavingNotification();
        this.notification = new Notification.LandmarkSuccessFailureNotification();
    },

    // Hack here to pass the app through to the save revert view just
    // as we are reusing restore for help temporarily (?)
    attachApp: function (app) {
        this.app = app;
    },

    events: {
        'click #save' : "save",
        'click #revert' : "revert"
    },

    render: function () {
        // TODO grey out save and revert as required
        return this;
    },

    save: function () {
        var that = this;
        this.spinner.start();
        this.model.promiseSave().then(function () {
            that.spinner.stop();
            that.notification.success();
        },
        function () {
            that.spinner.stop();
            that.notification.failure();
        });

    },

    revert: function (e) {
        e.stopPropagation();  // prevent the event from trigging the help immediately
        this.app.toggleHelpOverlay();
    }
});


var Sidebar = Backbone.View.extend({

    initialize : function() {
        _.bindAll(this, "landmarksChange");
        this.listenTo(this.model, "change:landmarks", this.landmarksChange);
        this.saveRevertView = null;
        this.lmView = null
    },

    landmarksChange: function () {
        console.log('Sidebar - rewiring after landmark change');
        if (this.saveRevertView) {
            // break bindings for save revert
            this.saveRevertView.undelegateEvents();
        }
        var lms = this.model.landmarks();
        if (lms === null) {
            return;
        }
        this.saveRevertView = new SaveRevertView({model: lms});
        // Hack here to pass the app through to the save revert view just
        // as we are reusing restore for help temporarily (?)
        this.saveRevertView.attachApp(app);
        if (this.lmView) {
            this.lmView.cleanup();
        }
        this.lmView = new LandmarkGroupListView({
            collection: lms.labels
        });
        $('.Sidebar-LandmarksPanel').html(this.lmView.render().$el)
    }

});


exports.Sidebar = Sidebar;
