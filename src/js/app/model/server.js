var Backbone = require('../lib/backbonej');

exports.Server = Backbone.Model.extend({

    apiHeader: '/api/v2/',

    defaults: function () {
        return {
            apiURL: ''
        }
    },

    apiURL: function () {
        return this.get('apiURL');
    },

    configureBackboneSecurity: function () {
        if(this.apiURL().indexOf('https://') == 0) {
            console.log('connecting to https:// API - request credentials');
            Backbone.enableSecureSync();
        } else {
            console.log('connecting to http:// API - disabling request credentials');
            Backbone.enableUnsecureSync();
        }
    },

    map: function (url) {
        var mapping;
        if (this.get('DEMO_MODE')) {
            mapping = this.apiHeader + url;
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
            return this.get('apiURL') + this.apiHeader + url;

        }
    }

});
