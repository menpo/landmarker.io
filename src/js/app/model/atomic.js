var Backbone = require('../lib/backbonej');

"use strict";

var AtomicOperationTracker = Backbone.Model.extend({

    defaults: function () {
        return {
            ATOMIC_OPERATION: false
        }
    },

    startAtomicOperation: function () {
        this.set('ATOMIC_OPERATION', true);
    },

    endAtomicOperation: function () {
        this.set('ATOMIC_OPERATION', false);
    },

    atomicOperationUnderway: function () {
        return this.get('ATOMIC_OPERATION');
    },

    atomicOperationFinished: function () {
        return !this.get('ATOMIC_OPERATION');
    }

});


module.exports = new AtomicOperationTracker;
