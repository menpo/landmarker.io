'use strict';

// Not much unit testing here as the exposed interface is pretty much made
// to not let you see what's happenning behind the seen
//
// We run a bunch of scenarios during we check the exposed state as
// a user would
//
// The run scenario method is a bit convoluted as we need to process the
// assertion only after the tracker and the mock have done all their
// operation, as well as go to the next step only after the assertions have
// been processed
//

var assert = require('chai').assert;

var _ = require('underscore');
var cwd = process.cwd();

var Tracker = require(cwd + '/src/js/app/lib/tracker').default;

var trackers = {}, mocks = {};

function MockObject () {
    this.data = [0, 0, 0];
    this.copy = () => _.clone(this.data);
    this.processUndo = ([i, v]) => this.data[i] -= v;
    this.processRedo = ([i, v]) => this.data[i] += v;
    this.restore = (data) => this.data = _.clone(data);
}

function trackingAssert (step, [utd, cu, cr, data], [tUtd, tCu, tCr, tData]) {
    assert.deepEqual([step, tUtd, tCu, tCr, tData],
                     [step, utd, cu, cr, data]);
}

function runScenario (j, steps, mock, tracker, done) {

    let i = -1;
    const len = steps.length;
    const next = function () {

        if (i >= 0) {
            const [ , , , utd, cu, cr, data] = steps[i];

            trackingAssert(i, [utd, cu, cr, data], [
                tracker.isUpToDate(),
                tracker.canUndo(),
                tracker.canRedo(),
                mock.copy()
            ]);
        }

        i++;

        if (i === len) {
            done();
        } else {
            runStep(i, steps[i], mock, tracker, next);
        }
    }

    tracker.on('change', next);
    tracker.on('noop', next);
    next();
}

function runStep (i, step, mock, tracker, next) {

    const [type, a1, a2, utd, cu, cr, data] = step;
    let newData, override;

    if (type === 'ACTN') { // Do
        mock.data[a1] += a2;
        tracker.record([a1, a2]);
    } else if (type === 'SAVE' || type === 'RCRD') {
        newData = a1 ? [a1, a2 || 0, 0] : mock.copy();
        override = !_.isEqual(newData, mock.copy());
        mock.restore(newData);
        tracker.recordState(newData, type === 'SAVE', override);
    } else if (type === 'UNDO') {
        tracker.undo(mock.processUndo, mock.restore);
    } else if (type === 'REDO') {
        tracker.redo(mock.processRedo, mock.restore);
    } else {
        next();
    }
}

var scenarios = [];

scenarios.push(['Record', [
    [null,   null, null, false, false, false, [ 0,  0,  0 ]],
    ['RCRD', null, null, false, false, false, [ 0,  0,  0 ]],
]]);

scenarios.push(['Save', [
    [null,   null, null, false, false, false, [ 0,  0,  0 ]],
    ['SAVE', null, null, true,  false, false, [ 0,  0,  0 ]],
]]);

scenarios.push(['Single operations', [
    [null,   null, null, false, false, false, [ 0,  0,  0 ]],
    ['ACTN', 1,     2,   false, true,  false, [ 0,  2,  0 ]],
    ['UNDO', null, null, false, false, true,  [ 0,  0,  0 ]],
    ['REDO', null, null, false, true,  false, [ 0,  2,  0 ]],
]]);

scenarios.push(['Empty operations', [
    [null,   null, null, false, false, false,  [ 0,  0,  0 ]],
    ['UNDO', null, null, false, false, false,  [ 0,  0,  0 ]],
    ['REDO', null, null, false, false, false,  [ 0,  0,  0 ]],
]]);

scenarios.push(['Record same state', [
    [null,   null, null, false, false, false, [ 0,  0,  0 ]],
    ['SAVE', 1,     3,   true,  false, false, [ 1,  3,  0 ]],
    ['RCRD', 1,     3,   true,  false, false, [ 1,  3,  0 ]],
]]);

scenarios.push(['Undo / Redo state only', [
    [null,   null, null, false, false, false, [ 0,  0,  0 ]],
    ['SAVE', 1,     3,   true,  false, false, [ 1,  3,  0 ]],
    ['RCRD', 2,     8,   false, true,  false, [ 2,  8,  0 ]],
    ['RCRD', 4,     9,   false, true,  false, [ 4,  9,  0 ]],
    ['UNDO', null, null, false, true,  true,  [ 2,  8,  0 ]],
    ['UNDO', null, null, true,  false, true,  [ 1,  3,  0 ]],
    ['REDO', null, null, false, true,  true,  [ 2,  8,  0 ]],
]]);

scenarios.push(['Operation with undone operations', [
    [null,   null, null, false, false, false, [ 0,  0,  0 ]],
    ['ACTN', 1,     2,   false, true,  false, [ 0,  2,  0 ]],
    ['ACTN', 2,     3,   false, true,  false, [ 0,  2,  3 ]],
    ['UNDO', null, null, false, true,  true,  [ 0,  2,  0 ]],
    ['ACTN', 0,     4,   false, true,  false, [ 4,  2,  0 ]],
]]);

scenarios.push(['Operation with undone states', [
    [null,   null, null, false, false, false, [ 0,  0,  0 ]],
    ['RCRD', 2,     8,   false, false, false, [ 2,  8,  0 ]],
    ['RCRD', 3,     7,   false, true,  false, [ 3,  7,  0 ]],
    ['UNDO', null, null, false, false, true,  [ 2,  8,  0 ]],
    ['ACTN', 1,     2,   false, true,  false, [ 2,  10,  0 ]],
]]);


scenarios.push(['Full Scenario 1', [
    [null,   null, null, false, false, false, [ 0,  0,  0 ]],
    ['SAVE', null, null, true,  false, false, [ 0,  0,  0 ]],
    ['ACTN', 1,     2,   false, true,  false, [ 0,  2,  0 ]],
    ['ACTN', 1,    -5,   false, true,  false, [ 0, -3,  0 ]],
    ['ACTN', 2,     1,   false, true,  false, [ 0, -3,  1 ]],
    ['ACTN', 0,    -7,   false, true,  false, [-7, -3,  1 ]],
    ['SAVE', null, null, true,  true,  false, [-7, -3,  1 ]],
    ['UNDO', null, null, false, true,  true,  [ 0, -3,  1 ]],
    ['UNDO', null, null, false, true,  true,  [ 0, -3,  0 ]],
    ['UNDO', null, null, false, true,  true,  [ 0,  2,  0 ]],
    ['UNDO', null, null, false, false, true,  [ 0,  0,  0 ]],
    ['ACTN', 1,    -9,   false, true,  false, [ 0, -9,  0 ]],
]]);

scenarios.push(['Full Scenario 2', [
    [null,   null, null, false, false, false, [ 0,  0,  0 ]],
    ['SAVE', null, null, true,  false, false, [ 0,  0,  0 ]],
    ['ACTN', 1,     2,   false, true,  false, [ 0,  2,  0 ]],
    ['ACTN', 1,    -5,   false, true,  false, [ 0, -3,  0 ]],
    ['ACTN', 2,     1,   false, true,  false, [ 0, -3,  1 ]],
    ['SAVE', 1,     9,   true,  true,  false, [ 1,  9,  0 ]],
]]);

scenarios.push(['Full Scenario 3', [
    [null,   null, null, false, false, false, [ 0,  0,  0 ]],
    ['SAVE', 1,     2,   true,  false, false, [ 1,  2,  0 ]],
    ['ACTN', 1,     2,   false, true,  false, [ 1,  4,  0 ]],
    ['RCRD', 1,     4,   false, true,  false, [ 1,  4,  0 ]],
    ['ACTN', 1,     3,   false, true,  false, [ 1,  7,  0 ]],
    ['UNDO', null, null, false, true,  true,  [ 1,  4,  0 ]],
    ['UNDO', null, null, true,  false, true,  [ 1,  2,  0 ]],
    ['REDO', null, null, false, true,  true,  [ 1,  4,  0 ]],
]]);

scenarios.push(['Full Scenario 4', [
    [null,   null, null, false, false, false, [ 0,  0,  0 ]],
    ['SAVE', 1,     2,   true,  false, false, [ 1,  2,  0 ]],
    ['ACTN', 1,     2,   false, true,  false, [ 1,  4,  0 ]],
    ['RCRD', 1,     7,   false, true,  false, [ 1,  7,  0 ]],
    ['ACTN', 1,     3,   false, true,  false, [ 1,  10, 0 ]],
    ['UNDO', null, null, false, true,  true,  [ 1,  7,  0 ]],
    ['UNDO', null, null, true,  false, true,  [ 1,  2,  0 ]],
    ['REDO', null, null, false, true,  true,  [ 1,  7,  0 ]],
]]);

scenarios.push(['Full Scenario 5', [
    [null,   null, null, false, false, false, [ 0,  0,  0 ]],
    ['SAVE', 1,     2,   true,  false, false, [ 1,  2,  0 ]],
    ['ACTN', 1,     2,   false, true,  false, [ 1,  4,  0 ]],
    ['RCRD', 1,     4,   false, true,  false, [ 1,  4,  0 ]],
    ['RCRD', 1,     8,   false, true,  false, [ 1,  8,  0 ]],
    ['UNDO', null, null, false, true,  true,  [ 1,  4,  0 ]],
    ['UNDO', null, null, true,  false,  true, [ 1,  2,  0 ]],
]]);

scenarios.push(['Override recordState', [
    [null,   null, null, false, false, false, [ 0,  0,  0 ]],
    ['SAVE', 1,     2,   true,  false, false, [ 1,  2,  0 ]],
    ['ACTN', 1,     2,   false, true,  false, [ 1,  4,  0 ]],
    ['ACTN', 2,     1,   false, true,  false, [ 1,  4,  1 ]],
    ['RCRD', 1,     8,   false, true,  false, [ 1,  8,  0 ]],
    ['ACTN', 1,     3,   false, true,  false, [ 1,  11, 0 ]],
    ['UNDO', null, null, false, true,  true,  [ 1,  8,  0 ]],
    ['UNDO', null, null, true,  false, true,  [ 1,  2,  0 ]],
]]);

describe('Tracker:Scenarios', function () {
    scenarios.forEach(function ([n, sc, limit], i) {

        trackers[i] = new Tracker(limit, limit);
        mocks[i] = new MockObject();

        it(`should pass scenario "${n}" (${sc.length})`, function (done) {
            runScenario(i, sc, mocks[i], trackers[i], done);
        });
    });
});
