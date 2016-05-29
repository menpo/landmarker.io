import * as THREE from 'three'
import { notify } from '../../view/notification'
import Tracker from '../../lib/tracker'
import { atomic } from '../atomic'
import { Backend } from '../../backend'

import { Landmark } from './landmark'
import { LandmarkCollection }  from './collection'
import { LandmarkLabel } from './label'

type LabelAndMask = {
    label: string,
    mask: number[]
}

type JSONPoint = [number, number, number] | [number, number]

interface LJSON {
    landmarks: {
        points: JSONPoint[]
        connectivity: [number, number][]
    }
    labels: {
        label: string,
        mask: number[]
    }[]
}

export interface LJSONFile extends LJSON {
    version: number
}

type LGTrackerOperation = [
    number,         // Index
    THREE.Vector3,  // Point before
    THREE.Vector3   // Point After
][]

export type LandmarkGroupTracker = Tracker<LJSON, LGTrackerOperation>

// factory function to produce a tracker for use with Landmark Groups.
export const landmarkGroupTrackerFactory = () => new Tracker<LJSON, LGTrackerOperation>()

function _validateConnectivity (nLandmarks: number,
                                connectivity: [number, number][]): [number, number][] {
    if (!connectivity) {
        return []
    }
    connectivity.forEach(([a, b]) => {
        if (a < 0 || a >= nLandmarks || b < 0 || b >= nLandmarks) {
            // we have bad connectivity!
            throw new Error(
                "Illegal connectivity encountered - [" + a + ", " + b +
                "] not permitted in group of " + nLandmarks + " landmarks")
        }
    })

    return connectivity
}

function _pointToVector (p: JSONPoint) : [THREE.Vector3, number] {
    const n = p.length
    const [x, y] = p
    const z = (n === 3) ?  p[2] : 0
    const allNonNull = (x !== null && y !== null && z !== null)
    const v = allNonNull ? new THREE.Vector3(x, y, z) : null
    return [v, n]
}

// LandmarkGroup is the container for all the landmarks for a single asset.
export class LandmarkGroup extends LandmarkCollection {

    connectivity: [number, number][]
    id: string
    type: string
    backend: Backend
    tracker: LandmarkGroupTracker
    labels: LandmarkLabel[]

    constructor(points: JSONPoint[], connectivity: [number, number][],
                labels: LabelAndMask[], id: string, type: string,
                backend: Backend, tracker: LandmarkGroupTracker) {

        // 1. Build landmarks from points
        super(points.map((p, index) => {
            const [point, nDims] = _pointToVector(p)
            return new Landmark(this, index, nDims, point)
        }))

        this.id = id
        this.type = type
        this.backend = backend
        this.tracker = tracker || landmarkGroupTrackerFactory()

        // 2. Validate and assign connectivity (if there is any, it's not mandatory)
        this.connectivity = _validateConnectivity(this.landmarks.length,
                                                  connectivity)

        // 3. Build labels
        this.labels = labels.map((label) => {
            return new LandmarkLabel(label.label, this.landmarks, label.mask)
        })

        // make sure we start with a sensible insertion configuration.
        this.resetNextAvailable()
        this.tracker.recordState(this.toJSON(), true)
    }

    static parse(json: LJSONFile, id: string, type: string, backend: Backend, tracker: LandmarkGroupTracker) {
        return new LandmarkGroup(
            json.landmarks.points,
            json.landmarks.connectivity,
            json.labels,
            id,
            type,
            backend,
            tracker
        )
    }

    // Restore landmarks from json saved, should be of the same template so
    // no hard checking ot resetting the labels
    restore = atomic.atomicOperation(({ landmarks, labels }: LJSON): void => {
        const {points, connectivity} = landmarks

        this.landmarks.forEach(lm => lm.clear())
        points.forEach((p, i) => {
            const [v] = _pointToVector(p)
            if (v) {
                this.landmarks[i].setPoint(v)
            }
        })

        this.connectivity = _validateConnectivity(this.landmarks.length,
                                                  connectivity)

        delete this.labels
        this.labels = labels.map(label => new LandmarkLabel(label.label, this.landmarks, label.mask))

        this.resetNextAvailable()
    })

    nextAvailable = (): Landmark => {
        for (let i = 0; i < this.landmarks.length; i++) {
            if (this.landmarks[i].isNextAvailable()) {
                return this.landmarks[i]
            }
        }
        return null
    }

    clearAllNextAvailable = () => {
        this.landmarks.forEach(function (l) {
            l.clearNextAvailable()
        })
    }

    // Sets the next available landmark to be either the first empty one,
    // or if originLm is provided from the set, the first empty on after
    // the originLm in storage order which is assumed to be logical order
    // (Loop over all lms to clear the next available flag)
    resetNextAvailable = (originLm: Landmark=null) => {

        let first: Landmark, next: Landmark
        let pastOrigin = (originLm === null)

        this.landmarks.forEach(lm => {
            lm.clearNextAvailable()
            pastOrigin = pastOrigin || lm === originLm

            if (lm.isEmpty() && (!next || !first)) {
                if (!next && pastOrigin) {
                    next = lm
                } else if (!first && !pastOrigin) {
                    first = lm
                }
            }
        })

        next = !next ? first : next         // Nothing was found after the origin
        if (next) {
            next.setNextAvailable()
        }

        return next
    }

    deleteSelected = atomic.atomicOperation(() => {
        const ops: LGTrackerOperation = []
        this.selected().forEach(function (lm) {
            ops.push([lm.index(), lm.point().clone(), undefined])
            lm.clear()
        })
        // reactivate the group to reset next available.
        this.resetNextAvailable()
        this.tracker.record(ops)
    })

    insertNew = atomic.atomicOperation((v: THREE.Vector3) => {
        const lm = this.nextAvailable()
        if (lm === null) {
            return null    // nothing left to insert!
        }
        // we are definitely inserting.
        this.deselectAll()
        this.setLmAt(lm, v)
        this.resetNextAvailable(lm)
    })

   setLmAt = (lm: Landmark, v: THREE.Vector3) => {

        if (!v) {
            return
        }
        this.tracker.record([
            [lm.index(),
            lm.point() ? lm.point().clone() : undefined,
            v.clone() ]
        ])

        lm.set({
            point: v.clone(),
            selected: true,
            isEmpty: false,
            nextAvailable: false
        })
    }

    toJSON = (): LJSONFile => {
        return {
            landmarks: {
                points: this.landmarks.map(lm => lm.toJSON()),
                connectivity: this.connectivity
            },
            labels: this.labels.map(label => label.toJSON()),
            version: 2
        }
    }

    save = () => {
        return this.backend
            .saveLandmarkGroup(this.id, this.type, this.toJSON())
            .then(() => {
                this.tracker.recordState(this.toJSON(), true)
                notify({type: 'success', msg: 'Save Completed'})
            }, () => {
                notify({type: 'error', msg: 'Save Failed'})
            })
    }

    undo = () => {
        this.tracker.undo((ops) => {
            ops.forEach(([index, start]) => {
                if (!start) {
                    this.landmarks[index].clear()
                } else {
                    this.landmarks[index].setPoint(start.clone())
                }
            })
            this.resetNextAvailable()
        }, json => {
            this.restore(json)
        })
    }

    redo = () => {
        this.tracker.redo(ops => {
            ops.forEach(([index, , end]) => {
                if (!end) {
                    this.landmarks[index].clear()
                } else {
                    this.landmarks[index].setPoint(end.clone())
                }
            })
            this.resetNextAvailable()
        }, (json) => {
            this.restore(json)
        })
    }

    completeGroups = () => {
        this.labels.forEach((label) => {
            // May be a way to review the structure as this is n^2 worse
            if (label.landmarks.some(lm => lm.isSelected())) {
                label.selectAll()
            }
        })
    }
}
