var Backbone = require('../lib/backbonej');


"use strict";

// Holds a list of available assets.
exports.AssetSource = Backbone.Model.extend({

    defaults: function () {
        return {
            assets: new Backbone.Collection,
            nPreviews: 0,
            assetIsLoading: false
        };
    },

    urlRoot : "collections",

    url: function () {
        return this.get('server').map(this.urlRoot + '/' + this.id);
    },

    initialize : function() {
        this.listenTo(this, "change:assets", this.changeAssets);
        this.pending = {};
    },

    changeAssets: function () {
        this.listenTo(this.get('assets'), "thumbnailLoaded", this.previewCount);
        this._changeAssets();
    },

    // Called after changeAssets. Opportunity for subclass to intervene
    _changeAssets: function () {},

    previewCount : function () {
        this.set('nPreviews', this.get('nPreviews') + 1);
    },

    mesh: function () {
        return this.get('mesh');
    },

    asset: function () {
        return this.get('asset');
    },

    assets: function () {
        return this.get('assets');
    },

    assetIsLoading: function () {
        return this.get('assetIsLoading');
    },

    nAssets: function () {
        return this.get('assets').length;
    },

    nPreviews: function () {
        return this.get('nPreviews');
    },

    next: function () {
        if (!this.hasSuccessor()) {
            return;
        }
        this.setAsset(this.assets().at(this.assetIndex() + 1));
    },

    previous: function () {
        if (!this.hasPredecessor()) {
            return;
        }
        this.setAsset(this.assets().at(this.assetIndex() - 1));
    },

    hasPredecessor: function () {
        return this.assetIndex() !== 0;
    },

    hasSuccessor: function () {
        return this.nAssets() - this.assetIndex() !== 1;
    },

    // returns the index of the currently active mesh
    assetIndex: function () {
        return this.assets().indexOf(this.get('asset'));
    }
});
