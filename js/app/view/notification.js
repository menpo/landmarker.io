var _ = require('underscore');
var Backbone = require('backbone');

"use strict";

exports.ThumbnailNotification = Backbone.View.extend({

    initialize : function() {
        _.bindAll(this, 'render');
        this.listenTo(this.model.assetSource(), "change:nPreviews", this.render);
    },

    render: function () {
        console.log('I am listening');
        var total = this.model.assetSource().nAssets();
        var nDone = this.model.assetSource().nPreviews();
        if (total === nDone) {
            document.getElementById('previewNotification').style.display = 'none';
        }
        var done = nDone/total;
        var todo = 1 - nDone/total;
        document.getElementById('previewDone').style.flex = done;
        document.getElementById('previewRemaining').style.flex = todo;
        return this;
    }
});
