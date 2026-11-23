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
            fitLandmarkGroup: (id, type, sent) => {
                calls.push({id, type, sent});
                return response();
            }
        })
    };
    return {app, lms, calls};
}
const fit = (app) => App.prototype.autoFitLandmarks.call(app);
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
});
