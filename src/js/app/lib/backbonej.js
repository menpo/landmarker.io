var Backbone = require('backbone');
Backbone.$ = require('jquery');
var Promise = require('promise-polyfill');


window.Backbone = Backbone;

var credentials =  {
    withCredentials: true
};

var oldBackboneSync = Backbone.sync;
Backbone.sync = function( method, model, options ) {
    options.xhrFields = credentials;
    return oldBackboneSync.apply(this, [method, model, options]);
};


Backbone.promiseFetch = function (model) {
    return new Promise(function(resolve, reject) {
        model.fetch({
            success: resolve,
            error: reject
        });
    });
};


module.exports = Backbone;
