import { Landmark } from './landmark'
import { LandmarkCollection } from './collection'

// LandmarkLabel is a 'playlist' of landmarks from the LandmarkGroup.
export class LandmarkLabel extends LandmarkCollection {

    label: string
    mask: number[]

    constructor(label: string, landmarks: Landmark[], mask: number[]) {
        super(mask.map(m => landmarks[m]))
        this.label = label
        this.mask = mask
    }

    toJSON() {
        return {
            label: this.label,
            mask: this.mask
        }
    }
}
