//import * as THREE from '../node_modules/three/build/three.module.js';
import { GUI } from '../node_modules/three/examples/jsm/libs/lil-gui.module.min.js';
import { GCodeDeformer } from './GCodeDeformer.js';
import World from './World.js';
import { FileHandler } from './FileHandler.js';

/** The fundamental set up and animation structures for 3D Visualization */
export default class Main {

    constructor() {
        // Intercept Main Window Errors (so they are visible on Mobile)
        window.realConsoleError = console.error;
        window.addEventListener('error', (event) => {
            let path = event.filename.split("/");
            this.display((path[path.length - 1] + ":" + event.lineno + " - " + event.message));
        });
        console.error = this.fakeError.bind(this);

        // Configure Settings
        //let cpuSim = new URLSearchParams(window.location.search).get('cpu') === 'true';
        this.deformerParams = {
            'Lock Ground': true,
            'Falloff Weight': 1.25,
            'Solve Rotation': false,
            'Edit Attachment Points': false,
            'Max Steepness': 10,
            'Hide Travel Moves': true
        };

        // Construct the render world
        this.world = new World(this);
        this.deformer = new GCodeDeformer(this.world, this.deformerParams);
        this.fileHandler = new FileHandler(this.world, this.deformer.loadGCode.bind(this.deformer));

        // Set up the GUI Panel
        this.deformerParams['Load GCode'] = this.fileHandler.openFile.bind(this.fileHandler);
        this.deformerParams['Save GCode'] = this.deformer.saveGCode.bind(this.deformer);
        this.gui = new GUI();
        this.gui.add(this.deformerParams, 'Load GCode');
        this.gui.add(this.deformerParams, 'Save GCode');
        this.gui.add(this.deformerParams, 'Falloff Weight', 0.5, 5.0, 0.1).onChange(() => this.deformer.updateDeformerParams(this.deformerParams));
        this.gui.add(this.deformerParams, 'Lock Ground')                  .onChange(() => this.deformer.updateDeformerParams(this.deformerParams));
        this.gui.add(this.deformerParams, 'Solve Rotation')               .onChange(() => this.deformer.updateDeformerParams(this.deformerParams));
        // These aren't hooked up in the backend yet
        //this.gui.add(this.deformerParams, 'Max Steepness', 0.1, 30.0, 1.0).onChange(() => this.deformer.updateDeformerParams(this.deformerParams));
    }

    /** Update the simulation */
    update() {
        // Render the scene and update the framerate counter
        this.world.controls.update();
        this.deformer.update();
        this.world.renderer.render(this.world.scene, this.world.camera);
        this.world.stats.update();
    }

    // Log Errors as <div>s over the main viewport
    fakeError(...args) {
        if (args.length > 0 && args[0]) { this.display(JSON.stringify(args[0])); }
        window.realConsoleError.apply(console, arguments);
    }
    display(text) {
        let errorNode = window.document.createElement("div");
        errorNode.innerHTML = text.fontcolor("red");
        window.document.body.appendChild(errorNode);
    }

}

new Main();