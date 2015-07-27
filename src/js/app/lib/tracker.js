'use strict';

import _ from 'underscore';
import Backbone from 'backbone';

/**
 * @class Tracker
 *
 * General purpose undo/redo data structure.
 * Uncorelated to the target data, provides 2 levels of granularity:
 *
 * - operation : small updates in between saved states
 * - state :     checkpoint in the data, should contain the all the tracked data
 *
 * There're no constraint on how you structure the operations / states as they
 * will be passed back to you as is. Making sure the data is updated
 * consistently is up to the caller.
 *
 * When recording a state, it can be marked as 'saved' which is taken as a
 * marker that the data is up to date with your source of truth (usually the
 * the remote location).
 *
 * Any call which changes the data structure will trigger a 'change' event on
 * the instance. For undo and redo operations which have no effect, a 'noop'
 * event will be triggered. Extends Backbone.Events for event firing and
 * listening.
 *
 */
export function Tracker () {
    this._operations = [];
    this._states = [];
    this._futureOperations = [];
    this._futureStates = [];
    this._lastSavedState = undefined;

    this._lastRev = 0;

    _.extend(this, Backbone.Events);
}

/**
 * Generate the incremental revision number used to order states and operations
 * @returns {integer}
 */
Tracker.prototype.rev = function () {
    return ++this._lastRev;
};

/**
 * Record an single operation,
 * Will lose any operations or state which were undone before
 * @param {object} data - Any kind of data
 * @fires Tracker#change
 */
Tracker.prototype.record = function (data) {
    const rev = this.rev();

    this._operations.push({rev, data});
    this._futureOperations = [];
    this._futureStates = [];

    this.trigger('change');
};

/**
 * Record a state
 *
 * 'saved' means it is currently in sync with your source of truth.
 *
 * In practice a recorded state should not deviate from current operations, that
 *  is to maintain consistency across undo/redo. To visualise, take this situation:
 *
 * >> record state 3    (state is known to be 3)
 * >> record +1         (state is assumed to be 4)
 * >> record +2         (state is assumed to be 6)
 * >> record state 12   (state is known to be 12)
 *
 * now to undo from 12, we have no data as reference. We could go back to 3 and
 * perform all subsequent operations, but that would require assumption on the
 * callbacks and their side-effects. To allow safe override of data, use
 * 'override' to erase all operations between this new state and the last known
 * state. Not setting it correctly will likely end up in broken data
 *
 * @param  {object} data
 * @param  {Boolean} [saved=false]
 * @param  {Boolean} [override=false]
 */
Tracker.prototype.recordState = function (data, saved=false, override=false) {
    const state = _.last(this._states),
        op = _.last(this._operations);
    let rev;

    if (!op && state && _.isEqual(data, state.data)) {
        // No op and we have the same data than before, don't fill twice
        rev = state.rev;
    } else { // There are changes, store the state
        if (op && !override && (!state || state.rev !== op.rev)) {
            rev = op.rev; // Track the lastest operation
        } else {
            rev = this.rev();
        }
        this._states.push({rev, data});
    }

    if (override) {
        // Remove all operations between the new state and the last
        let prev = _.last(this._operations);
        while (prev && prev.rev > state.rev) {
            this._operations.pop();
            prev = _.last(this._operations);
        }
    }

    // Mark as saved, only one saved value at any point in time
    if (saved) {
        this._lastSavedState = rev;
    }

    this.trigger('change');
};

/**
 * Does the current (state, operation) combo correspond to the last saved state
 * @return {Boolean}
 */
Tracker.prototype.isUpToDate = function () {
    const state = _.last(this._states),
         op = _.last(this._operations);

    if (!state) { // No state stored, cannot be up to date
        return false;
    }

    const stateOk = this._lastSavedState === state.rev;

    if (op) { // Last operation must correspond to checkpoint
        return stateOk && op.rev === state.rev;
    } else { // We may be in a restoring process (not at the last checkpoint)
        return stateOk;
    }
};

/**
 * Perform undo
 *
 * 'process' and 'restore' are called depending on which type of data is to be
 * undone
 *
 * @param  {Function} process - callback receiving an operation
 * @param  {Function} restore - callback receiving a state
 * @fires Tracker#change
 * @fires Tracker#noop
 * @return {Boolean} - If there was any change in the data structure
 */
Tracker.prototype.undo = function (process, restore) {
    const state = _.last(this._states),
         op = _.last(this._operations);

    let CASE = 0;

    if (op) {
        if (!state) {
            CASE = 1;
        } else {
            if (state.rev === op.rev) {
                CASE = 3;
            } else if (state.rev > op.rev) {
                CASE = 2;
            } else {
                CASE = 1;
            }
        }
    } else {
        CASE = !!state && this._states.length > 1 ? 2 : 0;
    }

    if (CASE === 1) {
        this._futureOperations.push(this._operations.pop());
        process(op.data, op.rev);
    } else if (CASE === 2) {
        this._futureStates.push(this._states.pop());
        const {rev, data} = _.last(this._states);
        restore(data, rev);
    } else if (CASE === 3) {
        this._futureStates.push(this._states.pop());
        this._futureOperations.push(this._operations.pop());
        process(op.data, op.rev);
    } else {
        this.trigger('noop');
        return false;
    }

    this.trigger('change');
    return true;
};

/**
 * Perform redo
 *
 * 'process' and 'restore' are called depending on which type of data is to be
 * undone
 *
 * @param  {Function} process - callback receiving an operation
 * @param  {Function} restore - callback receiving a state
 * @fires Tracker#change
 * @fires Tracker#noop
 * @return {Boolean} - If there was any change in the data structure
 */
Tracker.prototype.redo = function (process, restore) {
    const state = _.last(this._futureStates),
         op = _.last(this._futureOperations);

    let CASE = 0;

    if (op) {
        if (!state) {
            CASE = 1;
        } else {
            // Case in for security reason but shouldn't happen
            // as state untracked by an operation (see recordState doc)
            // This ensure the structure doesn't get stuck,
            // but does not guarantee consistency
            if (state.rev > op.rev) {
                CASE = 1;
            } else if (state.rev === op.rev) {
                CASE = 3;
            } else {
                CASE = 2;
            }
        }
    } else {
        CASE = state ? 2 : 0;
    }

    if (CASE === 1) {
        this._operations.push(this._futureOperations.pop());
        process(op.data, op.rev);
    } else if (CASE === 2) {
        this._states.push(this._futureStates.pop());
        restore(state.data, state.rev);
    } else if (CASE === 3) {
        this._states.push(this._futureStates.pop());
        this._operations.push(this._futureOperations.pop());
        process(op.data, op.rev);
    } else {
        this.trigger('noop');
        return false;
    }

    this.trigger('change');
    return true;
};

/**
 * Is in a state when redo is available
 * @return {Boolean}
 */
Tracker.prototype.canRedo = function () {
    return this._futureOperations.length + this._futureStates.length > 0;
};

/**
 * Is in a state when undo is available
 * We do not undo with only one state, as we would have no point of reference
 * after this point.
 * @return {Boolean}
 */
Tracker.prototype.canUndo = function () {
    return this._operations.length > 0 || this._states.length > 1;
};

export default Tracker;
