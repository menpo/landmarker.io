var THREE = require('three');

var MAX_NODE_ITEMS = 100;


function octreeForMesh(mesh) {
	if (mesh.geometry.boundingBox === null) {
		mesh.geometry.computeBoundingBox();
	}
	var octree = new OctreeNode(mesh.geometry.boundingBox.min,
	                            mesh.geometry.boundingBox.max);
	var pointsAttribute = mesh.geometry.getAttribute('position');
	var nTris = pointsAttribute.length / 9;
	var p = pointsAttribute.array;
	var box;
	var tmp = new THREE.Vector3;
	for(var i = 0; i < nTris; i++) {
		box = new THREE.Box3;
		tmp.set(p[i * 9], p[i * 9 + 1], p[i * 9 + 2]);
		box.expandByPoint(tmp);
		tmp.set(p[i * 9 + 3], p[i * 9 + 4], p[i * 9 + 5]);
		box.expandByPoint(tmp);
		tmp.set(p[i * 9 + 6], p[i * 9 + 7], p[i * 9 + 8]);
		box.expandByPoint(tmp);
		octree.add(new OctreeItem(box, i));
	}
	octree.finalize();
	return octree;
}

function intersectMesh(raycaster, mesh, octree) {
	// 1. Bring the ray into model space to intersect (remember, that's where
	// our octree was constructed)
	var inverseMatrix = new THREE.Matrix4;
	inverseMatrix.getInverse(mesh.matrixWorld);
	var ray = new THREE.Ray;
	ray.copy(raycaster.ray).applyMatrix4(inverseMatrix);
	var indices = octree.itemsWhichCouldIntersect(ray);
	return intersectTrianglesAtIndices(ray, raycaster, mesh, indices);
}


var vA = new THREE.Vector3;
var vB = new THREE.Vector3;
var vC = new THREE.Vector3;

var descSort = function (a, b) {
	return a.distance - b.distance;
};

var intersectTrianglesAtIndices = function(ray, raycaster, mesh, indices) {

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
};



function OctreeItem(box, payload) {
	this.box = box;
	this.payload = payload;
}


function OctreeNode(min, max) {
	this.min = min;
	this.max = max;
	this.children = [];
	this.items = [];
}

OctreeNode.prototype = Object.create(THREE.Box3.prototype);

OctreeNode.prototype.finalize = function () {
	if (this.isInteriorNode()) {
		for(var i = 0; i < 8; i++) {
			this.children[i].finalize();
		}
	} else {
		for(i = 0; i < this.nItems(); i++) {
			this.items[i] = this.items[i].payload;
		}
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
	} else if (this.nItems() == MAX_NODE_ITEMS) {
		// we've reached capacity and we are trying to add more! Time to split.
		this.subdivide();
		// re-add the item.
		this.add(item);
	} else {
		// boring case of a leaf node - add the item until we are full.
		this.items.push(item);
	}

};

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


OctreeNode.prototype.subdivide = function () {

	var newMin, newMax, toAdd;
	var a = this.min;
	var c = this.center();

	// all subnodes will have this vector from min to max
	var displacement = new THREE.Vector3;
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
		newMax = new THREE.Vector3;
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


exports.OctreeNode = OctreeNode;
exports.octreeForMesh = octreeForMesh;
exports.intersetMesh = intersectMesh;
