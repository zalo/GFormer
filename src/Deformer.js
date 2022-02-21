import * as THREE from '../node_modules/three/build/three.module.js';
/** A simple class for deoforming vertices given control points. */
export class Deformer {
    /** A simple class for deforming vertices given control points.
     *  @param {World} world
     *  @param {THREE.Group} gcodeObject */
    constructor(world, gcodeObject, deformerParams, bindPoints, controlPoints) {
        this.world = world;
        /** @type {THREE.Group} */
        this.gcodeObject = gcodeObject;
        /** @type {THREE.Mesh[]} */
        this.bindPoints = bindPoints;
        /** @type {THREE.Mesh[]} */
        this.controlPoints = controlPoints;
        /** @type {THREE.Vector3} */
        this.localControlPos = new THREE.Vector3();

        this.deformerParams = deformerParams;

        this.numVertices = 0;
        let positions = [];
        for (let child in this.gcodeObject.children) {
            /** @type {THREE.LineSegments} */
            let curChild = this.gcodeObject.children[child];
            /** @type {THREE.Float32BufferAttribute} */
            let position = curChild.geometry.attributes.position;
            this.numVertices += position.count;
            positions = positions.concat(Array.from(position.array));
        }
        //console.log("Initial Positions", positions);
        this.restingPositions  = new Float32Array(positions);

        this.initializeWeights(this.deformerParams, this.bindPoints, this.controlPoints);
    }

    initializeWeights(deformerParams, bindPoints, controlPoints) {
        /** @type {THREE.Mesh[]} */
        this.bindPoints = bindPoints;
        /** @type {THREE.Mesh[]} */
        this.controlPoints = controlPoints;

        let lockToGround  = deformerParams['Lock Ground'];
        let weightFalloff = deformerParams['Falloff Weight'];

        this.deformedPositions = new Float32Array(this.restingPositions);

        // Calculate the normalized weights of each each vertex relative to each control point
        this.workingVector = new THREE.Vector3();
        this.weights = new Float32Array(this.numVertices * this.controlPoints.length);
        for (let i = 0; i < this.numVertices; i++) {
            // Initialize Weights such that vertices are locked to the ground
            let totalWeight = lockToGround ? 1.0/Math.pow((Math.abs(this.restingPositions[(i * 3) + 2]-0.3)), weightFalloff) : 0.0;
            for (let j = 0; j < this.controlPoints.length; j++) {
                this.workingVector.fromArray(this.restingPositions, i * 3);
                let distance = this.workingVector.distanceTo(
                    this.gcodeObject.worldToLocal(this.localControlPos.copy(this.bindPoints[j].position)));
                let relativeWeight = 1.0 / Math.pow(distance + 0.001, weightFalloff);
                this.weights[(i * this.controlPoints.length) + j] = relativeWeight;
                totalWeight += relativeWeight;
            }

            // Normalize the weights
            for (let j = 0; j < this.controlPoints.length; j++) {
                this.weights[(i * this.controlPoints.length) + j] /= totalWeight;
            }
        }

        // Refresh the model with the new positions
        this.updateDeformation();
    }

    calculateDeformedPositions() {
        let translationalDisplacement = new THREE.Vector3();
        let vertToControlOffset       = new THREE.Vector3();
        let rotationalDisplacement    = new THREE.Vector3();
        let vertexDisplacement = new THREE.Vector3();
        
        // Avoid Arrays of Vector3's
        let localBindPositions = new Array(this.bindPoints.length * 3), localControlPositions = new Array(this.controlPoints.length * 3);
        for (let i = 0; i < this.bindPoints.length; i++) {
            this.gcodeObject.worldToLocal(new THREE.Vector3().copy(this.bindPoints   [i].position)).toArray(localBindPositions   , i * 3);
            this.gcodeObject.worldToLocal(new THREE.Vector3().copy(this.controlPoints[i].position)).toArray(localControlPositions, i * 3);
        }

        let solveRotation = this.deformerParams['Solve Rotation'];

        for (let i = 0; i < this.numVertices; i++) {
            vertexDisplacement.set(0, 0, 0);
            for (let j = 0; j < this.controlPoints.length; j++) {
                if (solveRotation) {
                    translationalDisplacement.x = localControlPositions[(j * 3) + 0] - localBindPositions[(j * 3) + 0];
                    translationalDisplacement.y = localControlPositions[(j * 3) + 1] - localBindPositions[(j * 3) + 1];
                    translationalDisplacement.z = localControlPositions[(j * 3) + 2] - localBindPositions[(j * 3) + 2];
                    vertToControlOffset.fromArray(this.restingPositions, i * 3);//.sub(localBindPositions[j]);
                    vertToControlOffset.x -= localBindPositions[(j * 3) + 0];
                    vertToControlOffset.y -= localBindPositions[(j * 3) + 1];
                    vertToControlOffset.z -= localBindPositions[(j * 3) + 2];
                    rotationalDisplacement.copy(vertToControlOffset).applyQuaternion(this.controlPoints[j].quaternion).sub(vertToControlOffset);
                    vertexDisplacement.add(translationalDisplacement.add(rotationalDisplacement).multiplyScalar(this.weights[(i * this.controlPoints.length) + j]));
                } else {
                    translationalDisplacement.x = localControlPositions[(j * 3) + 0] - localBindPositions[(j * 3) + 0];
                    translationalDisplacement.y = localControlPositions[(j * 3) + 1] - localBindPositions[(j * 3) + 1];
                    translationalDisplacement.z = localControlPositions[(j * 3) + 2] - localBindPositions[(j * 3) + 2];
                    vertexDisplacement.add(translationalDisplacement.multiplyScalar(this.weights[(i * this.controlPoints.length) + j]));
                }
            }

            // Apply the deformation
            this.deformedPositions[ i * 3     ] = this.restingPositions[ i * 3     ] + vertexDisplacement.x;
            this.deformedPositions[(i * 3) + 1] = this.restingPositions[(i * 3) + 1] + vertexDisplacement.y;
            this.deformedPositions[(i * 3) + 2] = this.restingPositions[(i * 3) + 2] + vertexDisplacement.z;
        }
    }

    updateDeformation() {
        this.calculateDeformedPositions();

        // Copy the deformed positions into the array
        this.offset = 0;
        for (let child in this.gcodeObject.children) {
            /** @type {THREE.LineSegments} */
            let curChild = this.gcodeObject.children[child];
            //console.log("Updating Positions on", curChild.name);

            /** @type {THREE.Float32BufferAttribute} */
            let position = curChild.geometry.attributes.position;
            /** @type {Float32Array} */
            let array = position.array;
            array.set(this.deformedPositions.subarray(this.offset, this.offset + (position.count * 3)));
            this.offset += position.array.length;

            curChild.geometry.attributes.position.needsUpdate = true;
        }
    }
}
