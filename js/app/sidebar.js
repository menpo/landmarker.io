var _ = require('underscore');
var Backbone = require('backbone');
var $ = require('jquery');

"use strict";

function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n :
        new Array(width - n.length + 1).join(z) + n;
}

// Renders a single Landmark. Should update when constituent landmark
// updates and that's it.
var LandmarkView = Backbone.View.extend({

    template: _.template($("#trTemplate").html()),

    events: {
        "click": "select"
    },

    id: function () {
        return 'lm' + this.model.get('index');
    },

    initialize: function () {
        this.listenTo(this.model, 'change', this.render);
    },

    render: function () {
        console.log("Landmark:render - " + this.model.get('index') +
        "(" + this.cid + ", " + this.model.cid + ")");
        function xyziForLandmark(lm) {
            var p;
            if (lm.isEmpty()) {
                return {
                    x: '-',
                    y: '-',
                    z: '-',
                    i: lm.get('index')
                };
            } else {
                p = lm.point();
                return {
                    x: p.x.toPrecision(4),
                    y: p.y.toPrecision(4),
                    z: p.z.toPrecision(4),
                    i: lm.get('index')
                };
            }
        }
        // TODO handle 2D landmarks here
        var html = $(this.template(xyziForLandmark(this.model)));
        html.toggleClass("Table-Row-Odd", this.model.get('index') % 2 === 1);
        html.toggleClass("Table-Cell-Selected", this.model.isSelected());

        // in case our element is already live replace the content
        this.$el.replaceWith(html);
        // now set the element back so we have a handle. If this is the
        // first time then we have gotten a handle for the future
        this.setElement(html);
        return this;
    },

    select: function (event) {
        if (event.shiftKey) {
            // shift takes precedence.
        } else if ((event.ctrlKey || event.metaKey)) {
            if (this.model.isSelected()) {
                this.model.deselect();
            } else {
                this.model.select();
            }
        } else {
            this.model.collection.deselectAll();
            this.model.select();
        }
    }
});

// Renders the LandmarkList. Don't think this ListView should ever have to
// render (as we build a fresh View each time a group is activated
// and de-activated)
var LandmarkListView = Backbone.View.extend({

    template: _.template($("#tableHeader").html()),

    tagName: 'table',

    initialize : function() {
        _.bindAll(this, 'render', 'renderOne');
        this.listenTo(this.collection, "reset", this.render);
        this.lmViews = [];
    },

    render: function() {
        this.cleanup();
        this.$el.empty();
        this.$el.append(this.template());
        this.collection.each(this.renderOne);
        return this;
    },

    renderOne : function(model) {
        console.log("NEW: LandmarkView (LandmarkList.renderOne())");
        var row = new LandmarkView({model:model});
        // reset the view's element to it's template
        this.$el.append(row.render().$el);
        this.lmViews.push(row);
        return this;
    },

    cleanup: function () {
        // remove any views we already have bound
        _.each(this.lmViews, function(lm) {lm.remove()});
        this.lmViews = [];
    }

});

// Renders the LandmarkGroup header. Needs to re-render on active change or
// whenever a Landmark is filled in or not.
var LandmarkGroupButtonView = Backbone.View.extend({

    tagName: "button",

    className: "Button-LandmarkGroup",

    events: {
        'click' : "activate"
    },

    activate: function () {
        if (this.model.isActive()) {
            this.model.landmarks().selectAll();
        } else {
            this.model.activate();
        }
    },

    initialize : function() {
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change:active", this.render);
        this.listenTo(this.model.get('landmarks'), "change:isEmpty", this.render);
    },

    render: function () {
        console.log('GroupButton:render - ' + this.model.get('label'));
        var lms = this.model.get('landmarks');
        var nonempty_str = pad(lms.nonempty().length, 2);
        var lms_str = pad(lms.length, 2);
        var label = this.model.label();
        this.$el.html(label + " (" + nonempty_str + "/" + lms_str + ")");
        this.$el.toggleClass("Button-LandmarkGroup-Active",
            this.model.get("active"));
        return this;
    }
});

// Renders a single LandmarkGroup. Either the view is closed and we just
// render the header (LandmarkGroupButtonView) or this group is active and
// we render all the landmarks (LandmarkListView) as well as the header.
var LandmarkGroupView = Backbone.View.extend({

    // TODO make this a useful div
    tagName: 'div',

    initialize : function() {
        _.bindAll(this, 'render');
        this.listenTo(this.model, "all", this.render);
        this.landmarkTable = null;
        this.buton = null
    },

    render: function () {
        this.cleanup();
        this.button = new LandmarkGroupButtonView({model:this.model});
        this.$el.empty();
        this.$el.append(this.button.render().$el);
        if (this.model.get('active')) {
            console.log("NEW: LandmarkListView (LandmarkGroupView.render())");
            this.landmarkTable = new LandmarkListView(
                {collection: this.model.landmarks()});
            this.$el.append(this.landmarkTable.render().$el);
        }
        return this;
    },

    cleanup: function () {
        if (this.landmarkTable) {
            // already have a list view! clean it up + remove
            this.landmarkTable.cleanup();
            this.landmarkTable.remove();
            this.landmarkTable = null;
        }
        if (this.button) {
            // already have a button view! remove
            this.button.remove();
            this.button = null;
        }
    }
});


// Renders a collection of LandmarkGroups. At any one time one of these
// will be expanded - the rest closed. This View is indifferent - it just
// builds LandmarkGroupView's and asks them to render in turn.
var LandmarkGroupListView = Backbone.View.extend({

    // TODO make this a useful div

    initialize : function() {
        _.bindAll(this, 'render', 'renderOne');
        this.listenTo(this.collection, "reset", this.render);
        this.groups = [];
    },

    render: function() {
        this.cleanup();
        this.$el.empty();
        this.collection.each(this.renderOne);
        return this;
    },

    renderOne : function(model) {
        console.log("NEW: LandmarkGroupView (LandmarkGroupListView.renderOne())");
        var group = new LandmarkGroupView({model:model});
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


var AssetPagerView = Backbone.View.extend({

    el: '#assetPager',

    initialize : function() {
        _.bindAll(this, 'render');
        this.listenTo(this.model, "all", this.render);
        this.render();
    },

    events: {
        'click #next' : "next",
        'click #previous' : "previous"
    },

    render: function () {
        this.$el.find('#next').toggleClass('Button--Disabled',
            !this.model.hasSuccessor());
        this.$el.find('#previous').toggleClass('Button--Disabled',
            !this.model.hasPredecessor());
        return this;
    },

    next: function () {
        this.model.next();
    },

    previous: function () {
        this.model.previous();
    }

});


var SaveRevertView = Backbone.View.extend({

    el: '#saveRevert',

    initialize : function() {
        _.bindAll(this, 'render');
        //this.listenTo(this.model, "all", this.render);
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
        console.log('save called');
        this.model.save(null, {parse: false});
    },

    revert: function () {
        console.log('revert called');
    }
});

var AssetInfoView = Backbone.View.extend({

    el: '#assetInfo',

    initialize : function() {
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change:asset", this.render);
    },

    render: function () {
        console.log("AssetInfoView: assetSource:asset has changed");
        this.$el.find('#assetName').html(this.model.asset().id);
        var n_str = pad(this.model.assets().length, 2);
        var i_str = pad(this.model.assetIndex() + 1, 2);
        this.$el.find('#assetIndex').html(i_str + "/" + n_str);
        return this;
    },

    events: {
        "click #assetName" : "chooseAssetName",
        'click #assetIndex' : "chooseMeshNumber"
    },

    chooseMeshNumber: function () {
        console.log('Sidebar:chooseMeshNumber called');
    },

    chooseAssetName: function () {
        console.log('Sidebar:chooseAssetName called');
    },

    revert: function () {
        console.log('Sidebar:revert called');
    }
});


var Sidebar = Backbone.View.extend({

    initialize : function() {
        _.bindAll(this, "landmarksChange", "assetSourceChange");
        this.listenTo(this.model, "change:landmarks", this.landmarksChange);
        this.listenTo(this.model, "change:assetSource", this.assetSourceChange);
        this.assetSourceChange();
    },

    assetSourceChange: function () {
        new AssetPagerView({model: this.model.assetSource()});
        new AssetInfoView({model: this.model.assetSource()});
    },

    landmarksChange: function () {
        // TODO inconsistency in binding - manual or hardcoded? not both.
        new SaveRevertView({model: this.model.get('landmarks')});
        var lmView = new LandmarkGroupListView({
            collection: this.model.get('landmarks').get('groups')
        });
        $('.Sidebar-LandmarksPanel').html(lmView.render().$el)
    }

});

exports.LandmarkView = LandmarkView;
exports.LandmarkListView = LandmarkListView;
exports.LandmarkGroupButtonView = LandmarkGroupButtonView;
exports.LandmarkGroupView = LandmarkGroupView;
exports.LandmarkGroupListView = LandmarkGroupListView;
exports.AssetPagerView = AssetPagerView;
exports.SaveRevertView = SaveRevertView;
exports.Sidebar = Sidebar;
