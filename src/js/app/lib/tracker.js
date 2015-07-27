'use strict';

import _ from 'underscore';
import Backbone from 'backbone';

export function FixedStack (size) {
    this.size = size;
    this._stack = [];
}

FixedStack.prototype.push = function (item) {
    this._stack.push(item);
    if (this._stack.length >= this.size) {
        this._stack = this._stack.slice(1);
    }
};

FixedStack.prototype.peek = function () {
    return this._stack[this._stack.length - 1];
};

FixedStack.prototype.pop = function () {
    return this._stack.pop();
};

FixedStack.prototype.length = function () {
    return this._stack.length;
};

const _rev = Date.now;

export function Tracker (maxOps=100, maxCheckpoints=25) {
    this._operations = new FixedStack(maxOps);
    this._states = new FixedStack(maxCheckpoints);
    this._futureOperations = [];
    this._futureStates = [];
    this._lastSavedState = undefined;

    _.extend(this, Backbone.Events);
}

export default Tracker;

Tracker.prototype.record = function (data) {
    const rev = _rev();
    this._operations.push({rev, data});
    this._futureOperations = [];
    this._futureStates = [];
    this.trigger('change');
};

Tracker.prototype.recordState = function (data, saved=false) {
    const last = this._states.peek();
    const op = this._operations.peek();
    let rev;

    if (!op && last && _.isEqual(data, last.data)) {
        rev = last.rev;
    } else {
        rev = op ? op.rev : _rev();
        this._states.push({rev, data});
    }

    if (saved) {
        this._lastSavedState = rev;
    }

    this.trigger('change');
};

Tracker.prototype.isUpToDate = function () {
    const state = this._states.peek(),
          op = this._operations.peek();

    if (!state) { // No state stored, cannot be up to date
        return false;
    }

    const stateOk = this._lastSavedState === state.rev;

    if (op) { // Last operation must correspond to checkpoint
        return stateOk && op.rev === state.rev;
    } else { // We may be in a restoring process (not at the last checkpoint)
        return stateOk;
    }

    return false;
};

Tracker.prototype.undo = function (process, restore) {
    const op = this._operations.pop();
    let state;

    if (op) {
        this._futureOperations.push(op);

        state = this._states.peek();
        if (state.rev === op.rev) {
            this._futureStates.push(this._states.pop());
        }

        process(op.data, op.rev);
        this.trigger('change');
    } else if (this._states.length() > 1) {
        this._futureStates.push(this._states.pop());
        state = this._states.peek();

        restore(state.data, state.rev);
        this.trigger('change');
    }
};

Tracker.prototype.redo = function (process, restore) {
    const op = this._futureOperations.pop();
    const state = this._futureStates[this._futureStates.length - 1];
    let CASE = 0;

    if (op) {
        if (state && state.rev < op.rev) {
            this._states.push(this._futureStates.pop());
            CASE = 2;
        } else if (state && state.rev === op.rev) {
            this._operations.push(op);
            this._states.push(this._futureStates.pop());
            CASE = 1;
        } else {
            CASE = 1;
            this._operations.push(op);
        }
    } else if (state) {
        this._states.push(this._futureStates.pop());
        restore(state.data, state.rev);

    }

    if (CASE === 1) {
        process(op.data, op.rev);
    } else if (CASE === 2) {
        restore(state.data, state.rev);
    } else {
        return;
    }

    this.trigger('change');
};

Tracker.prototype.canRedo = function () {
    return this._futureOperations.length + this._futureStates.length > 0;
};

Tracker.prototype.canUndo = function () {
    return this._operations.length() > 0 || this._states.length() > 1;
};
