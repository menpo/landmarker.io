import { assert } from 'chai';
import { describe, it } from 'vitest';

import {
    compareColour, fitPanelState, modelChip, modelsState
} from '../../src/js/app/lib/fit_status';

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

    it('says how many saved images are left out of learning for their occluded landmarks', function () {
        assert.include(fitPanelState(status({occluded: 2})).lines,
                       '2 saved images left out of learning: a landmark is occluded or out of the frame');
        assert.notMatch(fitPanelState(status({occluded: 0})).lines.join('\n'), /left out/);
    });

    it('says a model that started pretrained is pretrained, plus what it learnt from you', function () {
        const s = fitPanelState(status({has_initial_state: true, trained_on: 6}));
        assert.include(s.lines, 'Pretrained, plus 6 images of yours');
        assert.notInclude(s.lines, 'Learnt from 6 images');
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

describe('modelChip', function () {
    it('shows what the model is doing, or how far it is', function () {
        assert.deepEqual(modelChip(status({job: {kind: 'train', state: 'running', done: 3, total: 9}})),
                         {kind: 'busy', text: 'train 3/9'});
        assert.equal(modelChip(status({error: 'boom'})).kind, 'error');
        assert.equal(modelChip(status({job: {kind: 'predict', state: 'error'}})).kind, 'error');
        assert.deepEqual(modelChip(status({ready: false, annotated: 3})),
                         {kind: 'empty', text: 'needs 8 images (3)'});
        assert.deepEqual(modelChip(status({ready: false, can_increment: false, can_build: false})),
                         {kind: 'empty', text: 'no state'});
        assert.deepEqual(modelChip(status()), {kind: 'ready', text: 'learnt from 12'});
        assert.deepEqual(modelChip(status({has_initial_state: true, trained_on: 6})),
                         {kind: 'ready', text: 'pretrained + 6'});
        assert.deepEqual(modelChip(status({has_initial_state: true, trained_on: 0})),
                         {kind: 'ready', text: 'pretrained'});
        assert.deepEqual(modelChip(status({can_increment: false, can_build: false})),
                         {kind: 'fixed', text: 'pretrained'});
    });
});

describe('modelsState', function () {
    const aam = status({name: 'aam'});
    const mp = status({name: 'mediapipe', can_increment: false, can_build: false,
                       proposals: 46, unlabelled: 46});
    const several = (extra={}) => Object.assign(
        {}, aam, {default: 'aam', models: {aam, mediapipe: mp}}, extra);

    it('lists the models, the default is the active one unless another is chosen', function () {
        let s = modelsState(several());
        assert.deepEqual(s.models.map(m => [m.name, m.isActive, m.isDefault]),
                         [['aam', true, true], ['mediapipe', false, false]]);
        assert.equal(s.active, 'aam');
        s = modelsState(several(), {active: 'mediapipe'});
        assert.equal(s.active, 'mediapipe');
        assert.deepEqual(s.models.map(m => m.isActive), [false, true]);
        assert.deepEqual(s.models.map(m => m.chip.kind), ['ready', 'fixed']);
        // the panel is about the active model
        assert.include(s.panel.lines, 'Fixed model (it does not learn)');
        assert.isFalse(s.panel.learn.enabled);
        // a name the server does not have falls back to the default
        assert.equal(modelsState(several(), {active: 'gone'}).active, 'aam');
    });

    it('works with a server that has one model, as before', function () {
        const s = modelsState(status({name: 'only'}));
        assert.deepEqual(s.models.map(m => m.name), ['only']);
        assert.equal(s.active, 'only');
        assert.isFalse(s.compare.enabled);
        const unnamed = modelsState(status());
        assert.deepEqual(unnamed.models.map(m => m.name), ['PatchAAM']);
    });

    it('can compare when two models are ready and there are landmarks', function () {
        let s = modelsState(several());
        assert.isTrue(s.compare.enabled);
        assert.deepEqual(s.compare.names, ['aam', 'mediapipe']);
        s = modelsState(several(), {hasLandmarks: false});
        assert.isFalse(s.compare.enabled);
        assert.equal(s.compare.reason, 'No landmarks here');
        const notReady = several({models: {aam, mediapipe: Object.assign({}, mp, {ready: false})}});
        s = modelsState(notReady);
        assert.isFalse(s.compare.enabled);
        assert.deepEqual(s.compare.names, ['aam']);
        assert.equal(s.compare.reason, 'Needs two models that are ready');
    });

    it('counts the proposals and what a pre-fit would still do', function () {
        const s = modelsState(several(), {active: 'mediapipe'}).panel;
        assert.equal(s.proposals, 46);
        assert.equal(s.prefitCount, 0);
        assert.include(s.lines, '46 proposals waiting to be checked and saved');
        const more = modelsState(several({models: {aam, mediapipe: Object.assign({}, mp, {proposals: 1})}}),
                                 {active: 'mediapipe'}).panel;
        assert.equal(more.prefitCount, 45);
        assert.include(more.lines, '1 proposal waiting to be checked and saved');
    });
});

describe('compareColour', function () {
    it('is a colour for each model and starts again after the last', function () {
        const first = compareColour(0);
        assert.match(first, /^#[0-9a-f]{6}$/);
        assert.notEqual(compareColour(1), first);
        assert.equal(compareColour(6), first);
    });
});
