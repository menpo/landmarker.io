'use strict';

import $ from 'jquery';

import Modal from './modal';
import { notify } from './notification';
import { fitPanelState } from '../lib/fit_status';

const POLL_MS = 1000;

function messageOf (error) {
    if (typeof error === 'string') {
        return error;
    }
    return (error.body && error.body.message) || error.message || String(error);
}

// The Fit panel: what the server's model is, and what can be done with it. Fitting itself
// is `app.autoFitLandmarks`; this only asks for it.
export default Modal.extend({
    modifiers: ['Fit'],

    events: {
        'click .Fit__Fit': 'fitThis',
        'click .Fit__Box': 'drawBox',
        'click .Fit__Predict': 'predict',
        'click .Fit__Learn': 'learn',
        'change .Fit__LearnOnSave': 'setLearnOnSave',
        'click .Fit__Train': 'train'
    },

    init: function ({app}) {
        this.app = app;
        this.closable = true;
        this.title = 'Fit';
        this.state = null;
        this._timer = null;
    },

    content: function () {
        return $(`
            <div class='Fit'>
                <ul class='Fit__Status'></ul>
                <div class='Fit__Job'></div>
                <div class='Fit__Error'></div>
                <label class='Fit__Current'>
                    <input type='checkbox' class='Fit__FromCurrent' checked>
                    Start from the current landmarks (if they are all placed)
                </label>
                <div class='Fit__Actions'>
                    <button class='Button-Info Fit__Fit'>Fit this image</button>
                    <button class='Button-Info Fit__Box'>Draw a box&hellip;</button>
                </div>
                <label class='Fit__Current'>
                    <input type='checkbox' class='Fit__LearnOnSave'>
                    Learn from each image when I save it
                </label>
                <div class='Fit__Actions'>
                    <button class='Button-Info Fit__Learn'>Learn from this image</button>
                    <button class='Button-Info Fit__Predict'>Fit all unlabelled images</button>
                </div>
                <div class='Fit__Actions'>
                    <button class='Button-Info Fit__Train'>Learn from all annotations</button>
                </div>
            </div>`);
    },

    _onOpen: function () {
        this.refresh();
    },

    _onClose: function () {
        clearTimeout(this._timer);
        this._timer = null;
    },

    // Ask the server, show, and keep asking while it works on a job
    refresh: function () {
        clearTimeout(this._timer);
        const server = this.app.server();
        return server.fetchFitStatus().then((status) => {
            this.render_state(status);
            if (this.isOpen && this.state.busy) {
                this._timer = setTimeout(() => this.refresh(), POLL_MS);
            }
        }, (error) => {
            this.$('.Fit__Error').text(messageOf(error));
        });
    },

    render_state: function (status) {
        const lms = this.app.landmarks();
        const state = this.state = fitPanelState(status, {
            hasLandmarks: !!lms, saved: !!lms && lms.tracker.isUpToDate()
        });
        const $status = this.$('.Fit__Status').empty();
        state.lines.forEach(line => $status.append($('<li>').text(line)));
        this.$('.Fit__Job').text(state.jobLine || '')
            .toggleClass('Fit__Job--Failed', state.jobFailed);
        this.$('.Fit__Error').text(state.error || '');
        const set = (cls, action, label) => {
            const $b = this.$(cls).prop('disabled', !action.enabled)
                                  .attr('title', action.reason);
            if (label) {
                $b.text(label);
            }
        };
        set('.Fit__Fit', state.fit);
        set('.Fit__Box', state.box);
        set('.Fit__Learn', state.learn);
        this.$('.Fit__LearnOnSave').prop('checked', state.learnOnSave)
            .prop('disabled', !state.canSwitchLearnOnSave || state.busy);
        set('.Fit__Predict', state.predict,
            `Fit all unlabelled images (${state.unlabelled})`);
        set('.Fit__Train', state.train,
            `Learn from all annotations (${state.annotated})`);
        this.$('.Fit__FromCurrent').prop('disabled', !state.canStartFromCurrent);
    },

    // run an app action that rejects with a message, tell the annotator how it went
    _run: function (promise, done) {
        promise.then(done, (m) => notify({type: 'error', msg: messageOf(m)}))
               .then(() => this.refresh());
    },

    fitThis: function () {
        const fromCurrent = this.$('.Fit__FromCurrent').prop('checked');
        this.close();
        this._run(this.app.autoFitLandmarks({fromCurrent}), (moved) => notify({
            type: 'success', msg: `Refined ${moved} landmarks (undo with z)`
        }));
    },

    drawBox: function () {
        this.close();
        this.app.beginFitBox();
        notify({
            type: 'info',
            msg: 'Drag to draw the box around the object. Enter fits, Esc cancels'
        });
    },

    learn: function () {
        const id = this.app.asset().id;
        this._run(this.app.server().fitLearn(id), () => notify({
            type: 'info', msg: `Learning from ${id}: see the Fit panel`
        }));
    },

    setLearnOnSave: function () {
        const enabled = this.$('.Fit__LearnOnSave').prop('checked');
        this._run(this.app.server().fitSetLearnOnSave(enabled), () => notify({
            type: 'info', msg: enabled ? 'Learning from each image you save' :
                                         'No longer learning when you save'
        }));
    },

    predict: function () {
        const type = this.app.activeTemplate();
        this._run(this.app.server().fitPredict(type), () => notify({
            type: 'info', msg: 'Fitting the images without landmarks: see the Fit panel'
        }));
    },

    train: function () {
        this._run(this.app.server().fitTrain(), () => notify({
            type: 'info', msg: 'Learning from the annotations: see the Fit panel'
        }));
    }
});
