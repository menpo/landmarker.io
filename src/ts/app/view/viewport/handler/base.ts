import { Landmark } from '../base'

export function findClosestLandmarks(lms: Landmark[], point: THREE.Vector, n = 4) {
    return lms
        .map(lm => ({ landmark: lm, distance: point.distanceTo(lm.point) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, n)
        .map(lmd => lmd.landmark)
}
