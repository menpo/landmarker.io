var Backbone = require('../lib/backbonej');

var Server = function (url) {
    this.url = url;
    this.version = 2;
    this.demoMode = false;
    // make sure we configure backbone correctly
    this.configureBackboneSecurity();
};

Server.prototype.apiHeader = function () {
    return '/api/v' + this.version + '/';
};

Server.prototype.configureBackboneSecurity = function () {
    if(this.url.indexOf('https://') == 0) {
        console.log('connecting to https:// API - request credentials');
        Backbone.enableSecureSync();
    } else {
        console.log('connecting to http:// API - disabling request credentials');
        Backbone.enableUnsecureSync();
    }
};

Server.prototype.map = function (url) {
    var mapping;
    if (this.demoMode) {
        // demoMode so we ignore the server url
        mapping = (window.location.pathname.slice(0, -1) +
                   this.apiHeader() + url);
        // this just means we map everything to .json..except images
        // which have to be jpeg and mesh data (.raw)
        if ((new RegExp('textures/')).test(url)) {
            return mapping + '.jpg';
        } else if ((new RegExp('thumbnails/')).test(url)) {
            return mapping + '.jpg';
        } else if ((new RegExp('meshes/')).test(url)) {
            return mapping + '.raw';
        } else {
            return mapping + '.json';
        }
    } else {
        return this.url + this.apiHeader() + url;
    }
};

// Directly export the server
module.exports = Server;
