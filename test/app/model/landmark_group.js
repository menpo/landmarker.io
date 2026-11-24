// @vitest-environment jsdom
import { assert } from 'chai';
import { describe, it } from 'vitest';

import LandmarkGroup, { mergeMoves } from '../../../src/js/app/model/landmark_group';
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
        // the loop's ends are the points furthest apart (6 and 8); the other two meet on the line
        assert.deepEqual(now[6], POINTS[6]);
        assert.deepEqual(now[8], POINTS[8]);
        assert.deepEqual(now[5], now[7]);
        assert.closeTo((now[8][0] - now[6][0]) * (now[5][1] - now[6][1]) -
                       (now[8][1] - now[6][1]) * (now[5][0] - now[6][0]), 0, 1e-9);
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
