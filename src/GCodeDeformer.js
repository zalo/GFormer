import * as THREE from '../node_modules/three/build/three.module.js';
import { GCodeLoader } from './GCodeLoader.js';
import World from './World.js';
import { BenchyGCode } from './BenchyGCode.js';
import { Deformer } from './Deformer.js';

/** The fundamental set up and animation structures for 3D Visualization */
export class GCodeDeformer {

    /** @param {World} world */
    constructor(world, deformerParams) {
        /** @type {World} */
        this.world = world;
        this.deformerParams = deformerParams;
        this.loader = new GCodeLoader();
        this.gcodeObject = null;

        // Setup deformer state
        /** @type {THREE.Mesh[]} */
        this.bindPoints      = [];
        /** @type {THREE.Mesh[]} */
        this.controlPoints   = [];
        this.pointGeometry   = new THREE.SphereGeometry( 0.05 );
        this.bindMaterial    = new THREE.MeshBasicMaterial( { color: 0x888888 } );
        this.controlMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });

        // State Variables for the Selection Cursor
        this.currentlyDragging = false;
        this.pointer   = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Line.threshold = 0.5;
        this.cursorGeometry = new THREE.SphereGeometry( 0.025 );
        this.cursorMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
        this.cursor = new THREE.Mesh( this.cursorGeometry, this.cursorMaterial );
        this.cursor.visible = false;
        this.world.scene.add(this.cursor);

        // State Variables for the Dragging Cursor
        /** @type {THREE.Mesh} */
        this.draggingPoint = null;
        /** @type {THREE.Vector3} */
        this.draggingPosition = new THREE.Vector3();
        this.draggingDepth = 0;

        // Load GCode
        this.loadGCode(BenchyGCode);

        // Add Interaction Listeners
        this.world.renderer.domElement.addEventListener('pointermove', this.onPointerMove.bind(this));
        this.world.renderer.domElement.addEventListener('pointerdown', this.onPointerDown.bind(this));
        this.world.renderer.domElement.addEventListener('pointerup'  , this.onPointerUp  .bind(this));
        
        document.onkeydown = this.saveGCode.bind(this);
    }

    loadGCode(gcode) {
        this.currentGCode = gcode;
        if (this.gcodeObject) { this.world.scene.remove(this.gcodeObject); }
        this.gcodeObject = this.loader.parse(gcode);
        this.gcodeObject.position.set(-5, 0, 5);
        this.gcodeObject.scale.set(0.05, 0.05, 0.05);
        this.world.scene.add(this.gcodeObject);
        
        console.log(this.bindPoints, this.controlPoints)
        this.deformer = new Deformer(this.world, this.gcodeObject, this.deformerParams, this.bindPoints, this.controlPoints);
        this.deformer.gcodeObject = this.gcodeObject;
    }

    updateDeformerParams() {
        this.deformer.initializeWeights(this.deformerParams, this.bindPoints, this.controlPoints);
    }

    addPoint(intersection) {
        // Derive resting point from index:
        let bindPos = new THREE.Vector3().fromArray(this.deformer.restingPositions, intersection.index * 3);
        this.gcodeObject.localToWorld(bindPos);

        let bindPoint = new THREE.Mesh(this.pointGeometry, this.bindMaterial);
        bindPoint.position.copy(bindPos);
        this.world.scene.add(bindPoint);
        this.bindPoints.push(bindPoint);
        bindPoint.isBindPoint = true;

        let controlPoint = new THREE.Mesh(this.pointGeometry, this.controlMaterial);
        controlPoint.position.copy(intersection.point);
        this.world.scene.add(controlPoint);
        this.controlPoints.push(controlPoint);
        controlPoint.isBindPoint = false;

        // This will let us delete these too
        bindPoint.sibling = controlPoint;
        controlPoint.sibling = bindPoint;

        this.draggingPoint = controlPoint;
        this.draggingPosition.copy(this.draggingPoint.position).project(this.world.camera);
        this.draggingDepth = this.draggingPosition.z;

        this.deformer.initializeWeights(this.deformerParams, this.bindPoints, this.controlPoints);
    }

    onPointerMove( event ) {
        this.pointer.x =   ( event.clientX / window.innerWidth  ) * 2 - 1;
        this.pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
        
        // Move the point around if we're dragging
        if (this.currentlyDragging) {
            this.draggingPoint.position.x = this.pointer.x;
            this.draggingPoint.position.y = this.pointer.y;
            this.draggingPoint.position.z = this.draggingDepth;
            this.draggingPoint.position.unproject(this.world.camera);

            this.deformer.updateDeformation();
        }
    }
    onPointerDown(event) {
        let object = this.raycastPoints();
        if (object) {
            if (event.button === 0) {
                this.currentlyDragging = true;
                this.world.controls.enabled = false;
                // Drag this point in camera space
                this.draggingPoint = object;
                this.draggingPosition.copy(this.draggingPoint.position).project(this.world.camera);
                this.draggingDepth = this.draggingPosition.z;
            } else {
                // Delete this point
                this.world.scene.remove(object.sibling);
                this.world.scene.remove(object);
                // Remove point from lists
                if (object.isBindPoint) {
                    this.bindPoints = this.arrayRemove(this.bindPoints, object);
                    this.controlPoints = this.arrayRemove(this.controlPoints, object.sibling);
                } else {
                    this.bindPoints = this.arrayRemove(this.bindPoints, object.sibling);
                    this.controlPoints = this.arrayRemove(this.controlPoints, object);
                }
                this.deformer.initializeWeights(this.deformerParams, this.bindPoints, this.controlPoints);
                this.deformer.updateDeformation();
            }
        } else {
            let currentIntersection = this.raycastGCode();
            if (currentIntersection && event.button === 0) {
                event.preventDefault();
                this.currentlyDragging = true;
                this.world.controls.enabled = false;
                this.addPoint(currentIntersection);
            } else {
                this.currentlyDragging = false;
                this.world.controls.enabled = true;
            }
        }
    }
    onPointerUp(event) {
        this.currentlyDragging = false;
        //this.draggingPoint = null;
        this.world.controls.enabled = true;
    }

    raycastPoints() {
        this.cursor.visible = false;
        this.world.camera.updateMatrixWorld();
        this.raycaster.setFromCamera(this.pointer, this.world.camera);
        let intersects = this.raycaster.intersectObjects( this.controlPoints, true );
        if ( intersects.length > 0 ) { return intersects[0].object; }
        intersects = this.raycaster.intersectObjects( this.bindPoints, true );
        if ( intersects.length > 0 ) { return intersects[0].object; }
        return null;
    }

    raycastGCode() {
        this.world.camera.updateMatrixWorld();
        this.raycaster.setFromCamera( this.pointer, this.world.camera );
        const intersects = this.raycaster.intersectObjects( [this.gcodeObject.children[0]], true );

        if ( intersects.length > 0 ) {
            this.cursor.visible = true;
            this.cursor.position.copy(intersects[0].point);
            return intersects[0];
        } else {
            this.cursor.visible = false;
        }
        return null;
    }

    arrayRemove(arr, value) { 
        return arr.filter(function(ele){ 
            return ele !== value; 
        });
    }

    async saveGCode(e) {
        // Save the GCode on Ctrl+S
        if (String.fromCharCode(e.keyCode).toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();

            // Create the deformed GCode
            let deformedGCode = this.loader.deform(this.currentGCode, this.deformer);

            // Get the File Handle from the Save File Dialog
            let options = {
                types: [{
                        description: "Warped GCode",
                        accept: {
                            ['application/gcode']: ['.gcode'],
                        }}]};
            let fileHandle = await window.showSaveFilePicker(options);

            // Create a FileSystemWritableFileStream to write to.
            let writable = await fileHandle.createWritable();
            // Write the contents of the file to the stream.
            await writable.write(deformedGCode);
            // Close the file and write the contents to disk.
            await writable.close();

            console.log("Saved GCode to " + fileHandle.name);
        }
    }

    update() { this.raycastGCode(); }
}
