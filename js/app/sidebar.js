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

    tagName: "div",

    events: {
        click: "select",
        dblclick: "selectAll"
    },

    id: function () {
        return 'lm' + this.model.get('index');
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
            this.model.get('group').activate();
            this.model.select();
        }
    },

    selectAll: function (event) {
        this.model.get('group').activate();
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
        this.listenTo(this.collection, "reset", this.render);
        this.lmViews = [];
    },

    render: function() {
        this.cleanup();
        this.$el.empty();
        this.$el.addClass('LmGroup-Flex');
        this.collection.each(this.renderOne);
        return this;
    },

    renderOne : function(model) {
        //console.log("NEW: LandmarkView (LandmarkList.renderOne())");
        var lm = new LandmarkView({model:model});
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

// Renders the LandmarkGroup label. Needs to re-render if group changes from
// active to not
var LandmarkGroupLabelView = Backbone.View.extend({

    className: "LmGroup-Label",

    initialize : function() {
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change:active", this.render);
    },

    render: function () {
        var label = this.model.label();
        this.$el.html(label);
        this.$el.toggleClass("LmGroup-Label--Active",
            this.model.get("active"));
        return this;
    }
});


// Renders a single LandmarkGroup. Either the view is closed and we just
// render the header (LandmarkGroupButtonView) or this group is active and
// we render all the landmarks (LandmarkListView) as well as the header.
var LandmarkGroupView = Backbone.View.extend({

    tagName: 'div',

    initialize : function() {
        _.bindAll(this, 'render');
        this.listenTo(this.model, "all", this.render);
        this.landmarkList = null;
        this.label = null;
    },

    render: function () {
        this.cleanup();
        this.$el.empty();
        this.$el.addClass('LmGroup');
        //console.log("NEW: LandmarkListView (LandmarkGroupView.render())");
        this.landmarkList = new LandmarkListView(
            {collection: this.model.landmarks()});
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
        //console.log("NEW: LandmarkGroupView (LandmarkGroupListView.renderOne())");
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
        this.model.saveVerbose();
    },

    revert: function () {
        console.log('revert called');
        this.model.fetch();
    }
});

var AssetNameView = Backbone.View.extend({

    el: '#assetName',

    initialize : function() {
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change:asset", this.render);
    },

    render: function () {
        console.log("AssetNameView: assetSource:asset has changed");
        this.$el.html(this.model.asset().id);
        return this;
    },

    events: {
        click : "chooseAssetName",
    },

    chooseAssetName: function () {
        console.log('Sidebar:chooseAssetName called');
    },

    revert: function () {
        console.log('Sidebar:revert called');
    }
});

var AssetIndexView = Backbone.View.extend({

    el: '#assetIndex',

    initialize : function() {
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change:asset", this.render);
    },

    render: function () {
        console.log("AssetIndexView: assetSource:asset has changed");
        var n_str = pad(this.model.assets().length, 2);
        var i_str = pad(this.model.assetIndex() + 1, 2);
        this.$el.html(i_str + "/" + n_str);
        return this;
    },

    events: {
        click : "chooseAssetNumber"
    },

    chooseAssetNumber: function () {
        console.log('Sidebar:chooseAssetNumber called');
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
        new AssetNameView({model: this.model.assetSource()});
        new AssetIndexView({model: this.model.assetSource()});
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
exports.LandmarkGroupView = LandmarkGroupView;
exports.LandmarkGroupListView = LandmarkGroupListView;
exports.AssetPagerView = AssetPagerView;
exports.SaveRevertView = SaveRevertView;
exports.Sidebar = Sidebar;
