
'use strict';

import THREE from 'three';

// once a node gets this full it subdivides.
const MAX_NODE_ITEMS = 75;

// return an octree suitable for use with a buffer geometry instance.
export function octreeForBufferGeometry(geometry) {
    if (geometry.boundingBox === null) {
        geometry.computeBoundingBox();
    }
    // make the top node big enough to contain all the geometry.
    var octree = new OctreeNode(geometry.boundingBox.min,
                                geometry.boundingBox.max);
    var pointsAttribute = geometry.getAttribute('position');
    var nTris = pointsAttribute.length / 9;
    var p = pointsAttribute.array;
    var box;
    var tmp = new THREE.Vector3();
    // run through the points array, creating tight bounding boxes for each
    // point. Insert them into the tree.
    for(let i = 0; i < nTris; i++) {
        box = new THREE.Box3();  // boxes default to empty
        tmp.set(p[i * 9], p[i * 9 + 1], p[i * 9 + 2]);
        box.expandByPoint(tmp);
        tmp.set(p[i * 9 + 3], p[i * 9 + 4], p[i * 9 + 5]);
        box.expandByPoint(tmp);
        tmp.set(p[i * 9 + 6], p[i * 9 + 7], p[i * 9 + 8]);
        box.expandByPoint(tmp);
        octree.add(new OctreeItem(box, i));
    }
    // we never want to change this octree again. we are storing a box-per-triangle
    // that is redundant. Go through and prune all the boxes so our leaves
    // are directly the payloads.
    octree.finalize();
    return octree;
}

// reused for mesh intersections.
var inverseMatrix = new THREE.Matrix4();
var _ray = new THREE.Ray();

var vA = new THREE.Vector3();
var vB = new THREE.Vector3();
var vC = new THREE.Vector3();

function descSort (a, b) {
    return a.distance - b.distance;
}

// this code is largely adapted from THREE.Mesh.prototype.raycast
// (particularly the geometry instanceof THREE.BufferGeometry branch)
function intersectTrianglesAtIndices (ray, raycaster, mesh, indices) {

    var intersects = [];
    var material = mesh.material;
    var attributes = mesh.geometry.attributes;
    var a, b, c, j, intersectionPoint;
    var precision = raycaster.precision;
    var p = attributes.position.array;

    for (var i = 0; i < indices.length; i++) {
        j = indices[i] * 9;
        a = indices[i];
        b = indices[i] + 1;
        c = indices[i] + 2;

        vA.set(p[j], p[j + 1], p[j + 2]);
        vB.set(p[j + 3], p[j + 4], p[j + 5]);
        vC.set(p[j + 6], p[j + 7], p[j + 8]);

        if (material.side === THREE.BackSide) {
            intersectionPoint = ray.intersectTriangle(vC, vB, vA, true);
        } else {
            intersectionPoint = ray.intersectTriangle(vA, vB, vC, material.side !== THREE.DoubleSide);
        }

        if (intersectionPoint === null) {
            continue;
        }

        intersectionPoint.applyMatrix4(mesh.matrixWorld);
        var distance = raycaster.ray.origin.distanceTo(intersectionPoint);

        if (distance < precision || distance < raycaster.near || distance > raycaster.far) {
            continue;
        }

        intersects.push({
            distance: distance,
            point: intersectionPoint,
            indices: [a, b, c],
            face: null,
            faceIndex: null,
            object: mesh
        });
    }
    intersects.sort(descSort);
    return intersects;
}

export function intersectMesh(raycaster, mesh, octree) {
    // 1. Bring the ray into model space to intersect (remember, that's where
    // our octree was constructed)
    inverseMatrix.getInverse(mesh.matrixWorld);
    _ray.copy(raycaster.ray).applyMatrix4(inverseMatrix);
    // query our octree (which only stores triangle indices) to find potential intersections.
    var indices = octree.itemsWhichCouldIntersect(_ray);
    // now we can just whip through the few triangles in question and check for intersections.
    return intersectTrianglesAtIndices(_ray, raycaster, mesh, indices);
}

// The datum stored in our octree. On finalization, these items will be replaced
// by the payload only.
function OctreeItem(box, payload) {
    this.box = box;
    this.payload = payload;
}

export function OctreeNode(min, max) {
    this.min = min;
    this.max = max;
    this.children = [];
    this.items = [];
}

// by extending Box we save memory - no need to have our node have a box - it
// *is* one!
OctreeNode.prototype = Object.create(THREE.Box3.prototype);

// when all is said and done, we have a lot of boxes that are redundant on leaf
// nodes. Go though and prune them all from the tree.
OctreeNode.prototype.finalize = function () {
    if (this.isInteriorNode()) {
        for(var i = 0; i < 8; i++) {
            this.children[i].finalize();
        }
    } else {
        for(i = 0; i < this.nItems(); i++) {
            this.items[i] = this.items[i].payload;
        }
        this.children = null;
    }
};

OctreeNode.prototype.nItems = function () {
    return this.items.length;
};

OctreeNode.prototype.nSubNodes = function () {
    var count = 1;
    if (this.isInteriorNode()) {
        for(var i = 0; i < 8; i++) {
            count += this.children[i].nSubNodes();
        }
    }
    return count;
};

OctreeNode.prototype.nSubItems = function () {
    var count = 0;
    if (this.isInteriorNode()) {
        for(var i = 0; i < 8; i++) {
            count += this.children[i].nSubItems();
        }
    } else {
        count = this.nItems();
    }
    return count;
};

OctreeNode.prototype.isInteriorNode = function () {
    return this.items === null;
};

OctreeNode.prototype.add = function(item) {
    if (this.isInteriorNode()) {
        for (var i = 0; i < 8; i++) {
            if (this.children[i].isIntersectionBox(item.box)) {
                this.children[i].add(item);
            }
        }
    } else if (this.nItems() === MAX_NODE_ITEMS) {
        // we've reached capacity and we are trying to add more! Time to split.
        this.subdivide();
        // re-add the item.
        this.add(item);
    } else {
        // boring case of a leaf node - add the item until we are full.
        this.items.push(item);
    }

};

// retrieve a list of items from this node and all subnodes that can intersect.
OctreeNode.prototype.itemsWhichCouldIntersect = function(ray) {
    var items = [];
    if (ray.isIntersectionBox(this)) {
        if (this.isInteriorNode()) {
            for (var i = 0; i < this.children.length; i++) {
                items = items.concat(this.children[i].itemsWhichCouldIntersect(ray));
            }
        } else {
            items = this.items;
        }
    }
    return items;
};

// Split this node into 8 subnodes.
OctreeNode.prototype.subdivide = function () {

    var newMin, newMax, toAdd;
    var a = this.min;
    var c = this.center();

    // all subnodes will have this vector from min to max
    var displacement = new THREE.Vector3();
    displacement.subVectors(this.center(), this.min);

    // declare the min value of each new box
    var mins = [
        // bottom level
        this.min,
        new THREE.Vector3(c.x, a.y, a.z),
        new THREE.Vector3(a.x, c.y, a.z),
        new THREE.Vector3(c.x, c.y, a.z),
        // top level
        new THREE.Vector3(a.x, a.y, c.z),
        new THREE.Vector3(c.x, a.y, c.z),
        new THREE.Vector3(a.x, c.y, c.z),
        c];

    // create the 8 children
    for (var i = 0; i < mins.length; i++) {
        newMin = mins[i];
        newMax = new THREE.Vector3();
        newMax.addVectors(newMin, displacement);
        this.children.push(new OctreeNode(newMin, newMax));
    }

    // we're an interior node now.
    toAdd = this.items;
    this.items = null;

    // go through all our points and add them to our new lovely children
    for (i = 0; i < toAdd.length; i++) {
        this.add(toAdd[i]);
    }
};
