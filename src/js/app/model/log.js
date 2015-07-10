"use strict";

var _ = require('underscore');
var Backbone = require('backbone');

function FixedStack (size) {
    this.size = size;
    this._stack = [];
};

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

// --------------------------------------------------------------------------

function Log (maxOps=50, maxCheckpoints=10) {
    this._operations = new FixedStack(maxOps);
    this._checkpoints = new FixedStack(maxCheckpoints);
    this._undone = [];
    this.started = Date.now();
    _.extend(this, Backbone.Events);
};

Log.prototype.push = function (data) {
    this._operations.push({rev: Date.now(), data});
    this._undone = [];
    this.trigger("change");
};

Log.prototype.save = function (data) {
    const last = this._operations.peek();
    if (last) {
        this._checkpoints.push({rev: last.rev, data});
    } else {
        this._checkpoints.push({rev: Date.now(), data});
    }
    this.trigger("change");
};

Log.prototype.isCurrent = function () {
    const chck = this._checkpoints.peek(),
          op = this._operations.peek(),
          und = this._undone[this._undone.length -1];

    if (!chck) { return false; }
    if (!op) {
        if (!und) {
            return true;
        }
    } else {
        if (op.rev === chck.rev) {
            return true;
        }
    }
    return false;
};

Log.prototype.latest = function () {
    return this._checkpoints.peek().data;
};

Log.prototype.operations = function () {
    return this._operations._stack.map(i => i.data);
};

Log.prototype.undo = function (func) {
    const op = this._operations.pop();
    if (op) {
        console.log('Log:Undoing', op);
        this._undone.push(op);
        this.trigger("change");
        func(op.data);
    }
};

Log.prototype.redo = function (func) {
    const op = this._undone.pop();
    if (op) {
        console.log('Log:Redoing', op);
        this._operations.push(op);
        this.trigger("change");
        func(op.data);
    }
};

Log.prototype.reset = function (data) {
    this._operations = new FixedStack(this._operations.size);
    this._undone = [];
    if (data) {
        this.save(data);
    }
    this.trigger("change");
};

Log.prototype.hasUndone = function () {
    return this._undone.length > 0;
};

Log.prototype.hasOperations = function () {
    return this._operations.length() > 0;
};

// --------------------------------------------------------------------------

module.exports = Log;
