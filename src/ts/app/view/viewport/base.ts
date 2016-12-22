export interface Landmark {
    point: THREE.Vector3,
    index: number,
    isSelected: boolean
}

// Describe a change to a single landmark
export type LandmarkDelta = [number, THREE.Vector3, THREE.Vector3]

export interface Intersection {
    distance: number
    point: THREE.Vector3,
    object: THREE.Object3D
}
