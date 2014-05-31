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
        click : "chooseAssetName"
    },

    chooseAssetName: function () {
        console.log('AssetNameView:chooseAssetName called');
    },

    revert: function () {
        console.log('AssetNameView:revert called');
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
        console.log('AssetIndexView:chooseAssetNumber called');
    },

    revert: function () {
        console.log('Sidebar:revert called');
    }
});

exports.AssetView = Backbone.View.extend({

    initialize : function() {
        new AssetPagerView({model: this.model});
        new AssetNameView({model: this.model});
        new AssetIndexView({model: this.model});
    }
});
