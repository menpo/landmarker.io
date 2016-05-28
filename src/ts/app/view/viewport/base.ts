export interface Landmark {
    point: THREE.Vector3,
    index: number,
    isSelected: boolean
}

export interface Intersection {
    distance: number
    point: THREE.Vector3,
    object: THREE.Object3D
}
