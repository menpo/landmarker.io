'use strict';

import _ from 'underscore';
import Backbone from 'backbone';

function FixedStack (size) {
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

export default function Tracker (maxOps=100, maxCheckpoints=25) {
    this._operations = new FixedStack(maxOps);
    this._states = new FixedStack(maxCheckpoints);
    this._futureOperations = [];
    this._futureStates = [];

    this._saved = undefined;
    this.startedAt = new Date();

    _.extend(this, Backbone.Events);
}

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
        this._saved = rev;
    }

    this.trigger('change');
};

Tracker.prototype.isUpToDate = function () {
    const state = this._states.peek(),
          op = this._operations.peek();

    if (!state) { // No state stored, cannot be up to date
        return false;
    }

    if (op) { // Last operation must correspond to checkpoint
        return op.rev === state.rev && state.rev === this._saved;
    } else { // We may be in a restoring process (not at the last checkpoint)
        return state.rev === this._saved;
    }

    return false;
};

Tracker.prototype.undo = function (process, restore) {
    const op = this._operations.pop();
    if (op) {
        console.log('Tracker:Undoing', op);
        this._futureOperations.push(op);
        process(op.data, op.rev);
        this.trigger('change');
    } else if (this._states.length() > 1) {
        this._futureStates.push(this._states.pop());
        const state = this._states.peek();
        restore(state.data, state.rev);
        this.trigger('change');
    }
};

Tracker.prototype.redo = function (process, restore) {
    if (this._futureStates.length > 0) {
        const state = this._futureStates.pop();
        this._states.push(state);
        restore(state.data, state.rev);
        this.trigger('change');
    } else {
        const op = this._futureOperations.pop();
        if (op) {
            console.log('Tracker:Redoing', op);
            this._operations.push(op);
            process(op.data, op.rev);
            this.trigger('change');
        }
    }
};

Tracker.prototype.canRedo = function () {
    return this._futureOperations.length > 0 || this._futureStates.length > 0;
};

Tracker.prototype.canUndo = function () {
    return this._operations.length() > 0 || this._states.length() > 1;
};
