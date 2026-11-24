// @vitest-environment jsdom
import { assert } from 'chai';
import { describe, it } from 'vitest';

import App from '../../../src/js/app/model/app';
import LandmarkGroup from '../../../src/js/app/model/landmark_group';

const POINTS = [[0, 0], [1, 2], [4, 4]];
const json = (points) => ({
    landmarks: {points, connectivity: [[0, 1], [1, 2]]},
    labels: [{label: 'all', mask: [0, 1, 2]}],
    version: 2
});

// the part of the app that autoFitLandmarks uses
function fakeApp (response) {
    const lms = LandmarkGroup.parse(json(POINTS), 'a', 'image', null);
    const calls = [];
    const app = {
        get: () => null,
        landmarks: () => lms,
        asset: () => ({id: 'a.png'}),
        activeTemplate: () => 'image',
        server: () => ({
            fitLandmarkGroup: (id, type, sent, box, model) => {
                calls.push({id, type, sent, box, model});
                return response();
            }
        })
    };
    return {app, lms, calls};
}
const fit = (app, options) => App.prototype.autoFitLandmarks.call(app, options);
const xy = (g) => g.landmarks.map(lm => [lm.point().x, lm.point().y]);

describe('App#autoFitLandmarks', function () {
    it('sends what is on the screen, applies the refined points and can be undone', async function () {
        const refined = [[0, 0], [1.5, 2.5], [4, 5]];
        const {app, lms, calls} = fakeApp(() => Promise.resolve(json(refined)));
        const moved = await fit(app);
        assert.equal(moved, 2);
        assert.deepEqual(calls.map(c => [c.id, c.type]), [['a.png', 'image']]);
        assert.deepEqual(calls[0].sent.landmarks.points, POINTS);
        assert.deepEqual(xy(lms), refined);
        lms.undo();
        assert.deepEqual(xy(lms), POINTS);
        lms.redo();
        assert.deepEqual(xy(lms), refined);
    });

    it('rejects with what the server said, and leaves the landmarks alone', async function () {
        const error = Object.assign(Error('Conflict'), {
            status: 409, body: {message: 'the model needs 8 reviewed images'}
        });
        const {app, lms} = fakeApp(() => Promise.reject(error));
        let message = null;
        await fit(app).catch(m => { message = m; });
        assert.equal(message, 'the model needs 8 reviewed images');
        assert.deepEqual(xy(lms), POINTS);
        // without a body it is the status text
        const plain = fakeApp(() => Promise.reject(Error('Network Error')));
        await fit(plain.app).catch(m => { message = m; });
        assert.equal(message, 'Network Error');
    });

    it('sends the box to start from, if there is one', async function () {
        const {app, calls} = fakeApp(() => Promise.resolve(json(POINTS)));
        const box = [[0, 0], [5, 5]];
        await fit(app, {box});
        assert.deepEqual(calls[0].box, box);
        assert.deepEqual(calls[0].sent.landmarks.points, POINTS);
        await fit(app);
        assert.isUndefined(calls[1].box);
    });

    it('can ignore the landmarks that are placed, to start from the model\'s own shape', async function () {
        const {app, calls} = fakeApp(() => Promise.resolve(json(POINTS)));
        await fit(app, {fromCurrent: false});
        assert.deepEqual(calls[0].sent.landmarks.points, POINTS.map(() => [null, null]));
        // the landmarks on the screen were not touched by sending
        const box = [[0, 0], [5, 5]];
        await fit(app, {fromCurrent: false, box});
        assert.deepEqual(calls[1].sent.landmarks.points, POINTS);
    });
});

// the drawing of the box to start a fit from
describe('App fit box', function () {
    const fakeBoxApp = (suggest) => {
        const attrs = {fitBoxMode: false, fitBox: null};
        const asset = {id: 'a.png'};
        const calls = [];
        const app = {
            get: (k) => attrs[k],
            set: (k, v) => {
                if (typeof k === 'object') { Object.assign(attrs, k); } else { attrs[k] = v; }
            },
            asset: () => asset,
            server: () => ({fetchFitBox: () => suggest()}),
            autoFitLandmarks: (options) => { calls.push(options); return Promise.resolve(3); }
        };
        app.endFitBox = () => App.prototype.endFitBox.call(app);
        return {app, attrs, calls};
    };

    it('starts from the box the model suggests', async function () {
        const {app, attrs} = fakeBoxApp(() => Promise.resolve([[1, 1], [2, 2]]));
        await App.prototype.beginFitBox.call(app);
        assert.isTrue(attrs.fitBoxMode);
        assert.deepEqual(attrs.fitBox, [[1, 1], [2, 2]]);
    });

    it('starts empty when there is no suggestion', async function () {
        const {app, attrs} = fakeBoxApp(() => Promise.reject(Error('409')));
        await App.prototype.beginFitBox.call(app);
        assert.isTrue(attrs.fitBoxMode);
        assert.isNull(attrs.fitBox);
    });

    it('drops a suggestion that arrives after the box was given up', async function () {
        let resolve;
        const {app, attrs} = fakeBoxApp(() => new Promise(r => { resolve = r; }));
        const began = App.prototype.beginFitBox.call(app);
        app.endFitBox();
        resolve([[1, 1], [2, 2]]);
        await began;
        assert.isFalse(attrs.fitBoxMode);
        assert.isNull(attrs.fitBox);
    });

    it('fits in the box that is shown and then leaves box mode', async function () {
        const {app, attrs, calls} = fakeBoxApp(() => Promise.resolve([[1, 1], [2, 2]]));
        await App.prototype.beginFitBox.call(app);
        await App.prototype.fitInBox.call(app);
        assert.deepEqual(calls, [{box: [[1, 1], [2, 2]]}]);
        assert.isFalse(attrs.fitBoxMode);
    });

    it('does not fit without a box', async function () {
        const {app, calls} = fakeBoxApp(() => Promise.reject(Error('409')));
        await App.prototype.beginFitBox.call(app);
        let message = null;
        await App.prototype.fitInBox.call(app).catch(m => { message = m; });
        assert.equal(message, 'Draw a box first');
        assert.deepEqual(calls, []);
    });

    it('gives up the box when the image changes', function () {
        const {app, attrs} = fakeBoxApp(() => Promise.resolve([[1, 1], [2, 2]]));
        app.assetSource = () => ({asset: () => ({id: 'b.png'})});
        return App.prototype.beginFitBox.call(app).then(() => {
            App.prototype.assetChanged.call(app);
            assert.isFalse(attrs.fitBoxMode);
            assert.isNull(attrs.fitBox);
        });
    });
});

// several models: the one asked for, the previous frame as a start, and comparing the fits
describe('App fit models', function () {
    const OTHER = [[0, 0], [2, 3], [4, 6]];

    // `answers`: the fitted points for each model name ('default' is the one without a name)
    function modelApp ({answers, previous=json(OTHER), attrs={}, index=1}={}) {
        const lms = LandmarkGroup.parse(json(POINTS), 'b.png', 'image', null);
        const state = Object.assign({fitModel: null, fitCompare: null}, attrs);
        const calls = [];
        const assets = [{id: 'a.png'}, {id: 'b.png'}];
        const app = {
            get: (k) => state[k],
            set: (k, v) => { state[k] = v; },
            landmarks: () => lms,
            asset: () => assets[index],
            activeTemplate: () => 'image',
            assetSource: () => ({
                hasPredecessor: () => index > 0,
                assets: () => assets,
                assetIndex: () => index
            }),
            server: () => ({
                fetchLandmarkGroup: (id) => {
                    calls.push({fetched: id});
                    return previous ? Promise.resolve(previous) : Promise.reject(Error('none'));
                },
                fitLandmarkGroup: (id, type, sent, box, model) => {
                    calls.push({id, sent, box, model});
                    const points = answers[model || 'default'];
                    return points instanceof Error ? Promise.reject(points) :
                        Promise.resolve(json(points));
                }
            })
        };
        app.endCompare = () => App.prototype.endCompare.call(app);
        return {app, lms, calls, state};
    }
    const call = (name, app, ...args) => App.prototype[name].call(app, ...args);

    it('fits with the model that was asked for, else the one chosen, else the default', async function () {
        const {app, calls} = modelApp({answers: {default: POINTS, aam: POINTS, mp: POINTS}});
        await call('autoFitLandmarks', app, {model: 'mp'});
        await call('autoFitLandmarks', app);
        app.get = (k) => (k === 'fitModel' ? 'aam' : null);
        await call('autoFitLandmarks', app);
        assert.deepEqual(calls.map(c => c.model), ['mp', undefined, 'aam']);
    });

    it('can start from the previous image\'s landmarks, saved or proposed', async function () {
        const {app, calls} = modelApp({answers: {default: POINTS}});
        await call('autoFitLandmarks', app, {fromPrevious: true});
        assert.deepEqual(calls[0], {fetched: 'a.png'});
        assert.deepEqual(calls[1].sent.landmarks.points, OTHER);
        // not asked for: the current landmarks, and nothing is fetched
        const plain = modelApp({answers: {default: POINTS}});
        await call('autoFitLandmarks', plain.app);
        assert.deepEqual(plain.calls.map(c => c.fetched), [undefined]);
        assert.deepEqual(plain.calls[0].sent.landmarks.points, POINTS);
    });

    it('starts from the current landmarks when there is no usable previous image', async function () {
        const first = modelApp({answers: {default: POINTS}, index: 0});
        await call('autoFitLandmarks', first.app, {fromPrevious: true});
        assert.deepEqual(first.calls[0].sent.landmarks.points, POINTS);  // no fetch: the first one
        const none = modelApp({answers: {default: POINTS}, previous: null});
        await call('autoFitLandmarks', none.app, {fromPrevious: true});
        assert.deepEqual(none.calls[1].sent.landmarks.points, POINTS);
        const partial = modelApp({answers: {default: POINTS},
                                  previous: json([[0, 0], [null, null], [4, 4]])});
        await call('autoFitLandmarks', partial.app, {fromPrevious: true});
        assert.deepEqual(partial.calls[1].sent.landmarks.points, POINTS);
        // a drawn box is the start, not the previous image
        const boxed = modelApp({answers: {default: POINTS}});
        await call('autoFitLandmarks', boxed.app, {fromPrevious: true, box: [[0, 0], [5, 5]]});
        assert.deepEqual(boxed.calls.map(c => c.fetched), [undefined]);
    });

    it('compares the fits of several models without changing the landmarks', async function () {
        const a = [[0, 0], [1.5, 2], [4, 4]];
        const b = [[0, 0], [1, 2], [4, 5]];
        const {app, lms, calls, state} = modelApp({answers: {aam: a, mp: b}});
        const result = await call('compareFits', app, {models: ['aam', 'mp']});
        assert.deepEqual(calls.map(c => c.model), ['aam', 'mp']);
        assert.deepEqual(state.fitCompare.results.map(r => [r.model, r.moved]),
                         [['aam', 1], ['mp', 1]]);
        assert.deepEqual(state.fitCompare.failed, []);
        assert.equal(result.results.length, 2);
        assert.deepEqual(xy(lms), POINTS);  // nothing moved yet
    });

    it('compares what worked and says what did not, and fails only if nothing worked', async function () {
        const error = Object.assign(Error('Conflict'), {status: 409, body: {message: 'not ready'}});
        const half = modelApp({answers: {aam: [[0, 0], [1, 2], [4, 4]], mp: error}});
        await call('compareFits', half.app, {models: ['aam', 'mp']});
        assert.deepEqual(half.state.fitCompare.results.map(r => r.model), ['aam']);
        assert.deepEqual(half.state.fitCompare.failed, [{model: 'mp', message: 'not ready'}]);
        const none = modelApp({answers: {aam: error, mp: error}});
        let message = null;
        await call('compareFits', none.app, {models: ['aam', 'mp']}).catch(m => { message = m; });
        assert.equal(message, 'aam: not ready; mp: not ready');
        assert.isNull(none.state.fitCompare);
        await call('compareFits', none.app, {models: ['aam']}).catch(m => { message = m; });
        assert.equal(message, 'Comparing needs landmarks and two models');
    });

    it('takes the fit of one model, undoably, and ends the comparison', async function () {
        const b = [[0, 0], [1, 2], [4, 5]];
        const {app, lms, state} = modelApp({answers: {aam: [[0, 0], [1.5, 2], [4, 4]], mp: b}});
        await call('compareFits', app, {models: ['aam', 'mp']});
        const moved = await call('useFit', app, 'mp');
        assert.equal(moved, 1);
        assert.deepEqual(xy(lms), b);
        assert.isNull(state.fitCompare);
        lms.undo();
        assert.deepEqual(xy(lms), POINTS);
        let message = null;
        await call('useFit', app, 'mp').catch(m => { message = m; });
        assert.equal(message, 'No such fit to use');
    });

    it('drops a comparison that finishes on another image, and gives it up on a new image', async function () {
        const {app, state} = modelApp({answers: {aam: POINTS, mp: POINTS}});
        let current = app.asset();
        app.asset = () => current;
        const running = call('compareFits', app, {models: ['aam', 'mp']});
        current = {id: 'c.png'};
        await running;
        assert.isNull(state.fitCompare);
        // a comparison on screen ends with the image
        state.fitCompare = {results: [], failed: []};
        app.assetSource = () => ({asset: () => ({id: 'c.png'})});
        call('assetChanged', app);
        assert.isNull(state.fitCompare);
    });
});

describe('Server fit routes', function () {
    it('are for the default model, or for one by name', async function () {
        const calls = [];
        const { vi } = await import('vitest');
        vi.resetModules();
        vi.doMock('../../../src/js/app/lib/requests', () => ({
            getJSON: (url) => { calls.push(['GET', url]); return Promise.resolve({}); },
            putJSON: () => Promise.resolve({}),
            postJSON: (url, {data}) => { calls.push(['POST', url, data]); return Promise.resolve({}); },
            getArrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
        }));
        const { default: Server } = await import('../../../src/js/app/backend/server');
        const server = Object.create(Server.prototype);
        server.map = (path) => `/api/v2/${path}`;
        server.fitLandmarkGroup('a b', 'image', {x: 1}, null, 'mp');
        server.fitLandmarkGroup('a', 'image', {x: 1}, [[0, 0], [1, 1]]);
        server.fetchFitBox('a', 'my aam');
        server.fetchFitBox('a');
        server.fitTrain('mp');
        server.fitTrain();
        server.fitLearn('a', 'mp');
        server.fitSetLearnOnSave(false, 'mp');
        server.fitPredict('ibug68', 'mp', {chain: true});
        server.fitPredict('ibug68');
        vi.doUnmock('../../../src/js/app/lib/requests');
        assert.deepEqual(calls, [
            ['POST', '/api/v2/fit/models/mp/fit/a b/image', {x: 1}],
            ['POST', '/api/v2/fit/a/image', {x: 1, box: [[0, 0], [1, 1]]}],
            ['GET', '/api/v2/fit/models/my%20aam/box/a'],
            ['GET', '/api/v2/fit/box/a'],
            ['POST', '/api/v2/fit/models/mp/train', undefined],
            ['POST', '/api/v2/fit/train', undefined],
            ['POST', '/api/v2/fit/models/mp/learn/a', undefined],
            ['POST', '/api/v2/fit/models/mp/learn_on_save', {enabled: false}],
            ['POST', '/api/v2/fit/models/mp/predict/ibug68', {overwrite: false, chain: true}],
            ['POST', '/api/v2/fit/predict/ibug68', {overwrite: false, chain: false}]
        ]);
    });
});
