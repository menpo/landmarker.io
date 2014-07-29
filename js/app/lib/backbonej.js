var Backbone = require('backbone');
Backbone.$ = require('jquery');

var credentials =  {
    withCredentials: true
};

var oldBackboneSync = Backbone.sync;
Backbone.sync = function( method, model, options ) {
    options.xhrFields = credentials;
    return oldBackboneSync.apply(this, [method, model, options]);
};

module.exports = Backbone;
