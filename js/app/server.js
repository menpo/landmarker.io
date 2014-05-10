var Backbone = require('backbone');

exports.Server = Backbone.Model.extend({

    apiHeader: '/api/v1/',

    defaults: function () {
        return {
            apiURL: ''
        }
    },

    apiURL: function () {
        return this.get('apiURL');
    },

    map: function (url) {
        console.log('dynamically remapping');
        var mapping;
        if (this.get('DEMO_MODE')) {
            console.log('in demo mode');
            mapping = this.apiHeader + url;
            // this just means we map everything to .json..except images
            // which have to be jpeg.
            // TODO add image remapping here
            if ((new RegExp('textures/')).test(url)) {
                console.log('mapping a texture image');
                return mapping + '.jpg'
            } else {
                return mapping + '.json';
            }
        } else {
            return this.get('apiURL') + this.apiHeader + url;

        }
    }

});
