var Backbone = require('backbone');
var url = require('url');

"use strict";

exports.HistoryUpdate = Backbone.View.extend({

    initialize : function () {
        console.log('HistoryUpdate:initialize');
        this.listenTo(this.model, "change:asset", this.assetChanged);
        this.listenTo(this.model, "change:activeTemplate", this.assetChanged);
        // note that we don't listen for a change in the collection as
        // this could lead to an invalid URL (e.g. change the collection to
        // something else, URL immediately changes, user saves before asset
        // loads)
    },

    assetChanged: function () {
        var u = url.parse(window.location.href.replace('#', '?'), true);
        u.search = null;
        if (this.model.activeTemplate() == undefined ||
            this.model.activeCollection() == undefined ||
            this.model.assetIndex() == undefined) {
            // only want to set full valid states.
            return
        }
        u.query.t = this.model.activeTemplate();
        u.query.c = this.model.activeCollection();
        u.query.i = this.model.assetIndex() + 1;
        history.replaceState(null, null, url.format(u).replace('?', '#'));
    }
});
