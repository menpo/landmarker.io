'use strict';

import _ from 'underscore';
import Backbone from 'backbone';
import $ from 'jquery';

import {randomString} from '../lib/utils';

const NOTIFICATION_BASE_CLASS = 'Notification',
    NOTIFICATION_CLOSING_CLASS = 'Notification--Closing',
    NOTIFICATION_PERMANENT_CLASS = 'Notification--Permanent',
    NOTIFICATION_DEFAULT_CLOSE_TIMEOUT = 1500,
    NOTIFICATION_DEFAULT_TYPE = 'warning',
    NOTIFICATION_TYPE_CLASSES = { 'success': 'Notification--Success',
                                  'error': 'Notification--Error',
                                  'warning': 'Notification--Warning' };

/** Options:
+ `msg`: string to be displayed or jQuery element for more complex content
+ `type`: notifications can be one of three types (`error`, `warning` and `success`) which is denoted by the standard colors (`red`, `yellow`, `green`), defaults to `warning`
+ `actions`:  a list of call to actions in the form of tuples `[string, function, boolean]`, the function is called on click and the boolean value indicates wether or not click should close the notification as well
+ `onClose`: function to call when the notification is closed (automatically or manually)
+ `persist`: when true will prevent the notification from closing (default to false)
+ `closeTimeout`: time before the notification closes automatically, set to 0 or `undefined` to only allow manual closing. Will be forced to `undefined` if `actions` is not empty.
 */
export const BaseNotification = Backbone.View.extend({

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
                this.close();
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

export function notify (opts) {
    return new BaseNotification(opts);
}

const CornerSpinner = Backbone.View.extend({

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
    },

    clear: function () {
        this._operations = {};
        this.render();
    }
});

let _gs;
export const loading = {
    start: function () {
        if (!_gs) {
            _gs = new CornerSpinner();
        }
        return _gs.start();
    },

    stop: (id) => _gs.stop(id),
    clear: () => _gs.clear()
};
