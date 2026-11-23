'use strict';

import _ from 'underscore';
import Backbone from 'backbone';
import $ from 'jquery';

import download from '../lib/download';
import atomic from '../model/atomic';
import TemplatePanel from './templates';
import { notify } from './notification';

// Renders a single Landmark. Should update when constituent landmark
// updates and that's it.
export const LandmarkView = Backbone.View.extend({

    tagName: "div",

    events: {
        click: "handleClick"
    },

    initialize: function ({labelIndex}) {
        this.listenTo(this.model, 'change', this.render);
        _.bindAll(this, 'select', 'selectGroup', 'handleClick', 'selectAll');
        this._clickedTimeout = null;
        this.labelIndex = labelIndex;
    },

    render: function () {
        const html = $("<div></div>");
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
        } else if (event.ctrlKey || event.metaKey) {
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

    selectGroup: function () {
        this.model.group().deselectAll();
        this.model.group().labels[this.labelIndex].selectAll();
        $('#viewportContainer').trigger("groupSelected");
    },

    selectAll: function () {
        this.model.group().selectAll();
        $('#viewportContainer').trigger("groupSelected");
    }
});

// Renders the LandmarkList. Don't think this ListView should ever have to
// render (as we build a fresh View each time a group is activated
// and de-activated)
export const LandmarkListView = Backbone.View.extend({

    tagName: 'div',

    initialize: function ({labelIndex}) {
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

    renderOne: function(model) {
        const lm = new LandmarkView({model, labelIndex: this.labelIndex});
        // reset the view's element to it's template
        this.$el.append(lm.render().$el);
        this.lmViews.push(lm);
        return this;
    },

    cleanup: function () {
        this.lmViews.forEach(function (lm) { lm.remove(); });
        this.lmViews = [];
    }

});

export const LandmarkGroupLabelView = Backbone.View.extend({

    className: "LmGroup-Label",

    initialize: function () {
        this.$el.html(this.model.label);
    }
});

// Renders a single LandmarkGroup. Either the view is closed and we just
// render the header (LandmarkGroupButtonView) or this group is active and
// we render all the landmarks (LandmarkListView) as well as the header.
export const LandmarkGroupView = Backbone.View.extend({

    tagName: 'div',

    initialize: function({labelIndex}) {
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
export const LandmarkGroupListView = Backbone.View.extend({

    initialize: function () {
        _.bindAll(this, 'render', 'renderOne');
        this.groups = [];
        this.render();
    },

    render: function() {
        this.cleanup();
        this.$el.empty();
        this.collection.map(this.renderOne);
        if (this.collection.length === 1) {
            this.$el.find('.LmGroup-Flex').addClass('MultiLine');
        }
        return this;
    },

    renderOne: function(label, labelIndex) {
        const group = new LandmarkGroupView({model: label, labelIndex});
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

export const ActionsView = Backbone.View.extend({

    el: '#lmActionsPanel',

    initialize: function({app}) {
        _.bindAll(this, 'save', 'help', 'render');
        this.listenTo(this.model.tracker, "change", this.render);
        this.app = app;
        this.render();
    },

    events: {
        'click #save': "save",
        'click #help': "help",
        'click #download': "download"
    },

    render: function () {
        this.$el.find('#save')
                .toggleClass('Active', !this.model.tracker.isUpToDate());
    },

    save: function (evt) {
        evt.stopPropagation();
        this.$el.find('#save').addClass('Button--Disabled');
        this.model.save().then(() => {
            this.$el.find('#save').removeClass('Button--Disabled');
        }, () => {
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
            this.$el.find('#download').addClass('Button--Disabled');
            const data = JSON.stringify(this.model.toJSON());
            const filename = `${this.app.asset().id}_${this.app.activeTemplate()}.ljson`;
            download(data, filename, 'json');
            this.$el.find('#download').removeClass('Button--Disabled');

        }
    }
});

export const UndoRedoView = Backbone.View.extend({

    el: "#undoRedo",

    events: {
        'click .Undo': 'undo',
        'click .Redo': 'redo'
    },

    initialize: function ({app}) {
        this.tracker = this.model.tracker;
        this.app = app;
        this.listenTo(this.tracker, "change", this.render);
        _.bindAll(this, 'render', 'cleanup', 'undo', 'redo');
        this.render();
    },

    cleanup: function () {
        this.stopListening(this.tracker);
        this.$el.find('.Undo').addClass('Disabled');
        this.$el.find('.Redo').addClass('Disabled');
    },

    render: function () {
        this.$el.find('.Undo').toggleClass('Disabled', !this.tracker.canUndo());
        this.$el.find('.Redo').toggleClass('Disabled', !this.tracker.canRedo());
    },

    undo: function () {
        if (!this.tracker.canUndo()) {
            return;
        } else {
            this.model.undo();
        }
    },

    redo: function () {
        if (!this.tracker.canRedo()) {
            return;
        } else {
            this.model.redo();
        }
    }
});

// What the button says and the toast: with a selection only the curves with a selected
// landmark are spaced, and that has to be visible or the other curves seem not to work
export function resampleText (scope) {
    return scope === null ? 'Space evenly' :
        `Space selected${scope.length ? ` (${scope.join(', ')})` : ''}`;
}

export const ResampleView = Backbone.View.extend({
    el: '#lmResamplePanel',

    events: {
        'click #resample': 'resample',
        'click #closeLoops': 'closeLoops'
    },

    initialize: function () {
        _.bindAll(this, 'resample', 'closeLoops', 'refresh');
        // the selection decides what is spaced
        this.model.landmarks.forEach(lm => this.listenTo(lm, 'change:selected', this.refresh));
        this.refresh();
    },

    refresh: function () {
        const scope = this.model.resampleScope();
        this.$('#resample').text(resampleText(scope)).attr('title', scope === null ?
            'Space all the landmarks evenly along their curves, between the anchors of the template [s]' :
            'Space the curves with selected landmarks evenly; deselect (q) to space them all [s]');
        this.$('#closeLoops').text(closeLoopsText(scope)).attr('title', scope === null ?
            'Close all the loops (eyes, mouth) into straight lines, the points of the two sides on top of each other [f]' :
            'Close the loops with selected landmarks into straight lines; deselect (q) to close them all [f]');
    },

    resample: function () {
        resampleSelectedOrAll(this.model);
    },

    closeLoops: function () {
        closeLoopsSelectedOrAll(this.model);
    }
});

// What the button for closing loops says: like Space evenly, a selection limits it to its loops
export function closeLoopsText (scope) {
    return scope === null ? 'Snap to line' :
        `Snap selected${scope.length ? ` (${scope.join(', ')})` : ''}`;
}

export const FitView = Backbone.View.extend({
    el: '#lmFitPanel',

    events: {
        'click #autoFit': 'fit'
    },

    initialize: function ({app}) {
        _.bindAll(this, 'fit', 'refresh');
        this.app = app;
        this.refresh();
    },

    // shown only if the server has the service (landmarkerio-server --fit)
    refresh: function () {
        const server = this.app.server();
        if (!server || !server.fetchFitStatus) {
            return this.$el.addClass('Hide');
        }
        server.fetchFitStatus().then((status) => {
            this.$el.removeClass('Hide');
            this.$('#autoFit').attr('title', status.ready ?
                `Refine the landmarks with the model learnt from ${status.trained_on} saved images ` :
                `Not ready: it learns from saved images (${status.annotated} of ${status.min_images} needed) `);
        }, () => this.$el.addClass('Hide'));
    },

    fit: function () {
        autoFit(this.app);
        this.refresh();
    }
});

// shared by the button and the keyboard shortcut
export function autoFit (app) {
    app.autoFitLandmarks().then((moved) => {
        notify({
            type: 'success',
            msg: `Refined ${moved} landmarks (undo with z)`
        });
    }, (message) => {
        notify({type: 'error', msg: message});
    });
}

// shared by the button and the keyboard shortcut
export function closeLoopsSelectedOrAll (lms) {
    const scope = lms.resampleScope();  // the labels of the selection, or null
    const moved = lms.closeLoops();
    const where = scope === null ? '' : ` of ${scope.join(', ')} only (q deselects, to snap all)`;
    notify({
        type: moved ? 'success' : 'info',
        msg: moved ? `Snapped the loops${where} to lines: ${moved} landmarks moved (undo with z)` :
                     `Nothing to snap${where}: no loop with all its landmarks placed, or already snapped`
    });
}

// shared by the button and the keyboard shortcut
export function resampleSelectedOrAll (lms) {
    const scope = lms.resampleScope();
    const moved = lms.resample();
    const where = scope === null ? '' : ` of ${scope.join(', ')} only (q deselects, to space all)`;
    notify({
        type: moved ? 'success' : 'info',
        msg: moved ? `Spaced ${moved} landmarks${where} evenly (undo with z)` :
                     `Nothing to move${where}: already even, or no complete curve`
    });
}

export const LmLoadView = Backbone.View.extend({
    el: '#lmLoadPanel',

    events: {
        'click #loadPrevious': 'loadPrevious'
    },

    initialize: function ({app}) {
        _.bindAll(this, 'render', 'loadPrevious');
        this.app = app;
        this.render();
    },

    render: function () {
        const show = this.app.assetSource().hasPredecessor();
        this.$el.toggleClass('Hide', !show);
        this.$el.find('button').toggleClass('Button-Danger',
                                            !this.model.isEmpty());
    },

    loadPrevious: function () {
        this.app.reloadLandmarksFromPrevious();
        this.render();
    }
});

export default Backbone.View.extend({

    initialize: function () {
        _.bindAll(this, "landmarksChange");
        this.listenTo(this.model, "change:landmarks", this.landmarksChange);
        this.actionsView = null;
        this.lmLoadView = null;
        this.fitView = null;
        this.lmView = null;
        this.undoRedoView = null;
        this.templatePanel = new TemplatePanel({model: this.model});
    },

    landmarksChange: function () {
        console.log('Sidebar - rewiring after landmark change');
        if (this.actionsView) {
            this.actionsView.undelegateEvents();
        }

        if (this.lmLoadView) {
            this.lmLoadView.undelegateEvents();
        }

        if (this.fitView) {
            this.fitView.undelegateEvents();
        }

        if (this.resampleView) {
            this.resampleView.undelegateEvents();
        }

        if (this.undoRedoView) {
            this.undoRedoView.undelegateEvents();
        }

        if (this.lmView) {
            this.lmView.cleanup();
        }

        const lms = this.model.landmarks();

        if (lms === null) {
            return;
        }

        this.actionsView = new ActionsView({model: lms, app: this.model});
        this.lmLoadView = new LmLoadView({model: lms, app: this.model});
        this.resampleView = new ResampleView({model: lms});
        this.fitView = new FitView({app: this.model});
        this.undoRedoView = new UndoRedoView({model: lms});
        this.lmView = new LandmarkGroupListView({collection: lms.labels});
        $('#landmarksPanel').html(this.lmView.render().$el);
    }
});
