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
        return this.get('apiURL') + this.apiHeader + url;
    }

});
