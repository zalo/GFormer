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
            this.workingVector.fromArray(this.restingPositions, i * 3);
            this.calculateWeights(this.workingVector, lockToGround, weightFalloff, this.weights, i * this.controlPoints.length);
        }

        // Refresh the model with the new positions
        this.updateDeformation();
    }

    calculateWeights(point, lockToGround, weightFalloff, weights, weightsOffset) {
        // Initialize Weights such that vertices are locked to the ground
        let totalWeight = lockToGround ? 1.0/Math.pow((Math.abs(point.z-0.3)), weightFalloff) : 0.0;
        for (let j = 0; j < this.controlPoints.length; j++) {
            let distance = point.distanceTo(this.localControlPos.copy(this.bindPoints[j].position));
            let relativeWeight = 1.0 / Math.pow(distance + 0.001, weightFalloff);
            weights[weightsOffset + j] = relativeWeight;
            totalWeight += relativeWeight;
        }

        // Normalize the weights
        for (let j = 0; j < this.controlPoints.length; j++) {
            weights[weightsOffset + j] /= totalWeight;
        }
    }

    calculateVertexDisplacement(inputPosition, weights, weightOffset,
            translationalDisplacement, vertToControlOffset, rotationalDisplacement, vertexDisplacement, solveRotation) {
        vertexDisplacement.set(0, 0, 0);
        for (let j = 0; j < this.controlPoints.length; j++) {
            if (solveRotation) {
                translationalDisplacement.x = this.localControlPositions[(j * 3) + 0] - this.localBindPositions[(j * 3) + 0];
                translationalDisplacement.y = this.localControlPositions[(j * 3) + 1] - this.localBindPositions[(j * 3) + 1];
                translationalDisplacement.z = this.localControlPositions[(j * 3) + 2] - this.localBindPositions[(j * 3) + 2];
                vertToControlOffset.copy(inputPosition);//.sub(this.localBindPositions[j]);
                vertToControlOffset.x -= this.localBindPositions[(j * 3) + 0];
                vertToControlOffset.y -= this.localBindPositions[(j * 3) + 1];
                vertToControlOffset.z -= this.localBindPositions[(j * 3) + 2];
                rotationalDisplacement.copy(vertToControlOffset).applyQuaternion(this.controlPoints[j].quaternion).sub(vertToControlOffset);
                vertexDisplacement.add(translationalDisplacement.add(rotationalDisplacement).multiplyScalar(weights[weightOffset + j]));
            } else {
                translationalDisplacement.x = this.localControlPositions[(j * 3) + 0] - this.localBindPositions[(j * 3) + 0];
                translationalDisplacement.y = this.localControlPositions[(j * 3) + 1] - this.localBindPositions[(j * 3) + 1];
                translationalDisplacement.z = this.localControlPositions[(j * 3) + 2] - this.localBindPositions[(j * 3) + 2];
                vertexDisplacement.add(translationalDisplacement.multiplyScalar(weights[weightOffset + j]));
            }
        }
        return vertexDisplacement;
    }

    calculateDeformedPositions() {
        let translationalDisplacement = new THREE.Vector3();
        let vertToControlOffset       = new THREE.Vector3();
        let rotationalDisplacement    = new THREE.Vector3();
        let vertexDisplacement        = new THREE.Vector3();
        
        // Avoid Arrays of Vector3's
        this.localBindPositions    = new Array(this.bindPoints.length * 3);
        this.localControlPositions = new Array(this.controlPoints.length * 3);
        for (let i = 0; i < this.bindPoints.length; i++) {
            this.bindPoints   [i].position.toArray(this.localBindPositions   , i * 3);
            this.controlPoints[i].position.toArray(this.localControlPositions, i * 3);
        }

        let solveRotation = this.deformerParams['Solve Rotation'];
        if (solveRotation) { this.calculateControlPointRotations(); }

        for (let i = 0; i < this.numVertices; i++) {
            vertexDisplacement = this.calculateVertexDisplacement(vertToControlOffset.fromArray(this.restingPositions, i * 3),
                this.weights, (i * this.controlPoints.length), translationalDisplacement, vertToControlOffset, rotationalDisplacement,
                vertexDisplacement, solveRotation);

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

    //Calculate the rotation of each control point (this is loosely based on a polar decomposition)...
    calculateControlPointRotations(iters = 50) {
        let omegaNumerator   = new THREE.Vector3(); let omegaDenominator = 0;
        let rotatedDirection = new THREE.Vector3();
        let currentDirection = new THREE.Vector3();
        let tempVec          = new THREE.Vector3();
        let tempRot          = new THREE.Quaternion();
        for (let j = 0; j < this.controlPoints.length; j++) {
            if (this.deformerParams['Solve Rotation'] && this.controlPoints.length > 1) {
                for (let iteration = 0; iteration < iters; iteration++) {
                    omegaNumerator.set(0, 0, 0); omegaDenominator = 0;
                    for (let k = 0; k < this.controlPoints.length; k++) {
                        if (j != k) {
                            rotatedDirection.copy(this.bindPoints[k].position).sub(this.bindPoints[j].position).normalize().applyQuaternion(this.controlPoints[j].quaternion);
                            currentDirection.copy(this.controlPoints[k].position).sub(this.controlPoints[j].position).normalize();
                            omegaNumerator.add(tempVec.copy(rotatedDirection).cross(currentDirection));
                            omegaDenominator += rotatedDirection.dot(currentDirection);
                        }
                    }
                    let omega = omegaNumerator.divideScalar(Math.abs(omegaDenominator + 0.0000001));
                    let w = omega.length();
                    if (w < 0.000000001) { break; }
                    this.controlPoints[j].quaternion.multiplyQuaternions(tempRot.setFromAxisAngle(omega.normalize(), w), this.controlPoints[j].quaternion);
                    //controlPointRotations[j] = Quaternion.Lerp(controlPointRotations[j], controlPointRotations[j], 1f); //Normalizes the Quaternion
                }
            } else {
                this.controlPoints[j].quaternion.set(0, 0, 0, 1);
            }
        }
    }

}
