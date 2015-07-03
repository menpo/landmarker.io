"use strict";

var _ = require('underscore');
var Backbone = require('backbone');
var $ = require('jquery');

var Notification = require('./notification');
var { pad } = require('../lib/utils');
var { Dropbox, Server } = require('../backend');

var AssetPagerView = Backbone.View.extend({

    el: '#assetPager',

    events: {
        'click #next' : "next",
        'click #previous' : "previous"
    },

    initialize : function() {
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change:asset", this.render);
    },

    render: function () {
        this.$el.find('#next').toggleClass('Button--Disabled',
            !this.model.assetSource().hasSuccessor());
        this.$el.find('#previous').toggleClass('Button--Disabled',
            !this.model.assetSource().hasPredecessor());
        return this;
    },

    next: function () {
        this.model.nextAsset();
    },

    previous: function () {
        this.model.previousAsset();
    }

});


var AssetNameView = Backbone.View.extend({

    el: '#assetName',

    events: {
        click : "chooseAssetName"
    },

    initialize : function() {
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change:asset", this.render);
    },

    render: function () {
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
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change:asset", this.render);
    },

    render: function () {
        var n_str = pad(this.model.assetSource().nAssets(), 2);
        var i_str = pad(this.model.assetIndex() + 1, 2);
        this.$el.html(i_str + "/" + n_str);
        return this;
    },

    chooseAssetNumber: function () {
        var newIndex = window.prompt(
            "Input asset index:", pad(this.model.assetIndex() + 1, 2));

        if (newIndex === null) { // ESC key or empty prompt, do nothing
            return null;
        }

        if (isNaN(newIndex)) {
          return new Notification.BaseNotification({
              msg: 'Enter a valid Number', type: 'error'});
        }

        newIndex = Number(newIndex);

        if (newIndex <= 0 || newIndex > this.model.assetSource().nAssets() ) {
            return Notification.notify({
                msg: 'Cannot select asset ' + newIndex + ' (out of bounds)',
                type: 'error'
            });
        }

        this.model.goToAssetIndex(Number(newIndex) - 1);
    }
});

var CollectionName = Backbone.View.extend({
    el: '#collectionName',

    events: {
        click : "chooseCollection"
    },

    initialize : function() {
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change:activeCollection", this.render);
    },

    render: function () {
        this.$el.html(this.model.activeCollection() || 'No Collection');
        return this;
    },

    chooseCollection: function () {

        let backend = this.model.server();
        if (backend instanceof Dropbox) {
            backend.pickAssets((path) => {
                this.model.set('activeCollection', path);
            }, function (err) {
                Notification.notify({
                    type: 'error',
                    msg: 'Error switching assets ' + err
                });
            }, true);
        } else if (backend instanceof Server) {
            if (this.model.collections().length === 1) {
                Notification.notify({
                    msg: 'There is only one available collection'
                });
            }
        }
    }

});

exports.AssetView = Backbone.View.extend({

    initialize : function() {
        new CollectionName({model: this.model});
        new AssetPagerView({model: this.model});
        new AssetNameView({model: this.model});
        new AssetIndexView({model: this.model});
    }
});
