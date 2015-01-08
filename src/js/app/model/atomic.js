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
    },

    atomicOperation: function (f) {
        // calls f ensuring that the atomic operation is set throughout.

        return function () {
            if (!atomicTracker.atomicOperationUnderway()) {
                // we are the highest level atomic lock. Code inside should be
                // called with a single atomic lock wrapped around it.

                console.log('Starting new atomic operation');
                atomicTracker.startAtomicOperation();
                f.apply(this, arguments);
                console.log('Ending atomic operation (should be immediately followed by render)');
                atomicTracker.endAtomicOperation();
            } else {
                // we are nested inside some other atomic lock. Just call the
                // function as normal.
                console.log('Interior atomic operation');
                f.apply(this, arguments);
            }
        };


    }


});

var atomicTracker = new AtomicOperationTracker;
module.exports = atomicTracker;

// Use this for atomic args
//function a(args){
//    b.apply(this, arguments);
//}
//function b(args){
//    alert(arguments); //arguments[0] = 1, etc
//}
//a(1,2,3);​