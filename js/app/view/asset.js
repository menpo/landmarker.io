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

    events: {
        'click #next' : "next",
        'click #previous' : "previous"
    },

    initialize : function() {
        console.log('AssetPagerView:initialize');
        _.bindAll(this, 'render');
        this.listenTo(this.model, "all", this.render);
        this.render();
    },

    render: function () {
        console.log('AssetPagerView:render');
        this.$el.find('#next').toggleClass('Button--Disabled',
            !this.model.hasSuccessor());
        this.$el.find('#previous').toggleClass('Button--Disabled',
            !this.model.hasPredecessor());
        return this;
    },

    next: function () {
        console.log('AssetPagerView:next');
        this.model.next();
    },

    previous: function () {
        console.log('AssetPagerView:previous');
        this.model.previous();
    }

});


var AssetNameView = Backbone.View.extend({

    el: '#assetName',

    events: {
        click : "chooseAssetName"
    },

    initialize : function() {
        console.log('AssetNameView:initialize');
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change:asset", this.render);
    },

    render: function () {
        console.log("AssetNameView:render");
        this.$el.html(this.model.asset().id);
        return this;
    },

    chooseAssetName: function () {
        console.log('AssetNameView:chooseAssetName');
    }
});


var AssetIndexView = Backbone.View.extend({

    el: '#assetIndex',

    events: {
        click : "chooseAssetNumber"
    },

    initialize : function() {
        console.log('AssetIndexView:initialize');
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change:asset", this.render);
    },

    render: function () {
        console.log("AssetIndexView:assetSource:render");
        var n_str = pad(this.model.assets().length, 2);
        var i_str = pad(this.model.assetIndex() + 1, 2);
        this.$el.html(i_str + "/" + n_str);
        return this;
    },

    chooseAssetNumber: function () {
        console.log('AssetIndexView:chooseAssetNumber');
    }
});


exports.AssetView = Backbone.View.extend({

    initialize : function() {
        console.log('AssetView:initialize');
        new AssetPagerView({model: this.model});
        new AssetNameView({model: this.model});
        new AssetIndexView({model: this.model});
    }
});
