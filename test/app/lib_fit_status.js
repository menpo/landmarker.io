import { assert } from 'chai';
import { describe, it } from 'vitest';

import { fitPanelState } from '../../src/js/app/lib/fit_status';

const status = (extra={}) => Object.assign({
    ready: true, model: 'PatchAAM', can_increment: true, can_build: true, can_initialize: true,
    learn_on_save: true, has_initial_state: false, trained_on: 12, annotated: 12,
    unlabelled: 30, min_images: 8, job: null, error: null
}, extra);

describe('fitPanelState', function () {
    it('allows everything for a ready model that learns', function () {
        const s = fitPanelState(status());
        assert.deepEqual([s.fit, s.box, s.predict, s.train].map(a => a.enabled),
                         [true, true, true, true]);
        assert.include(s.lines, 'Model: PatchAAM');
        assert.include(s.lines, 'Learnt from 12 images');
        assert.include(s.lines, 'Learns from each image you save');
        assert.isFalse(s.busy);
    });

    it('says what is missing before the model is ready', function () {
        const s = fitPanelState(status({ready: false, trained_on: 0, annotated: 3}));
        assert.include(s.lines, 'Not ready: needs 8 annotated images (3 so far)');
        assert.isFalse(s.fit.enabled);
        assert.isFalse(s.predict.enabled);
        assert.isTrue(s.train.enabled);
    });

    it('a model that cannot learn can fit but not train or learn on save', function () {
        const s = fitPanelState(status({can_increment: false, can_build: false}));
        assert.include(s.lines, 'Fixed model (it does not learn)');
        assert.notInclude(s.lines.join('\n'), 'save');
        assert.isTrue(s.fit.enabled);
        assert.isFalse(s.train.enabled);
        assert.equal(s.train.reason, 'This model cannot be trained');
    });

    it('a model without initialize cannot draw a box or fit unlabelled images', function () {
        const s = fitPanelState(status({can_initialize: false}));
        assert.isTrue(s.fit.enabled);
        assert.isFalse(s.box.enabled);
        assert.isFalse(s.predict.enabled);
    });

    it('needs landmarks on the image to fit it', function () {
        const s = fitPanelState(status(), {hasLandmarks: false});
        assert.isFalse(s.fit.enabled);
        assert.isFalse(s.box.enabled);
        assert.isFalse(s.canStartFromCurrent);
    });

    it('offers nothing to fit when every image has landmarks', function () {
        const s = fitPanelState(status({unlabelled: 0}));
        assert.isFalse(s.predict.enabled);
        assert.equal(s.predict.reason, 'Every image has landmarks');
    });

    it('locks every action while a job runs, and shows its progress', function () {
        const s = fitPanelState(status({
            job: {kind: 'predict', state: 'running', done: 4, total: 30}}));
        assert.isTrue(s.busy);
        assert.equal(s.jobLine, 'predict: running, 4 of 30');
        assert.isFalse(s.fit.enabled);
        assert.isFalse(s.train.enabled);
        assert.equal(s.fit.reason, 'Wait for the job');
    });

    it('shows how a job ended, and its failure', function () {
        const done = fitPanelState(status({
            job: {kind: 'train', state: 'done', done: 12, total: 12, message: 'learnt from 12 images'}}));
        assert.equal(done.jobLine, 'train: learnt from 12 images');
        assert.isFalse(done.jobFailed);
        assert.isTrue(done.train.enabled);
        const failed = fitPanelState(status({
            job: {kind: 'train', state: 'error', done: 1, total: 12, message: 'ValueError: x'},
            error: 'ValueError: x'}));
        assert.isTrue(failed.jobFailed);
        assert.equal(failed.error, 'ValueError: x');
    });

    it('learns one image only when it is saved and the model can add images', function () {
        assert.isTrue(fitPanelState(status()).learn.enabled);
        const unsaved = fitPanelState(status(), {saved: false});
        assert.isFalse(unsaved.learn.enabled);
        assert.equal(unsaved.learn.reason, 'Save this image first (ctrl+s)');
        assert.isTrue(unsaved.fit.enabled);  // fitting does not need it saved
        const fixed = fitPanelState(status({can_increment: false}));
        assert.isFalse(fixed.learn.enabled);
        assert.equal(fixed.learn.reason, 'This model cannot learn one image at a time');
        assert.isFalse(fixed.canSwitchLearnOnSave);
        assert.isFalse(fitPanelState(status({ready: false})).learn.enabled);
    });

    it('shows the learn-on-save switch as the server has it', function () {
        assert.isTrue(fitPanelState(status()).learnOnSave);
        assert.isFalse(fitPanelState(status({learn_on_save: false})).learnOnSave);
        assert.isTrue(fitPanelState(status()).canSwitchLearnOnSave);
    });
});
