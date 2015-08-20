'use strict';

import Backbone from 'backbone';
import _ from 'underscore';
import $ from 'jquery';

const _modals = {};
let _activeModal;

/**
 * Generate a pseudo-random key
 * @return {Number}
 */
function _key () {
    return (new Date()).getTime() + Math.floor(Math.random()) * 1000;
}

/**
 * Modal
 * Extend this View class to display custom windows.
 *
 * Only one modal is displayed at any given time and accessible with
 * Modal.active(), it is tracked in this closure.
 *
 * Only the init, content and afterRender methods should be overridden
 * in subclasses.
 * closable, disposeOnClose should be passed to the subclass or set in their
 * init method.
 * disposeOnClose will remove the DOM element and handle after close,
 * otherwise call dispose manually.
 * Subclasses can implement an _onClose method which will be called after the
 * modal has been closed (can be called multiple times if disposeOnClose is
 * false)
 *
 */
export const Modal = Backbone.View.extend({
    tagName: 'div',
    container: '#modalsWrapper',
    className: 'ModalWindow',

    initialize: function (opts={}) {
        this.key = _key();
        _modals[this.key] = this;

        this.id = `modalWindow:${this.key}`;
        this.isOpen = false;
        this.closable = !!opts.closable;
        this.disposeOnClose = !!opts.disposeOnClose;

        if (opts.title) {
            this.title = opts.title;
        }

        this.init(opts);

        _.bindAll(
            this,
            'render', 'dispose', 'close', 'open', '_close', 'isActive',
            'content', 'init', 'afterRender'
        );

        this.render();
        this.afterRender();
    },

    render: function () {
        this.$el.addClass(this.className);

        if (Array.isArray(this.modifiers)) {
            this.modifiers.forEach((mod) => {
                this.$el.addClass(this.className + '--' + mod);
            });
        }
        this.$el.attr('id', this.id);

        if (this.closable) {
            this.$el.append(
                $("<div class='ModalWindow__Close'>&times;</div>")
            );
            this.$el.find('.ModalWindow__Close').on('click', this.close);
        }

        if (this.title) {
            this.$el.append(
                $(`<div class=${this.className}__Title>${this.title}</div>`)
            );
        }

        const $content = this.content();
        $content.addClass(`${this.className}__Content`);
        if ($content) {
            this.$el.append($content);
        }

        this.$el.appendTo(this.container);
    },

    open: function () {
        this.isOpen = true;
        if (_activeModal) {
            _modals[_activeModal].close();
        }
        $(this.container).addClass('ModalsWrapper--Open');
        this.$el.addClass(`${this.className}--Open`);
        _activeModal = this.key;

        if (this._onOpen) {
            this._onOpen();
        }
    },

    _close: function () {
        if (this.isOpen) {
            this.isOpen = false;
            _activeModal = undefined;
            this.$el.removeClass(`${this.className}--Open`);
            $(this.container).removeClass('ModalsWrapper--Open');

            if (this._onClose) {
                this._onClose();
            }
        }
    },

    close: function () {
        (this.disposeOnClose ? this.dispose : this._close)();
    },

    dispose: function () {
        this._close();
        delete _modals[this];
        this.remove();
    },

    isActive: function () {
        return this.key === _activeModal;
    },

    // Implement these method as well as events in your subclass
    // -------------------------------------------------------------------------

    // Generate the jQuey object to be appended as body of the modal
    content: function () {
        throw new Error(
            'Not implemented, add a content function to your implementation');
    },

    // Is called before render and passed the object received by initialize
    init: function (/* opts */) {},

    // Called after render with no arguments
    afterRender: function () {}
});

// Return a handle to the active modal window
Modal.active = function () {
    return _modals[_activeModal];
};

// Simple 2 options confirmation window
// Takes an accept callback and a reject callback which are called without
// arguments and can be undefined (nothing will happen)
const ConfirmDialog = Modal.extend({
    modifiers: ['Small'],

    events: {
        'click .ConfirmAction--Yes': 'accept',
        'click .ConfirmAction--No': 'reject'
    },

    init: function ({text, accept, reject}) {
        this.text = text;
        this._accept = accept || function () {};
        this._reject = reject || function () {};
    },

    content: function () {
        return $(`\
            <div class='ConfirmDialog'>\
                <p>${this.text}</p>\
                <div class='ConfirmActions'>\
                    <div class='ConfirmAction--Yes'>Yes</div>\
                    <div class='ConfirmAction--No'>No</div>\
                </div>\
            </div>`);
    },

    accept: function () {
        this._accept();
        this.close();
    },

    reject: function () {
        this._reject();
        this.close();
    }

});

// Shortcut for confirm modal
Modal.confirm = function (text, accept, reject, closable=true) {
    (new ConfirmDialog({
        text,
        accept,
        reject,
        disposeOnClose: true,
        closable
    })).open();
};

// Custom prompt to replace the traditionnal window.prompt
// Takes a submit argument as callback which will be called with the entered
// string.
const Prompt = Modal.extend({
    modifiers: ['Small'],

    events: {
        'submit form': 'submit'
    },

    init: function ({msg, submit, cancel}) {
        this._submit = submit;
        this.msg = msg;
        this._onClose = cancel || function () {};
    },

    content: function () {
        return $(`<form class='Prompt'>
                    <p>${this.msg}</p>
                    <input type='text'/>
                  </form>`);
    },

    _onOpen: function () {
        this.$el.find('input').focus();
    },

    submit: function (evt) {
        evt.preventDefault();
        let value = this.$el.find('input').val();
        if (value) {
            value = value.toLowerCase();
        }
        this._submit(value);
        this._onClose = undefined;
        this.close();
    }
});

// Shortcut for prompt modal
Modal.prompt = function (msg, submit, cancel, closable=true) {
    (new Prompt({
        msg,
        submit,
        cancel,
        disposeOnClose: true,
        closable
    })).open();
};

export default Modal;
