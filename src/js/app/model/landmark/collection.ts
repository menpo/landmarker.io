import atomic from '../atomic';
import { Landmark } from './landmark';

export class LandmarkCollection {
    
    landmarks: Landmark[]
    
    constructor(landmarks: Landmark[]) {
        this.landmarks = landmarks
    }
    
    selected = () => {
        return this.landmarks.filter(lm => lm.isSelected())
    }
    
    isEmpty = () => {
        return this.landmarks.every(lm => lm.isEmpty());
    }
       
    hasEmpty = () => {
        return this.landmarks.some(lm => lm.isEmpty());
    }
    
    deselectAll = atomic.atomicOperation(() => {
        this.landmarks.forEach(lm => lm.deselect());
    })
    
    selectAll = atomic.atomicOperation(() => {
        this.landmarks.forEach(lm => lm.select());
    })
    
}
