'use strict';

var _ = require('underscore');
var Backbone = require('backbone');
var $ = require('jquery');
var Spinner = require('spin.js');

var { randomString } = require('../lib/utils');

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

// module.exports.ThumbnailNotification = Backbone.View.extend({
//
//     initialize: function () {
//         _.bindAll(this, 'render');
//         this.listenTo(this.model.assetSource(), "change:nPreviews", this.render);
//     },
//
//     render: function () {
//         var total = this.model.assetSource().nAssets();
//         var nDone = this.model.assetSource().nPreviews();
//         if (total === nDone) {
//             document.getElementById('previewNotification').style.display = 'none';
//         }
//         var done = nDone/total;
//         var todo = 1 - nDone/total;
//         document.getElementById('previewDone').style.flex = done;
//         document.getElementById('previewRemaining').style.flex = todo;
//         return this;
//     }
// });

var NOTIFICATION_BASE_CLASS = 'Notification',
    NOTIFICATION_CLOSING_CLASS = 'Notification--Closing',
    NOTIFICATION_PERMANENT_CLASS = 'Notification--Permanent',
    NOTIFICATION_DEFAULT_CLOSE_TIMEOUT = 1500,
    NOTIFICATION_DEFAULT_TYPE = 'warning',
    NOTIFICATION_TYPE_CLASSES = { 'success': 'Notification--Success',
                                  'error': 'Notification--Error',
                                  'warning': 'Notification--Warning' };

module.exports.BaseNotification = Backbone.View.extend({

    tagName: 'div',
    container: '#notificationOverlay',

    initialize: function ({
        msg='',
        type=NOTIFICATION_DEFAULT_TYPE,
        actions=[],
        onClose,
        persist=false,
        closeTimeout=NOTIFICATION_DEFAULT_CLOSE_TIMEOUT
    }={}) {

        _.bindAll(this, 'render', 'close');

        if (!(type in NOTIFICATION_TYPE_CLASSES)) {
            type = NOTIFICATION_DEFAULT_TYPE;
        }

        if (onClose && typeof onClose === 'function') {
            this.onClose = onClose;
        }

        this.actions = actions.map(([label, func, close]) => {
            return [label, close ? () => {
                func();
                this.close();
            } : func];
        });

        if (this.actions.length) {
            closeTimeout = undefined;
        }

        this.persist = persist;

        this.render(type, msg, closeTimeout);
    },

    events: {
        'click .Notification__Action': 'handleClick',
        'click': 'close'
    },

    handleClick: function (evt) {
        if (this.actions.length) {
            evt.preventDefault();
            var actionIndex = evt.currentTarget.dataset.index;
            if (actionIndex >= 0 && actionIndex < this.actions.length) {
                this.actions[actionIndex][1]();
            }
        }
    },

    render: function (type, msg, timeout) {

        this.$el.addClass([
            NOTIFICATION_BASE_CLASS,
            NOTIFICATION_TYPE_CLASSES[type]
        ].join(' '));

        if (msg instanceof $) {
            this.$el.append(msg);
        } else {
            this.$el.append(`<p>${msg}</p>`);
        }

        if (this.actions.length) {
            var $actions = $(`<div></div>`);
            this.actions.forEach(function ([label, func], index) {
                $actions.append($(`\
                    <div class='Notification__Action' data-index=${index}>\
                        ${label}
                    </div>\
                `));
            });
            this.$el.append($actions);
        }

        if (this.persist) {
            this.$el.addClass(NOTIFICATION_PERMANENT_CLASS);
        }

        this.$el.appendTo(this.container);

        if (timeout > 0) {
          setTimeout(this.close, timeout);
        }
    },

    close: function () {

        if (this.onClose) {
            this.onClose();
        }

        if (this.persist) {
            return;
        }

        this.$el.addClass(NOTIFICATION_CLOSING_CLASS);

        setTimeout(() => {
            this.unbind();
            this.remove();
        }, 1000);
    }
});

module.exports.notify = function (opts) {
    return new module.exports.BaseNotification(opts);
};

module.exports.AssetLoadingNotification = Backbone.View.extend({

    initialize: function() {
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
                // need to set the spinner going
                this.spinner.spin(this.el);
                this.isSpinning = true;
            } else {
                this.spinner.stop();
                this.isSpinning = false;
            }
        }
    }
});

module.exports.LandmarkSavingNotification = Backbone.View.extend({

    initialize: function () {
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

var CornerSpinner = Backbone.View.extend({

    el: '#globalSpinner',
    initialize: function () {
        this._operations = {};
        this._shown = false;
    },

    render: function (show) {

        if (show === undefined) {
            show = Object.keys(this._operations).length > 0;
        }

        if (show && !this._shown) {
            this.$el.addClass('Display');
            $('.Viewport').addClass('LoadingCursor');
            this._shown = true;
        } else if (!show) {
            this.$el.removeClass('Display');
            $('.Viewport').removeClass('LoadingCursor');
            this._shown = false;
        }

    },

    start: function () {
        const rs = randomString(8, true);
        this._operations[rs] = true;
        this.render(true);
        return rs;
    },

    stop: function (op) {
        if (op in this._operations) {
            delete this._operations[op];
            this.render();
        }
    }
});

var _gs;
module.exports.loading = {

    start: function () {
        _gs = _gs || new CornerSpinner();
        return _gs.start.call(_gs);
    },

    stop: function (id) {
        _gs = _gs || new CornerSpinner();
        _gs.stop.call(_gs, id);
    }
};
