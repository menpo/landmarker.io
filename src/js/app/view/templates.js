'use strict';

import _ from 'underscore';
import Backbone from 'backbone';
import $ from 'jquery';

import Server from '../backend/server';
// import ListPicker from './list_picker';

export const TemplatePicker = Backbone.View.extend({

    el: '#templatePicker',

    events: {
        'click li': 'select',
        'click .RightSidebar-TemplatePicker-Add': 'add'
    },

    initialize: function () {
        _.bindAll(this, 'update', 'render', 'select', 'add', 'reload');
        this.listenTo(this.model, 'change:activeTemplate', this.update);
        this.listenTo(this.model, 'change:templates', this.reload);
    },

    render: function () {
        const backend = this.model.server();
        const $ul = $('<ul></ul>');
        this.model.templates().forEach((tmpl, index) => {
            $ul.append($(`
                <li id="templatePick_${tmpl}"
                    data-template="${tmpl}"
                    data-index="${index}">${tmpl}</li>
            `));
        });

        this.$el.html($ul);
        this.$el.css(
            'top', `-${this.model.templates().length * 42 + 22}px`);

        if (typeof backend.pickTemplate === 'function') {
            this.$el.append(`<div class='RightSidebar-TemplatePicker-Add'></div>`);
        }

        this.update();
    },

    update: function () {
        const activeTmpl = this.model.activeTemplate();
        if (activeTmpl) {
            this.$el.find('li').removeClass('Active');
            this.$el.find(`#templatePick_${activeTmpl}`)
                    .addClass('Active');
        }
    },

    reload: function () {
        this.undelegateEvents();
        this.render();
        this.delegateEvents();
    },

    toggle: function () {
        this.$el.toggleClass('Active');
    },

    select: function (evt) {
        evt.stopPropagation();
        const tmpl = evt.currentTarget.dataset.template;
        if (tmpl !== this.model.activeTemplate()) {
            this.toggle();
            this.model.set('activeTemplate', tmpl);
        }
    },

    add: function (evt) {
        evt.stopPropagation();
        if (typeof this.model.server().pickTemplate === 'function') {
            this.model.server().pickTemplate(() => {
                this.model._initTemplates(true);
            }, function (err) {
                Notification.notify({
                    type: 'error',
                    msg: 'Error picking template ' + err
                });
            }, true);
        }
    }
});

export const TemplatePanel = Backbone.View.extend({
    el: '#templatePanel',

    events: {
        'click': 'click'
    },

    initialize: function () {
        _.bindAll(this, 'update');
        this.picker = new TemplatePicker({model: this.model});
        this.listenTo(this.model, 'change:activeTemplate', this.update);
    },

    update: function () {
        this.$el.toggleClass(
            'Disabled', this.model &&
            ((this.model.templates().length <= 1 &&
            this.model.server() instanceof Server) &&
            typeof this.model.server().pickTemplate !== 'function')
        );
        this.$el.find('span').text(this.model.activeTemplate() || '-');
    },

    click: function () {
        this.picker.toggle();
    }
});

export default TemplatePanel;
