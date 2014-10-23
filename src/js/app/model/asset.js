var Backbone = require('../lib/backbonej');

"use strict";

// Holds a list of available assets.
exports.AssetSource = Backbone.Model.extend({

    defaults: function () {
        return {
            assets: new Backbone.Collection,
            assetIsLoading: false
        };
    },

    urlRoot : "collections",

    url: function () {
        return this.get('server').map(this.urlRoot + '/' + this.id);
    },

    asset: function () {
        return this.get('asset');
    },

    assets: function () {
        return this.get('assets');
    },

    mesh: function () {
        return this.get('mesh');
    },

    assetIsLoading: function () {
        return this.get('assetIsLoading');
    },

    nAssets: function () {
        return this.get('assets').length;
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
    },

    next: function () {
        if (!this.hasSuccessor()) {
            return;
        }
        return this.setAsset(this.assets()[this.assetIndex() + 1]);
    },

    previous: function () {
        if (!this.hasPredecessor()) {
            return;
        }
        return this.setAsset(this.assets()[this.assetIndex() - 1]);
    }
});
