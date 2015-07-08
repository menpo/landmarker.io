"use strict";

var _ = require('underscore');
var Backbone = require('backbone');
var $ = require('jquery');
var Notification = require('./notification');
var atomic = require('../model/atomic');
var { Dropbox, Server } = require('../backend');
var ListPicker = require('./list_picker');

// Renders a single Landmark. Should update when constituent landmark
// updates and that's it.
var LandmarkView = Backbone.View.extend({

    tagName: "div",

    events: {
        click: "handleClick",
    },

    initialize: function ({labelIndex}) {
        this.listenTo(this.model, 'change', this.render);
        _.bindAll(this, 'select', 'selectGroup', 'handleClick', 'selectAll');
        this._clickedTimeout = null;
        this.labelIndex = labelIndex;
    },

    render: function () {
        //console.log("Landmark:render - " + this.model.get('index') +
        //"(" + this.cid + ", " + this.model.cid + ")");
        var html = $("<div></div>");
        html.addClass("Lm", this.model.isEmpty());

        html.toggleClass("Lm-Empty", this.model.isEmpty());
        html.toggleClass("Lm-Value", !this.model.isEmpty());
        html.toggleClass("Lm-Selected", this.model.isSelected());
        html.toggleClass("Lm-NextAvailable", this.model.isNextAvailable());


        // in case our element is already live replace the content
        this.$el.replaceWith(html);
        // now set the element back so we have a handle. If this is the
        // first time then we have gotten a handle for the future
        this.setElement(html);
        return this;
    },

    handleClick: function (event) {
        if (this._clickedTimeout === null) {
            this._clickedTimeout = setTimeout(() => {
                this._clickedTimeout = null;
                this.select(event);
            }, 200);
        } else {
            clearTimeout(this._clickedTimeout);
            this._clickedTimeout = null;
            this.selectGroup(event);
        }
    },

    select: atomic.atomicOperation(function (event) {
        if (event.shiftKey) {
            this.selectAll(event);
        } else if (this.model.isSelected()) {
            this.model.deselect();
        } else if ((event.ctrlKey || event.metaKey)) {
            if (!this.model.isSelected()) {
                this.model.select();
                $('#viewportContainer').trigger("groupSelected");
            }
        } else if (this.model.isEmpty()) {
            // user is clicking on an empty landmark - mark it as the next for
            // insertion
            this.model.setNextAvailable();
        } else {
            this.model.selectAndDeselectRest();
        }
    }),

    selectGroup: function (event) {
        this.model.group().deselectAll();
        this.model.group().labels[this.labelIndex].landmarks.forEach((lm) => {
            lm.select();
        });

        $('#viewportContainer').trigger("groupSelected");
    },

    selectAll: function (event) {
        this.model.group().landmarks.forEach((lm) => {
            lm.select("groupSelected");
        });

        $('#viewportContainer').trigger("groupSelected");
    }
});

// Renders the LandmarkList. Don't think this ListView should ever have to
// render (as we build a fresh View each time a group is activated
// and de-activated)
var LandmarkListView = Backbone.View.extend({

    tagName: 'div',

    initialize : function({labelIndex}) {
        _.bindAll(this, 'render', 'renderOne');
        this.lmViews = [];
        this.labelIndex = labelIndex;
        this.render();
    },

    render: function() {
        this.cleanup();
        this.$el.empty();
        this.$el.addClass('LmGroup-Flex');
        this.collection.map(this.renderOne);
        return this;
    },

    renderOne : function(model) {
        //console.log("NEW: LandmarkView (LandmarkList.renderOne())");
        var lm = new LandmarkView({model: model, labelIndex: this.labelIndex});
        // reset the view's element to it's template
        this.$el.append(lm.render().$el);
        this.lmViews.push(lm);
        return this;
    },

    cleanup: function () {
        this.lmViews.forEach(function (lm) { lm.remove() });
        this.lmViews = [];
    }

});

var LandmarkGroupLabelView = Backbone.View.extend({

    className: "LmGroup-Label",

    initialize : function() {
        var label = this.model.label;
        this.$el.html(label);
    }
});


// Renders a single LandmarkGroup. Either the view is closed and we just
// render the header (LandmarkGroupButtonView) or this group is active and
// we render all the landmarks (LandmarkListView) as well as the header.
var LandmarkGroupView = Backbone.View.extend({

    tagName: 'div',

    initialize : function({labelIndex}) {
        _.bindAll(this, 'render');
        this.landmarkList = null;
        this.label = null;
        this.labelIndex = labelIndex;
        this.render();
    },

    render: function () {
        this.cleanup();
        this.$el.empty();
        this.$el.addClass('LmGroup');
        this.landmarkList = new LandmarkListView(
            {collection: this.model.landmarks, labelIndex: this.labelIndex});
        this.label = new LandmarkGroupLabelView({model: this.model});
        this.$el.append(this.label.render().$el);
        this.$el.append(this.landmarkList.render().$el);
        return this;
    },

    cleanup: function () {
        if (this.landmarkList) {
            // already have a list view! clean it up + remove
            this.landmarkList.cleanup();
            this.landmarkList.remove();
            this.landmarkList = null;
        }
        if (this.label) {
            // already have a label view! remove
            this.label.remove();
            this.label = null;
        }
    }
});


// Renders a collection of LandmarkGroups. At any one time one of these
// will be expanded - the rest closed. This View is indifferent - it just
// builds LandmarkGroupView's and asks them to render in turn.
var LandmarkGroupListView = Backbone.View.extend({

    initialize : function() {
        _.bindAll(this, 'render', 'renderOne');
        this.groups = [];
        this.render();
    },

    render: function() {
        this.cleanup();
        this.$el.empty();
        this.collection.map(this.renderOne);
        return this;
    },

    renderOne : function(label, labelIndex) {
        var group = new LandmarkGroupView({model: label, labelIndex});
        // reset the view's element to it's template
        this.$el.append(group.render().$el);
        this.groups.push(group);
        return this;
    },

    cleanup: function () {
        this.groups.forEach(function (group) {
            group.cleanup();
            group.remove();
        });
        this.groups = [];
    }

});


var SaveRevertView = Backbone.View.extend({

    el: '#lmActionsPanel',

    initialize : function({app}) {
        _.bindAll(this, 'save', 'help');
        //this.listenTo(this.model, "all", this.render);
        // Get the singleton app model separately as model is the landmarks
        this.app = app;
    },

    events: {
        'click #save' : "save",
        'click #help' : "help",
        'click #download' : "download"
    },

    save: function (evt) {
        evt.stopPropagation();
        this.$el.find('#save').addClass('Button--Disabled');
        this.model.promiseSave().then(() => {
            Notification.notify({type: 'success', msg: 'Save Completed'});
            this.$el.find('#save').removeClass('Button--Disabled');
        }, () => {
            Notification.notify({type: 'error', msg: 'Save Failed'});
            this.$el.find('#save').removeClass('Button--Disabled');
        });
    },

    help: function (e) {
        e.stopPropagation();  // prevent the event from trigging the help immediately
        this.app.toggleHelpOverlay();
    },

    download: function (evt) {
        evt.stopPropagation();
        if (this.model) {
            const spinner = Notification.loading.start();
            this.$el.find('#download').addClass('Button--Disabled');
            const data = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.model.toJSON())),
                filename = `${this.app.asset().id}_${this.app.activeTemplate()}.ljson`;

            // Remove previous element from dom
            const previous = document.getElementById('downloadLMLink');
            if (!!previous) previous.remove();

            const link = document.createElement('a');
            link.setAttribute('style', 'display:none;');
            link.setAttribute('download', filename);
            link.setAttribute('href', `data:${data}`);
            link.setAttribute('id', `downloadLMLink`);
            link.setAttribute('hidden', `true`);

            // target="_blank" for Safari who still does not understand
            // the download attribute
            link.setAttribute('target', '_blank');

            // Add to DOM and click
            document.body.appendChild(link);
            document.getElementById('downloadLMLink').click();

            Notification.loading.stop(spinner);
            this.$el.find('#download').removeClass('Button--Disabled');

        }
    }
});

var TemplatePanel = Backbone.View.extend({
    el: '#templatePanel',

    events: {
        'click': 'click'
    },

    initialize: function () {
        _.bindAll(this, "update");
        this.listenTo(this.model, "change:activeTemplate", this.update);
    },

    update: function () {
        this.$el.toggleClass(
            'Disabled', ( this.model &&
                          this.model.templates().length <= 1 &&
                          this.model.server() instanceof Server )
        );
        this.$el.text(this.model.activeTemplate() || 'No Template Selected');
    },

    click: function (evt) {
        let backend = this.model.server();
        if (backend instanceof Dropbox) {
            backend.pickTemplate((tmpls) => {
                this.model._initTemplates(true);
            }, function (err) {
                Notification.notify({
                    type: 'error',
                    msg: 'Error switching template ' + err
                });
            }, true);
        } else if (backend instanceof Server) {

            const tmpls = this.model.templates();

            if (tmpls.length <= 1) {
                return;
            }

            const picker = new ListPicker({
                list: tmpls.map(t => [t, t]),
                title: 'Select a template',
                closable: true,
                disposeOnClose: true,
                useFilter: tmpls.length > 5,
                submit: tmpl => this.model.set('activeTemplate', tmpl)
            });
            picker.open();
        }
    }
});

var Sidebar = Backbone.View.extend({

    initialize : function() {
        _.bindAll(this, "landmarksChange");
        this.listenTo(this.model, "change:landmarks", this.landmarksChange);
        this.saveRevertView = null;
        this.lmView = null;
        this.templatePanel = new TemplatePanel({model: this.model});
    },

    landmarksChange: function () {
        console.log('Sidebar - rewiring after landmark change');
        if (this.saveRevertView) {
            // break bindings for save revert
            this.saveRevertView.undelegateEvents();
        }
        var lms = this.model.landmarks();
        if (lms === null) {
            return;
        }
        this.saveRevertView = new SaveRevertView({model: lms, app: this.model});
        if (this.lmView) {
            this.lmView.cleanup();
        }
        this.lmView = new LandmarkGroupListView({
            collection: lms.labels
        });
        $('#landmarksPanel').html(this.lmView.render().$el)
    }

});


exports.Sidebar = Sidebar;
