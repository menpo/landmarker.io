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
        'click .RightSidebar-TemplatePicker-Add': 'add',
        'click input': 'clickInput',
        'keyup input': 'filter'
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
            $ul.prepend($(`
                <li id="templatePick_${tmpl}"
                    data-template="${tmpl}"
                    data-index="${index}">${tmpl}</li>
            `));
        });

        this.$el.html($ul);
        this.$el.prepend($(`<input type="text" placeholder='Search templates'/>`));

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
        this.$el.find('input').focus();
    },

    select: function (evt) {
        evt.stopPropagation();
        const tmpl = evt.currentTarget.dataset.template;
        if (tmpl !== this.model.activeTemplate()) {
            this.toggle();
            this.model.autoSaveWrapper(() => {
                this.model.set('activeTemplate', tmpl);
            });
        }
    },

    clickInput: function (evt) {
        evt.stopPropagation();
    },

    add: function (evt) {
        evt.stopPropagation();
        if (typeof this.model.server().pickTemplate === 'function') {
            this.model.server().pickTemplate((name) => {
                this.model.set('_activeTemplate', name);
                this.model._initTemplates();
            }, function (err) {
                Notification.notify({
                    type: 'error',
                    msg: 'Error picking template ' + err
                });
            }, true);
        }
    },

    filter: _.throttle(function (evt) {
        const value = evt.currentTarget.value.toLowerCase();
        if (!value || value === "") {
            this.$el.find('li').fadeIn(200);
        }

        this.model.templates().forEach(function (tmpl) {
            if (tmpl.toLowerCase().indexOf(value) > -1) {
                $(`#templatePick_${tmpl}`).fadeIn(200);
            } else {
                $(`#templatePick_${tmpl}`).fadeOut(200);
            }
        });
    }, 50)
});

export const TemplatePanel = Backbone.View.extend({
    el: '#templatePanel',

    events: {
        'click .TemplateName': 'open',
        'click .TemplateDownload': 'download'
    },

    initialize: function () {
        _.bindAll(this, 'update');
        this.picker = new TemplatePicker({model: this.model});
        this.listenTo(this.model, 'change:activeTemplate', this.update);
    },

    update: function () {

        if (!this.model) {
            return;
        }

        this.undelegateEvents();

        const server = this.model.server();
        const activeTemplate = this.model.activeTemplate();

        const $tn = this.$el.find('.TemplateName');
        this.$el.find('.TemplateDownload').remove();
        $tn.toggleClass('Disabled', this.disabled());
        $tn.text(activeTemplate || '-');

        if (
            typeof server.downloadTemplate === 'function' &&
            activeTemplate && activeTemplate !== ''
        ) {
            this.$el.append(`<div class='TemplateDownload'><span class="octicon octicon-cloud-download"></span></div>`);
        } else {
            this.$el.find('.TemplateDownload').remove();
        }

        this.delegateEvents();
    },

    disabled: function () {

        if (!this.model) {
            return true;
        }

        const server = this.model.server();
        const templates = this.model.templates();
        return (templates.length <= 1 && server instanceof Server) &&
               typeof server.pickTemplate !== 'function';
    },

    open: function () {
        if (!this.disabled()) {
            this.picker.toggle();
        }
    },

    download: function (evt) {
        evt.stopPropagation();
        const server = this.model.server();
        const tmpl = this.model.activeTemplate();

        if (typeof server.downloadTemplate === 'function' && tmpl) {
            server.downloadTemplate(tmpl);
        }
    }
});

export default TemplatePanel;
