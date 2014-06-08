var _ = require('underscore');
var Backbone = require('backbone');
var Spinner = require('spin.js');

"use strict";

exports.ThumbnailNotification = Backbone.View.extend({

    initialize : function() {
        _.bindAll(this, 'render');
        this.listenTo(this.model.assetSource(), "change:nPreviews", this.render);
    },

    render: function () {
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

exports.AssetLoadingNotification = Backbone.View.extend({

    initialize : function() {
        _.bindAll(this, 'render');
        this.listenTo(this.model.assetSource(), "change:assetIsLoading", this.render);
        this.spinner = new Spinner().spin();
        var opts = {
            lines: 13, // The number of lines to draw
            length: 20, // The length of each line
            width: 10, // The line thickness
            radius: 30, // The radius of the inner circle
            corners: 1, // Corner roundness (0..1)
            rotate: 0, // The rotation offset
            direction: 1, // 1: clockwise, -1: counterclockwise
            color: '#fff', // #rgb or #rrggbb or array of colors
            speed: 1, // Rounds per second
            trail: 60, // Afterglow percentage
            shadow: false, // Whether to render a shadow
            hwaccel: true, // Whether to use hardware acceleration
            className: 'spinner', // The CSS class to assign to the spinner
            zIndex: 2e9, // The z-index (defaults to 2000000000)
            top: '50%', // Top position relative to parent
            left: '50%' // Left position relative to parent
        };
        this.el = document.getElementById('loadingSpinner');
        this.spinner = new Spinner(opts);
        this.isSpinning = false;
    },

    render: function () {
        var isLoading = this.model.assetSource().assetIsLoading();
        if (isLoading !== this.isSpinning) {
            if (isLoading) {
                console.log('Spinner on!');
                // need to set the spinner going
                this.spinner.spin(this.el);
                this.isSpinning = true;
            } else {
                console.log('Spinner off.');
                this.spinner.stop();
                this.isSpinning = false;
            }
        }
    }
});
