import * as THREE from 'three'

// once a node gets this full it subdivides.
const MAX_NODE_ITEMS = 75

export interface Intersection {
    distance: number
    point: THREE.Vector3,
    object: THREE.Object3D,
    [propName: string]: any  // and other stuff...
}

// return an octree suitable for use with a buffer geometry instance.
export function octreeForBufferGeometry(geometry: THREE.BufferGeometry): Octree {
    if (geometry.boundingBox === null) {
        geometry.computeBoundingBox()
    }
    // make the top node big enough to contain all the geometry.
    const octree = new ExtendableOctree(geometry.boundingBox.min,
                                              geometry.boundingBox.max)
    const pointsAttribute = geometry.getAttribute('position') as THREE.BufferAttribute
    const nTris = pointsAttribute.length / 9
    const p = pointsAttribute.array
    const tmp = new THREE.Vector3()
    let box: THREE.Box3
    // run through the points array, creating tight bounding boxes for each
    // point. Insert them into the tree.
    for(let i = 0; i < nTris; i++) {
        box = new THREE.Box3()  // boxes default to empty
        tmp.set(p[i * 9], p[i * 9 + 1], p[i * 9 + 2])
        box.expandByPoint(tmp)
        tmp.set(p[i * 9 + 3], p[i * 9 + 4], p[i * 9 + 5])
        box.expandByPoint(tmp)
        tmp.set(p[i * 9 + 6], p[i * 9 + 7], p[i * 9 + 8])
        box.expandByPoint(tmp)
        octree.add(i, box)
    }
    // we never want to change this octree again. we are storing a box-per-triangle
    // that is redundant. Go through and prune all the boxes so our leaves
    // are directly the payloads.
    return octree.finalize()
}

const vA = new THREE.Vector3()
const vB = new THREE.Vector3()
const vC = new THREE.Vector3()

// this code is largely adapted from THREE.Mesh.prototype.raycast
// (particularly the geometry instanceof THREE.BufferGeometry branch)
function intersectTrianglesAtIndices(ray: THREE.Ray,
                                     raycaster: THREE.Raycaster,
                                     mesh: THREE.Mesh,
                                     indices: number[]): Intersection[] {

    const intersects: Intersection[] = []
    const material = mesh.material
    const attributes = (mesh.geometry as THREE.BufferGeometry).attributes as THREE.BufferAttribute
    const precision = raycaster.precision
    const p = attributes.position.array
    let a: number, b: number, c: number, j: number, distance: number
    let intersectionPoint: THREE.Vector3

    for (let i = 0; i < indices.length; i++) {
        j = indices[i] * 9
        a = indices[i]
        b = indices[i] + 1
        c = indices[i] + 2

        vA.set(p[j], p[j + 1], p[j + 2])
        vB.set(p[j + 3], p[j + 4], p[j + 5])
        vC.set(p[j + 6], p[j + 7], p[j + 8])

        if (material.side === THREE.BackSide) {
            intersectionPoint = ray.intersectTriangle(vC, vB, vA, true)
        } else {
            intersectionPoint = ray.intersectTriangle(vA, vB, vC, material.side !== THREE.DoubleSide)
        }

        if (intersectionPoint === null) {
            continue
        }

        intersectionPoint.applyMatrix4(mesh.matrixWorld)
        distance = raycaster.ray.origin.distanceTo(intersectionPoint)

        if (distance < precision || distance < raycaster.near || distance > raycaster.far) {
            continue
        }

        intersects.push({
            distance: distance,
            point: intersectionPoint,
            object: mesh
        })
    }
    intersects.sort((a, b) => a.distance - b.distance)
    return intersects
}

// by extending Box we save memory - no need for our node have a box - it
// *is* one!
class OctreeNode<T extends OctreeNode<T> > extends THREE.Box3 {
    children: T[] = []  // our children are a subclass of ourselves
    items: number[] = []

    get isInteriorNode() {
        return this.items === null
    }

    get nItems() {
        return this.items.length
    }

    get nSubNodes() {
        let count = 1
        if (this.isInteriorNode) {
            for(var i = 0; i < 8; i++) {
                count += this.children[i].nSubNodes
            }
        }
        return count
    }

    get nSubItems() {
        var count = 0
        if (this.isInteriorNode) {
            for(var i = 0; i < 8; i++) {
                count += this.children[i].nSubItems
            }
        } else {
            count = this.nItems
        }
        return count
    }

    // retrieve a list of items from this node and all subnodes that can intersect.
    itemsWhichCouldIntersect(ray: THREE.Ray): number[] {
        let items: number[] = []
        if (ray.isIntersectionBox(this)) {
            if (this.isInteriorNode) {
                for (let i = 0; i < this.children.length; i++) {
                    items = items.concat(this.children[i].itemsWhichCouldIntersect(ray))
                }
            } else {
                items = this.items
            }
        }
        return items
    }
}


class ExtendableOctree extends OctreeNode<ExtendableOctree> {

    // during construction we need to keep the boxes for items around
    // (we will need them in the event of subdivision)
    boxes: THREE.Box3[] = []

    add(item: number, box: THREE.Box3) {
        if (this.isInteriorNode) {
            for (var i = 0; i < 8; i++) {
                if (this.children[i].isIntersectionBox(box)) {
                    this.children[i].add(item, box)
                }
            }
        } else if (this.nItems === MAX_NODE_ITEMS) {
            // we've reached capacity and we are trying to add more! Time to split.
            this.subdivide()
            // re-add the item.
            this.add(item, box)
        } else {
            // boring case of a leaf node - add the item until we are full.
            // keep track of the bounding boxes.
            this.items.push(item)
            this.boxes.push(box)
        }
    }

    // Split this node into 8 subnodes.
    subdivide() {
        const m = this.min
        const c = this.center()

        // all subnodes will have this vector from min to max
        const displacement = new THREE.Vector3()
        displacement.subVectors(c, m)

        // declare the min value of each new box
        const mins = [
            // bottom level
            this.min,
            new THREE.Vector3(c.x, m.y, m.z),
            new THREE.Vector3(m.x, c.y, m.z),
            new THREE.Vector3(c.x, c.y, m.z),
            // top level
            new THREE.Vector3(m.x, m.y, c.z),
            new THREE.Vector3(c.x, m.y, c.z),
            new THREE.Vector3(m.x, c.y, c.z),
            c]

        // create the 8 children
        this.children = mins.map(newMin => {
            const newMax = new THREE.Vector3()
            newMax.addVectors(newMin, displacement)
            return new ExtendableOctree(newMin, newMax)
        })

        const itemsToAdd = this.items
        const boxesToAdd = this.boxes

        // we're an interior node now.
        this.items = null
        this.boxes = null

        // re-add our old items to our new lovely children
        itemsToAdd.forEach((item, i) => this.add(item, boxesToAdd[i]))
    }

    // when all is said and done, we have a lot of boxes that are redundant
    // Return a new tree with everything pruned out.
    finalize() : Octree {
        if (this.isInteriorNode) {
            const new_children = this.children.map(child => child.finalize())
            return new Octree(this.min, this.max, new_children, this.items)
        } else {
            return new Octree(this.min, this.max, null, this.items)
        }
    }
}


export class Octree extends OctreeNode<Octree> {

    constructor(min: THREE.Vector3, max: THREE.Vector3, children: Octree[], items: number[]) {
        super(min, max)
        this.children = children
        this.items = items
    }

    intersectMesh(raycaster: THREE.Raycaster, mesh: THREE.Mesh): Intersection[] {
        const inverseMatrix = new THREE.Matrix4()
        const ray = new THREE.Ray()
        // 1. Bring the ray into model space to intersect (remember, that's where
        // our octree was constructed)
        // reused for mesh intersections.
        inverseMatrix.getInverse(mesh.matrixWorld)
        ray.copy(raycaster.ray).applyMatrix4(inverseMatrix)
        // 2. query our octree (which only stores triangle indices) to find potential intersections.
        const indices = this.itemsWhichCouldIntersect(ray)
        // 3. now we can just whip through the few triangles in question and check for intersections.
        return intersectTrianglesAtIndices(ray, raycaster, mesh, indices)
    }
}
