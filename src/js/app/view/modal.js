"use strict";

var Backbone = require('backbone'),
    _ = require('underscore'),
    $ = require('jquery');

var _modals = {},
    _activeModal = undefined;

function _key () {
    return (new Date()).getTime() + Math.floor(Math.random()) * 1000;
}

var Modal = Backbone.View.extend({
    tagName: 'div',
    container: '#modalsWrapper',
    className: 'ModalWindow',
    closable: true,

    initialize: function (opts={}) {
        this.key = _key();
        this.id = `modalWindow$$${this.key}`;
        this.isOpen = false;
        this.disposeOnClose = !!opts.disposeOnClose

        _modals[this.key] = this;

        if (opts.title) {
            this.title = opts.title;
        }


        this.init(opts);

        _.bindAll(
            this,
            'render', 'dispose', 'close', 'open',
            'content', 'init', 'afterRender'
        );

        this.render();
    },

    render: function () {
        this.$el.addClass(this.className);
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

        let $content = this.content();
        $content.addClass(`${this.className}__Content`);
        if ($content) {
            this.$el.append($content);
        }

        this.$el.appendTo(this.container);
        this.afterRender();
    },

    open: function () {
        this.isOpen = true;
        if (_activeModal) {
            _modals[_activeModal].close(true);
        }
        $(this.container).addClass('ModalsWrapper--Open');
        this.$el.addClass(`${this.className}--Open`);
        _activeModal = this.key;
    },

    _close: function () {
        if (this.isOpen) {
            this.isOpen = false;
            _activeModal = undefined;
            this.$el.removeClass(`${this.className}--Open`);
            $(this.container).removeClass('ModalsWrapper--Open');
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

    // Implement these method as well as events in your subclass of Modal to
    // populate the modal
    content: function () {
        throw new Error(
            'Not implemented, add a content function to your implementation');
    },

    init: function (opts) {},
    afterRender: function () {}
});

var SelectModal = Modal.extend({

    init: function ({closable=false, actions=[], disposeAfter=true}) {
        this.closable = closable;
        this.actions = actions;
    },

    content: function () {
        let $div = $(`<div class='ModalOptions'></div>`);
        this.actions.forEach(([text, func], index) => {
            $div.append(`\
                <div class='ModalOption' id='ModalOption_${this.key}_${index}'>\
                    ${text}\
                </div>`);
        });
        return $div;
    },

    afterRender: function () {
        this.actions.forEach(([text, func], index) => {
            $(`#ModalOption_${this.key}_${index}`).on('click', () => {
                if (this.isOpen) {
                    func();
                    this.close();
                }
            });
        });
    }
});

function activeModal () {
    return _modals[_activeModal];
}

module.exports = { Modal, SelectModal, activeModal };
