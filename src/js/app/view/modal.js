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

        _modals[this.key] = this;

        this.opts = this.parseOpts(opts);

        _.bindAll(
            this,
            'render', 'dispose', 'close', 'open', 'content', 'parseOpts'
        );

        this.render();
    },

    render: function () {
        this.$el.addClass(this.className);
        this.$el.attr('id', this.id);

        if (this.closable) {
            this.$el.append($("<div class='close'>&times;</div>"));
            this.$el.on('click .close', this.close);
        }


        let title = this.opts.title;
        if (title) {
            this.$el.append(
                $(`<div class=${this.className}__Title>${title}</div>`)
            );
        }

        let $content = this.content();
        $content.addClass(`${this.className}__Content`);
        if ($content) {
            this.$el.append($content);
        }

        this.$el.appendTo(this.container);

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

    close: function (modalOnly=false) {
        if (this.isOpen) {
            this.isOpen = false;
            _activeModal = undefined;
            this.$el.removeClass(`${this.className}--Open`);
            if (!modalOnly) {
                $(this.container).removeClass('ModalsWrapper--Open');
            }
        }
    },

    dispose: function () {
        this.close();
        this.remove();
    },

    // Implement these method as well as events in your subclass of Modal to
    // populate the modal
    content: function () {
        throw new Error(
            'Not implemented, add a content function to your implementation');
    },

    parseOpts: function (opts) {
        return opts;
    }
});

module.exports = Modal;
