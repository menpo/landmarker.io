'use strict';

import $ from 'jquery';

import Modal from './modal';
import { notify } from './notification';
import { modelsState } from '../lib/fit_status';

const POLL_MS = 1000;

function messageOf (error) {
    if (typeof error === 'string') {
        return error;
    }
    return (error.body && error.body.message) || error.message || String(error);
}

// The Fit panel: the models of the server, which one is used, and what can be done with it.
// Fitting itself is `app.autoFitLandmarks`; this only asks for it.
export default Modal.extend({
    modifiers: ['Fit'],

    events: {
        'change .Fit__Model': 'chooseModel',
        'click .Fit__Fit': 'fitThis',
        'click .Fit__Box': 'drawBox',
        'click .Fit__Compare': 'compare',
        'click .Fit__Predict': 'predict',
        'click .Fit__Learn': 'learn',
        'change .Fit__LearnOnSave': 'setLearnOnSave',
        'change .Fit__FromPrevious': 'setFromPrevious',
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
                <div class='Fit__Section'>Models</div>
                <ul class='Fit__Models'></ul>
                <ul class='Fit__Status'></ul>
                <div class='Fit__Job'></div>
                <div class='Fit__Error'></div>
                <div class='Fit__Section'>Fit this image</div>
                <label class='Fit__Current'>
                    <input type='checkbox' class='Fit__FromPrevious'>
                    Start from the previous image&rsquo;s landmarks (frames of a video)
                </label>
                <label class='Fit__Current'>
                    <input type='checkbox' class='Fit__FromCurrent' checked>
                    Start from the current landmarks (if they are all placed)
                </label>
                <div class='Fit__Actions'>
                    <button class='Button-Info Fit__Fit'>Fit this image</button>
                    <button class='Button-Info Fit__Box'>Draw a box&hellip;</button>
                    <button class='Button-Info Fit__Compare'>Compare models&hellip;</button>
                </div>
                <div class='Fit__Section'>Learn</div>
                <label class='Fit__Current'>
                    <input type='checkbox' class='Fit__LearnOnSave'>
                    Learn from each image when I save it
                </label>
                <div class='Fit__Actions'>
                    <button class='Button-Info Fit__Learn'>Learn from this image</button>
                    <button class='Button-Info Fit__Train'>Learn from all annotations</button>
                </div>
                <div class='Fit__Section'>Pre-fit</div>
                <label class='Fit__Current'>
                    <input type='checkbox' class='Fit__Chain'>
                    Start each image from the one before it (frames of a video)
                </label>
                <label class='Fit__Current'>
                    <input type='checkbox' class='Fit__Overwrite'>
                    Fit again the images that already have a proposal
                </label>
                <div class='Fit__Actions'>
                    <button class='Button-Info Fit__Predict'>Pre-fit the unlabelled images</button>
                </div>
            </div>`);
    },

    _onOpen: function () {
        this.$('.Fit__FromPrevious').prop('checked', !!this.app.get('fitFromPrevious'));
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
            this.status = status;
            this.render_state(status);
            if (this.isOpen && this.state.panel.busy) {
                this._timer = setTimeout(() => this.refresh(), POLL_MS);
            }
        }, (error) => {
            this.$('.Fit__Error').text(messageOf(error));
        });
    },

    render_state: function (status) {
        const lms = this.app.landmarks();
        const state = this.state = modelsState(status, {
            hasLandmarks: !!lms, saved: !!lms && lms.tracker.isUpToDate(),
            active: this.app.get('fitModel')
        });
        const panel = state.panel;
        const $models = this.$('.Fit__Models').empty();
        state.models.forEach((model) => {
            const $row = $('<li class="Fit__ModelRow">');
            const $radio = $('<input type="radio" name="fitModel" class="Fit__Model">')
                .val(model.name).prop('checked', model.isActive);
            $row.append($('<label>').append(
                $radio, $('<span class="Fit__ModelName">').text(model.name),
                $(`<span class="Fit__Chip Fit__Chip--${model.chip.kind}">`).text(model.chip.text)));
            $models.append($row);
        });
        const $status = this.$('.Fit__Status').empty();
        panel.lines.forEach(line => $status.append($('<li>').text(line)));
        this.$('.Fit__Job').text(panel.jobLine || '')
            .toggleClass('Fit__Job--Failed', panel.jobFailed);
        this.$('.Fit__Error').text(panel.error || '');
        const set = (cls, action, label) => {
            const $b = this.$(cls).prop('disabled', !action.enabled)
                                  .attr('title', action.reason);
            if (label) {
                $b.text(label);
            }
        };
        set('.Fit__Fit', panel.fit);
        set('.Fit__Box', panel.box);
        set('.Fit__Learn', panel.learn);
        this.$('.Fit__Compare').prop('disabled', !state.compare.enabled || panel.busy)
            .attr('title', state.compare.enabled ? '' : state.compare.reason);
        this.$('.Fit__LearnOnSave').prop('checked', panel.learnOnSave)
            .prop('disabled', !panel.canSwitchLearnOnSave || panel.busy);
        set('.Fit__Predict', panel.predict,
            `Pre-fit the unlabelled images (${panel.prefitCount})`);
        set('.Fit__Train', panel.train,
            `Learn from all annotations (${panel.annotated})`);
        this.$('.Fit__FromCurrent').prop('disabled', !panel.canStartFromCurrent);
    },

    // run an app action that rejects with a message, tell the annotator how it went
    _run: function (promise, done) {
        promise.then(done, (m) => notify({type: 'error', msg: messageOf(m)}))
               .then(() => this.refresh());
    },

    _model: function () {
        return this.state ? this.state.active : null;
    },

    _startOptions: function () {
        return {
            fromCurrent: this.$('.Fit__FromCurrent').prop('checked'),
            fromPrevious: this.$('.Fit__FromPrevious').prop('checked')
        };
    },

    chooseModel: function (evt) {
        this.app.set('fitModel', $(evt.currentTarget).val());
        this.refresh();
    },

    setFromPrevious: function () {
        this.app.set('fitFromPrevious', this.$('.Fit__FromPrevious').prop('checked'));
    },

    fitThis: function () {
        const options = Object.assign(this._startOptions(), {model: this._model()});
        this.close();
        this._run(this.app.autoFitLandmarks(options), (moved) => notify({
            type: 'success', msg: `Refined ${moved} landmarks (undo with z)`
        }));
    },

    compare: function () {
        const options = Object.assign(this._startOptions(),
                                      {models: this.state.compare.names});
        this.close();
        this._run(this.app.compareFits(options), () => notify({
            type: 'info', msg: 'Choose the fit to use, or Esc to keep the landmarks'
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
        this._run(this.app.server().fitLearn(id, this._model()), () => notify({
            type: 'info', msg: `Learning from ${id}: see the Fit panel`
        }));
    },

    setLearnOnSave: function () {
        const enabled = this.$('.Fit__LearnOnSave').prop('checked');
        this._run(this.app.server().fitSetLearnOnSave(enabled, this._model()), () => notify({
            type: 'info', msg: enabled ? 'Learning from each image you save' :
                                         'No longer learning when you save'
        }));
    },

    predict: function () {
        const type = this.app.activeTemplate();
        const options = {
            chain: this.$('.Fit__Chain').prop('checked'),
            overwrite: this.$('.Fit__Overwrite').prop('checked')
        };
        this._run(this.app.server().fitPredict(type, this._model(), options), () => notify({
            type: 'info', msg: 'Pre-fitting the images without landmarks: see the Fit panel'
        }));
    },

    train: function () {
        this._run(this.app.server().fitTrain(this._model()), () => notify({
            type: 'info', msg: 'Learning from the annotations: see the Fit panel'
        }));
    }
});
