var _ = require('underscore');
var Backbone = require('../lib/backbonej');
var Spinner = require('spin.js');

"use strict";

var spinnerOpts = {
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

// Singleton notification view accepting an option object of the form:
// {type, msg, closeTimeout, manualClose}
// automatic dismissal
// use manualClose: true to disable automatic dismissal (will override
// closeTimeout)
exports.BaseNotification = Backbone.View.extend({

    tagName: 'div',

    __container: '#notificationOverlay',
    __baseClass: 'ModalNotification',
    __closingClass: 'ModalNotification--Closing',
    __defaultCloseTimeout: 1500,
    __defaultType: 'warning',

    __types: {
      'success': true,
      'error': true
    },

    __classes: {
      'success': 'ModalNotification--Success',
      'error': 'ModalNotification--Error',
      'warning': 'ModalNotification--Warning'
    },

    initialize: function (opts) {

      opts = opts || {};

      _.bindAll(this, 'render', 'close');

      var msg = opts.msg || '',
          type = opts.type in this.__types ? opts.type || '' :
                                             this.__defaultType,
          closeTimeout = opts.manualClose ?
                         undefined :
                         opts.closeTimeout || this.__defaultCloseTimeout;

      this.render(type, msg, closeTimeout);
    },

    events: {
        click: 'close'
    },

    render: function (type, msg, timeout) {
        var _this = this;

        this.$el.addClass([this.__baseClass, this.__classes[type]].join(' '));
        this.$el.text(msg);
        this.$el.appendTo(this.__container);

        if (timeout !== undefined) {
          setTimeout(_this.close, timeout);
        }
    },

    close: function () {
        var _this = this;
        this.$el.addClass(this.__closingClass);

        setTimeout(function () {
            _this.unbind();
            _this.remove();
        }, 1000);
    }
});

exports.AssetLoadingNotification = Backbone.View.extend({

    initialize : function() {
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change:assetSource",
            this._changeAssetSource);
        this.spinner = new Spinner().spin();
        this.el = document.getElementById('loadingSpinner');
        this.spinner = new Spinner(spinnerOpts);
        this.isSpinning = false;
        this._changeAssetSource();
    },

    _changeAssetSource: function () {
        if (this.source) {
            this.stopListening(this.source);
        }
        this.source = this.model.assetSource();
        if (this.source) {
            this.listenTo(this.source, "change:assetIsLoading",
                this.render);
        }
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


exports.LandmarkSavingNotification = Backbone.View.extend({

    initialize : function() {
        _.bindAll(this, 'start', 'stop');
        this.spinner = new Spinner().spin();

        this.el = document.getElementById('loadingSpinner');
        this.spinner = new Spinner(spinnerOpts);
        this.isSpinning = false;
    },

    start: function () {
        if (!this.isSpinning) {
            this.spinner.spin(this.el);
            this.isSpinning = true;
        }
    },

    stop: function () {
        if (this.isSpinning) {
            this.spinner.stop();
            this.isSpinning = true;
        }
    }
});
