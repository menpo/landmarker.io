var Backbone = require('backbone');
Backbone.$ = require('jquery');
var Promise = require('promise-polyfill');


Backbone.unsecureSync = Backbone.sync;

Backbone.secureSync = function( method, model, options ) {
    options.xhrFields = {
        withCredentials: true
    };
    return Backbone.unsecureSync.apply(this, [method, model, options]);
};

Backbone.enableSecureSync = function () {
    Backbone.sync = Backbone.secureSync;
};

Backbone.enableUnsecureSync = function () {
    Backbone.sync = Backbone.unsecureSync;
};

// default to the unsecure case.
Backbone.enableUnsecureSync();

Backbone.promiseFetch = function (model) {
    return new Promise(function(resolve, reject) {
        model.fetch({
            success: resolve,
            error: reject
        });
    });
};

module.exports = Backbone;
