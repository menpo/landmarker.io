import * as _ from 'underscore'
import * as Backbone from 'backbone'
import { LandmarkGroup } from './group'

const DEFAULTS = {
    selected: false,
    nextAvailable: false,
}

type JSONLandmark = [number, number, number] | [number, number]

export class Landmark extends Backbone.Model {

    nDims: number
    index: number

    constructor (group: LandmarkGroup, index: number, nDims: number, point: THREE.Vector3) {
        super(DEFAULTS)
        this.set({ group, point })
        this.nDims = nDims
        this.index = index
    }

    get group() : LandmarkGroup {
        return this.get('group')
    }

    get point(): THREE.Vector3 {
        return this.get('point')
    }

    set point(point: THREE.Vector3) {
        this.set('point', point)
    }

    isEmpty = (): boolean => {
        return !this.has('point')
    }

    isSelected = (): boolean => {
        return this.get('selected')
    }

    select = () => {
        if (!this.isEmpty() && !this.isSelected()) {
            this.set('selected', true)
        }
    }

    selectAndDeselectRest = () => {
        this.group.deselectAll()
        this.select()
    }

    deselect = () => {
        if(this.isSelected()) {
            this.set('selected', false)
        }
    }

    isNextAvailable = (): boolean => {
        return this.get('nextAvailable')
    }

    setNextAvailable = () : void => {
        this.group.clearAllNextAvailable()
        this.set('nextAvailable', true)
    }

    clearNextAvailable = () : void => {
        if (this.isNextAvailable()) {
            this.set('nextAvailable', false)
        }
    }

    clear() {
        this.set({ point: null, selected: false })
    }

    toJSON(): JSONLandmark {
        let pointJSON: JSONLandmark
        if (!this.isEmpty()) {
            const point = this.point
            if (this.nDims === 2) {
                pointJSON = [point.x, point.y]
            } else {
                pointJSON = [point.x, point.y, point.z]
            }
        } else {
            if (this.nDims === 2) {
                pointJSON = [null, null]
            } else {
                pointJSON = [null, null, null]
            }
        }
        return pointJSON
    }
}
