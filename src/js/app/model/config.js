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

var LOCALSTORAGE_KEY = 'lmio#Config';

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

Config.prototype.set = function (key, value) {
    this._data[key] = value;
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

var _config;

module.exports = function () {
    if (!_config) {
        _config = new Config();
    }
    return _config;
}
