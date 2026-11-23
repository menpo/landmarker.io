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
        landmarks: () => lms,
        asset: () => ({id: 'a.png'}),
        activeTemplate: () => 'image',
        server: () => ({
            fitLandmarkGroup: (id, type, sent, box) => {
                calls.push({id, type, sent, box});
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
