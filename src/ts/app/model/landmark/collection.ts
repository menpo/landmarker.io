import { Landmark } from './landmark'

export class LandmarkCollection {

    landmarks: Landmark[]

    constructor(landmarks: Landmark[]) {
        this.landmarks = landmarks
    }

    selected() {
        return this.landmarks.filter(lm => lm.isSelected())
    }

    isEmpty() {
        return this.landmarks.every(lm => lm.isEmpty())
    }

    hasEmpty() {
        return this.landmarks.some(lm => lm.isEmpty())
    }

    deselectAll() {
        this.landmarks.forEach(lm => lm.deselect())
    }

    selectAll() {
        this.landmarks.forEach(lm => lm.select())
    }

}
