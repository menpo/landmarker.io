"use strict";

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

function Log (maxOps=20, maxCheckpoints=5) {
    this._operations = new FixedStack(maxOps);
    this._checkpoints = new FixedStack(maxCheckpoints);
    this._undone = [];
    this.started = Date.now();
};

Log.prototype.push = function (data) {
    this._operations.push({rev: Date.now(), data});
    this._undone = [];
};

Log.prototype.save = function (data) {
    this._checkpoints.push({rev: Date.now(), data});
};

Log.prototype.isCurrent = function () {
    if (this._operations.length() === 0) { return false; }
    if (this._checkpoints.length() === 0) { return false; }
    return this._operations.peek().rev <= this._checkpoints.peek().rev;
};

Log.prototype.latest = function () {
    return this._checkpoints.peek().data;
};

Log.prototype.operations = function () {
    return this._operations._stack.map(i => i.data);
};

Log.prototype.undo = function (func) {
    const op = this._operations.pop();
    this._undone.push(op);
    func.call(op.data);
};

Log.prototype.redo = function (func) {
    const op = this._undone.pop();
    if (op) {
        this._operations.push(op);
        func.call(op.data);
    }
};

Log.prototype.reset = function (data) {
    this._operations = new FixedStack(this._operations.size);
    if (data) {
        this.save(data);
    }
};

Log.prototype.hasUndone = function () {
    return this._undone.length > 0;
};

// --------------------------------------------------------------------------

module.exports = Log;
