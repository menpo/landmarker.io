'use strict';

import * as Backbone from 'backbone';

class AtomicOperationTracker extends Backbone.Model {

    constructor() {
        super()
        this.set('ATOMIC_OPERATION', false)
    }
    
    _startAtomicOperation () {
        this.set('ATOMIC_OPERATION', true);
    }

    _endAtomicOperation () {
        this.set('ATOMIC_OPERATION', false);
    }

    atomicOperationUnderway () {
        return this.get('ATOMIC_OPERATION');
    }

    atomicOperationFinished () {
        return !this.get('ATOMIC_OPERATION');
    }

    atomicOperation (f) {
        // calls f ensuring that the atomic operation is set throughout.

        return function () {
            if (!atomicTracker.atomicOperationUnderway()) {
                // we are the highest level atomic lock. Code inside should be
                // called with a single atomic lock wrapped around it.

                // console.log('Starting atomic operation');
                atomicTracker._startAtomicOperation();
                f.apply(this, arguments);
                // console.log('Ending atomic operation');
                atomicTracker._endAtomicOperation();
            } else {
                // we are nested inside some other atomic lock. Just call the
                // function as normal.
                f.apply(this, arguments);
            }
        };
    }
    
}
const atomicTracker = new AtomicOperationTracker()

export default atomicTracker
// export const atomicOperation = f => atomicTracker.atomicOperation(f);
// export const on = atomicTracker.on;
// export const atomicOperationUnderway = () => atomicTracker.atomicOperationUnderway()
