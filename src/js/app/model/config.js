/**
 * Persistable config object with get and set logic
 * Requires localstorage to work properly (throws Error otherwise),
 * serialisation is simple JSON
 */
"use strict";

var Backbone = require('backbone'),
    _ = require('underscore');

var LOCALSTORAGE_EXISTS = (function () {
    try {
        localStorage.setItem('TEST_LS', 'TEST_LS');
        localStorage.removeItem('TEST_LS');
        return true;
    } catch (e) {
        console.log("Couldn't find localStorage");
        return false;
    }
})();

var LOCALSTORAGE_KEY = 'LMIO#CONFIG';

function Config ()  {
    this._data = {};
    this.load();
};

Config.prototype.get = function (key) {
    if (!key) {
        return _.clone(this._data);
    } else {
        return this._data[key];
    }
};

Config.prototype.has = function (key) {
    return this._data.hasOwnProperty(key);
}

Config.prototype.delete = function (key, save)  {
    delete this._data[key];
    if (save) this.save();
};

Config.prototype.set = function (arg1, arg2, arg3) {

    let save;

    if (typeof arg1 === 'string') { // Submitted a key/value pair
        this._data[arg1] = arg2;
        save = !!arg3;
    } else if (typeof arg1 === 'object') { // Submitted a set of pairs
        Object.keys(arg1).forEach((k) => {
            this._data[k] = arg1[k];
        });
        save = !!arg2;
    }

    if (save) this.save();
};

Config.prototype.save = function () {
    if (!LOCALSTORAGE_EXISTS) throw new Error('Missing localStorage');
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(this._data));
};

Config.prototype.load = function () {
    if (!LOCALSTORAGE_EXISTS) throw new Error('Missing localStorage');
    var data = localStorage.getItem(LOCALSTORAGE_KEY);
    if (data) {
        this._data = JSON.parse(data);
    } else {
        this._data = {};
    }
};

Config.prototype.clear = function () {
    if (!LOCALSTORAGE_EXISTS) throw new Error('Missing localStorage');
    localStorage.removeItem(LOCALSTORAGE_KEY);
    this._data = {};
};

var _configInstance;

module.exports = function () {
    if (!_configInstance) {
        _configInstance = new Config();
    }
    return _configInstance;
}
