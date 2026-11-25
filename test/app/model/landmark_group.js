// @vitest-environment jsdom
import { assert } from 'chai';
import * as THREE from 'three';
import { describe, it } from 'vitest';

import LandmarkGroup, { mergeMoves, predictedBy } from '../../../src/js/app/model/landmark_group';
import { makeCurve } from '../../../src/js/app/lib/spline';

// a chain of five points along a curve, unevenly spaced, then a loop of four
const POINTS = [
    [0, 0], [1, 0.2], [4, 1], [5, 1.1], [10, 0],
    [20, 0], [26, 2], [20, 6], [16, 3]
];
const CONNECTIVITY = [[0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [8, 5]];
const LABELS = [
    {label: 'chain', mask: [0, 1, 2, 3, 4], anchors: [0, 2, 4]},
    {label: 'loop', mask: [5, 6, 7, 8], anchors: [5]}
];

function group (points = POINTS) {
    return LandmarkGroup.parse({
        landmarks: {points, connectivity: CONNECTIVITY},
        labels: LABELS,
        version: 2
    }, 'face', 'image', null);
}

const xy = (g) => g.landmarks.map(lm => lm.point() ? [lm.point().x, lm.point().y] : null);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('LandmarkGroup#resample', function () {
    it('spaces the points between the anchors and keeps the anchors', function () {
        const g = group();
        const moved = g.resample();
        const now = xy(g);
        assert.isAbove(moved, 0);
        [0, 2, 4, 5].forEach(i => assert.deepEqual(now[i], POINTS[i]));
        // Resampling puts the points at equal steps of arc length along the curve the points had,
        // so find where on that curve the new points are (to the nearest of its samples, hence the
        // tolerance) and compare the steps.
        const arcOf = (indices, closed) => {
            const curve = makeCurve(indices.map(i => POINTS[i]), closed);
            return indices.map(i => {
                let best = 0, bestDistance = Infinity;
                curve.dense.forEach((q, k) => {
                    const d = dist(q, now[i]);
                    if (d < bestDistance) { best = k; bestDistance = d; }
                });
                return curve.arc[best];
            });
        };
        const steps = (arcs, total) => arcs.slice(1).map((v, k) => v - arcs[k])
            .concat(total === undefined ? [] : [total - arcs[arcs.length - 1]]);
        const near = (xs) => xs.forEach(x => assert.closeTo(x, xs[0], 0.05 * xs[0]));
        near(steps(arcOf([0, 1, 2], false)));
        near(steps(arcOf([2, 3, 4], false)));
        const loop = makeCurve([5, 6, 7, 8].map(i => POINTS[i]), true);
        near(steps(arcOf([5, 6, 7, 8], true), loop.length));
    });

    it('can be undone and redone as one operation', function () {
        const g = group();
        g.resample();
        assert.isTrue(g.tracker.canUndo());
        g.undo();
        xy(g).forEach((p, i) => {
            assert.closeTo(p[0], POINTS[i][0], 1e-9);
            assert.closeTo(p[1], POINTS[i][1], 1e-9);
        });
        g.redo();
        assert.notDeepEqual(xy(g)[1], POINTS[1]);
    });

    it('only does the curves with a selected landmark when there is a selection', function () {
        const g = group();
        g.landmarks[6].set('selected', true);
        g.resample();
        const now = xy(g);
        [0, 1, 2, 3, 4].forEach(i => assert.deepEqual(now[i], POINTS[i]));  // the chain was left
        assert.notDeepEqual(now[6], POINTS[6]);
    });

    it('is a no-op on something already even, and on a curve with an unplaced landmark', function () {
        const g = group();
        g.resample();
        const once = xy(g);
        g.resample();
        xy(g).forEach((p, i) => {   // the curve through the new points is not quite the old one
            assert.closeTo(p[0], once[i][0], 0.6);
            assert.closeTo(p[1], once[i][1], 0.6);
        });

        const gap = group();
        gap.landmarks[3].clear();
        gap.resample();
        [0, 1, 2, 4].forEach(i => assert.deepEqual(xy(gap)[i], POINTS[i]));
    });

    it('keeps the anchors in what it saves', function () {
        const json = group().toJSON();
        assert.deepEqual(json.labels[0].anchors, [0, 2, 4]);
        assert.deepEqual(json.labels[1].anchors, [5]);
    });
});

describe('LandmarkGroup#resampleScope', function () {
    it('is every curve (null) without a selection, and the labels of the selection with one', function () {
        const g = group();
        assert.isNull(g.resampleScope());
        g.landmarks[1].select();
        assert.deepEqual(g.resampleScope(), ['chain']);
        g.landmarks[6].select();
        assert.deepEqual(g.resampleScope(), ['chain', 'loop']);
        g.deselectAll();
        assert.isNull(g.resampleScope());
    });

    it('is what resample then touches: a selection leaves the other curves alone', function () {
        const g = group();
        g.landmarks[1].select();  // on the chain only
        g.resample();
        assert.notDeepEqual(xy(g)[1], POINTS[1]);
        [5, 6, 7, 8].forEach(i => assert.deepEqual(xy(g)[i], POINTS[i]));
    });
});

describe('auto-space: spacing after a drag', function () {
    const drag = (g, index, dx, dy) => {
        const lm = g.landmarks[index];
        lm.selectAndDeselectRest();
        const from = lm.point().clone();
        lm.setPoint(from.clone().add({x: dx, y: dy, z: 0}));
        return [[index, from, lm.point().clone()]];
    };

    it('merges the moves of a landmark into one: the first from and the last to', function () {
        const merged = mergeMoves(
            [['a', 1, 2], ['b', 3, 4]], [['b', 4, 5], ['c', 6, 7]]);
        assert.deepEqual(merged, [['a', 1, 2], ['b', 3, 5], ['c', 6, 7]]);
    });

    it('spaces the curve that was dragged, as one undo step with the drag', function () {
        const g = group();
        const moves = drag(g, 1, 0, 3);
        const dragged = xy(g)[1];
        g.tracker.record(g.spaceAfterMove(moves));
        const after = xy(g);
        assert.notDeepEqual(after[1], dragged);   // the point slid along the curve it shaped
        [0, 2, 4].forEach(i => assert.deepEqual(after[i], POINTS[i]));   // the anchors stay
        [5, 6, 7, 8].forEach(i => assert.deepEqual(after[i], POINTS[i])); // the loop was not on it
        g.undo();
        assert.deepEqual(xy(g), POINTS);      // the drag and the spacing, in one step
        g.redo();
        assert.deepEqual(xy(g), after);
    });

    it('moves the same points the button would (the selection is the dragged landmark)', function () {
        const a = group(), b = group();
        const moves = drag(a, 1, 0, 3);
        a.spaceAfterMove(moves);
        drag(b, 1, 0, 3);
        b.resample();
        assert.deepEqual(xy(a), xy(b));
    });
});


describe('LandmarkGroup#closeLoops', function () {
    it('closes the loop into a line and leaves the chain, as one undo step', function () {
        const g = group();
        const moved = g.closeLoops();
        const now = xy(g);
        assert.equal(moved, 2);
        // the loop's ends are the points furthest apart (6 and 8); the other two meet half way
        assert.deepEqual(now[6], POINTS[6]);
        assert.deepEqual(now[8], POINTS[8]);
        assert.deepEqual(now[5], now[7]);
        assert.deepEqual(now[5], [20, 3]);   // half way between 5 and 7
        POINTS.slice(0, 5).forEach((p, i) => assert.deepEqual(now[i], p));  // the chain
        g.undo();
        assert.deepEqual(xy(g), POINTS);
        assert.isFalse(g.tracker.canUndo());
        g.redo();
        assert.deepEqual(xy(g), now);
        // closed already: nothing to do, and nothing to undo
        assert.equal(g.closeLoops(), 0);
    });

    it('closes only the loops with a selected landmark, if there is a selection', function () {
        const g = group();
        g.landmarks[1].selectAndDeselectRest();      // on the chain: no loop is asked for
        assert.equal(g.closeLoops(), 0);
        assert.deepEqual(xy(g), POINTS);
        g.landmarks[7].selectAndDeselectRest();
        assert.equal(g.closeLoops(), 2);
        assert.deepEqual(g.resampleScope(), ['loop']);
    });

    it('leaves a loop with a landmark that is not placed', function () {
        const g = group();
        g.landmarks[7].clear();
        assert.equal(g.closeLoops(), 0);
    });
});

describe('landmarks that a model proposed', function () {
    const data = (extra) => Object.assign({
        landmarks: {points: [[0, 0], [1, 1]], connectivity: []},
        labels: [{label: 'all', mask: [0, 1]}], version: 2
    }, extra);

    it('are known from what the server says of them, saved ones are not', function () {
        assert.equal(predictedBy(data({reviewed: false, source: 'prefit:mediapipe'})), 'mediapipe');
        assert.isNull(predictedBy(data({reviewed: true, source: 'prefit:mediapipe'})));
        assert.isNull(predictedBy(data({reviewed: false})));
        assert.isNull(predictedBy(data({reviewed: false, source: 'something else'})));
        assert.isNull(predictedBy(data()));
        const group = LandmarkGroup.parse(
            data({reviewed: false, source: 'prefit:aam'}), 'a', 'image', null);
        assert.equal(group.predictedBy, 'aam');
        assert.isNull(LandmarkGroup.parse(data(), 'a', 'image', null).predictedBy);
    });

    it('are the annotation once they are saved, as they are or edited', async function () {
        const saved = [];
        const server = {saveLandmarkGroup: (id, type, json) => {
            saved.push(json); return Promise.resolve();
        }};
        const group = LandmarkGroup.parse(
            data({reviewed: false, source: 'prefit:aam'}), 'a', 'image', server);
        await group.save();
        assert.isNull(group.predictedBy);
        assert.equal(saved.length, 1);  // saved with no edit at all
        assert.deepEqual(saved[0].landmarks.points, [[0, 0], [1, 1]]);
        assert.notProperty(saved[0], 'source');
    });
});


describe('occluded landmarks and the frame of an image', function () {
    // an image of 30 rows by 40 columns: x runs to 30 and y to 40
    const framed = (points = POINTS.map(p => p.slice())) => {
        const g = group(points);
        g.setBounds([30, 40]);
        return g;
    };
    const flags = (g) => g.landmarks.map(lm => lm.isOccluded());
    const at = (x, y) => new THREE.Vector3(x, y, 0);

    it('does not mark anything occluded when everything is inside', function () {
        assert.deepEqual(flags(framed()), POINTS.map(() => false));
    });

    it('marks the landmarks of a file that are outside the frame, when the file does not say', function () {
        const points = POINTS.map(p => p.slice());
        points[0] = [-3, 5];   // above the image
        points[4] = [10, 45];  // right of it
        const g = framed(points);
        assert.deepEqual(flags(g).map((o, i) => o ? i : -1).filter(i => i >= 0), [0, 4]);
    });

    it('takes what the file says (metadata.visible) over where the points are', function () {
        const points = POINTS.map(p => p.slice());
        points[0] = [-3, 5];
        const visible = POINTS.map(() => 1);
        visible[2] = 0;   // occluded by hand, inside; and point 0 is outside but said visible
        const g = LandmarkGroup.parse({
            landmarks: {points, connectivity: CONNECTIVITY}, labels: LABELS, version: 2,
            metadata: {visible}
        }, 'face', 'image', null);
        g.setBounds([30, 40]);
        assert.deepEqual(flags(g).map((o, i) => o ? i : -1).filter(i => i >= 0), [2]);
    });

    it('saves which landmarks are occluded, 1 for visible and 0 for occluded, for an image', function () {
        const g = framed();
        g.landmarks[3].setOccluded(true);
        const json = g.toJSON();
        assert.deepEqual(json.metadata.visible, POINTS.map((p, i) => i === 3 ? 0 : 1));
        assert.equal(json.version, 2);
    });

    it('writes no metadata for a mesh with nothing occluded, and reads it back', function () {
        const g = group();
        assert.notProperty(g.toJSON(), 'metadata');
        g.landmarks[1].setOccluded(true);
        const back = LandmarkGroup.parse(g.toJSON(), 'face', 'image', null);
        assert.deepEqual(flags(back), POINTS.map((p, i) => i === 1));
    });

    it('marks a landmark occluded when it goes out of the frame, and visible when it comes back', function () {
        const g = framed();
        const lm = g.landmarks[2];
        lm.setPoint(at(31, 5));
        assert.isTrue(lm.isOccluded());
        lm.setPoint(at(35, 5));
        assert.isTrue(lm.isOccluded());
        lm.setPoint(at(10, 5));
        assert.isFalse(lm.isOccluded());
    });

    it('keeps a landmark that was marked occluded by hand, inside, when it moves inside', function () {
        const g = framed();
        const lm = g.landmarks[2];
        lm.setOccluded(true);
        lm.setPoint(at(12, 7));
        assert.isTrue(lm.isOccluded());
    });

    it('marks a landmark that is placed outside the frame', function () {
        const g = framed();
        g.deleteSelected();   // nothing selected: no-op
        g.landmarks[6].clear();
        g.landmarks[6].set({point: at(-2, 3)});
        assert.isTrue(g.landmarks[6].isOccluded());
        g.landmarks[6].clear();
        assert.isFalse(g.landmarks[6].isOccluded());
    });

    it('does not know a frame without a size (a mesh)', function () {
        const g = group();
        g.landmarks[0].setPoint(at(-100, 500));
        assert.isFalse(g.landmarks[0].isOccluded());
    });

    it('toggles the selected landmarks as one undoable step', function () {
        const g = framed();
        g.landmarks[1].select();
        g.landmarks[2].select();
        assert.equal(g.toggleOccluded(), 2);
        assert.deepEqual(flags(g).slice(0, 4), [false, true, true, false]);
        // all occluded: toggles them back
        assert.equal(g.toggleOccluded(), 2);
        assert.deepEqual(flags(g).slice(0, 4), [false, false, false, false]);
        g.undo();
        assert.deepEqual(flags(g).slice(0, 4), [false, true, true, false]);
        g.undo();
        assert.deepEqual(flags(g).slice(0, 4), [false, false, false, false]);
        g.redo();
        assert.deepEqual(flags(g).slice(0, 4), [false, true, true, false]);
        assert.deepEqual(xy(g), POINTS);  // the points did not move
    });

    it('toggles nothing without a selection, and mixes into occluded', function () {
        const g = framed();
        assert.equal(g.toggleOccluded(), 0);
        g.landmarks[0].setOccluded(true);
        g.landmarks[0].select();
        g.landmarks[1].select();
        assert.equal(g.toggleOccluded(), 1);   // not all were occluded: the others become so
        assert.deepEqual(flags(g).slice(0, 2), [true, true]);
    });

    it('undoes and redoes a move out of the frame with its flag', function () {
        const g = framed();
        const lm = g.landmarks[2];
        const from = lm.point().clone();
        lm.setPoint(at(33, 3));
        g.tracker.record([[2, from, lm.point().clone()]]);
        assert.isTrue(lm.isOccluded());
        g.undo();
        assert.isFalse(lm.isOccluded());
        g.redo();
        assert.isTrue(lm.isOccluded());
    });
});

describe('restoring landmarks (a fit) into an image', function () {
    it('marks the landmarks that the fit put outside the frame, which it does not say', function () {
        const g = group();
        g.setBounds([30, 40]);
        const json = {
            landmarks: {points: POINTS.map(p => p.slice()), connectivity: CONNECTIVITY},
            labels: LABELS, version: 2
        };
        json.landmarks.points[2] = [-5, 3];
        g.restore(json);
        assert.deepEqual(g.landmarks.map(lm => lm.isOccluded()).map((o, i) => o ? i : -1).filter(i => i >= 0), [2]);
    });
});
