//import * as THREE from '../node_modules/three/build/three.module.js';
import { GUI } from '../node_modules/three/examples/jsm/libs/lil-gui.module.min.js';
import { GCodeDeformer } from './GCodeDeformer.js';
import World from './World.js';

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
            'Solve Rotation': true,
            'Edit Attachment Points': false,
            'Max Steepness': 10,
            'Hide Travel Moves': true,
        };
        this.gui = new GUI();
        this.gui.add(this.deformerParams, 'Lock Ground');
        this.gui.add(this.deformerParams, 'Solve Rotation');
        this.gui.add(this.deformerParams, 'Edit Attachment Points');
        this.gui.add(this.deformerParams, 'Max Steepness', 0.1, 30.0, 1.0);

        // Construct the render world
        this.world = new World(this);
        this.deformer = new GCodeDeformer(this.world);

        // Create the file drag and drop handler
        document.body.ondragover = (ev) => {
            ev.dataTransfer.dropEffect = 'copy';
            this.world.container.style.border = "5px solid #0af";
            ev.preventDefault();
        };
        document.body.ondragleave = (ev) => { this.world.container.style.border = "none"; }
        document.body.ondragend = (ev) => { this.world.container.style.border = "none"; }
        document.body.ondrop = (ev) => {
            console.log('File(s) dropped');
            this.world.container.border = "none";
            // Prevent default behavior (Prevent file from being opened)
            ev.preventDefault();
            // Open the file text and load the GCode
            if (ev.dataTransfer.items) {
                if (ev.dataTransfer.items[0].kind === 'file') {
                    ev.dataTransfer.items[0].getAsFile().text().then(text => this.deformer.loadGCode(text));
                }
            } else {
                ev.dataTransfer.files[0].text().then(text => this.deformer.loadGCode(text));
            }
            this.world.container.border = "none";
        };
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
        window.document.getElementById("info").appendChild(errorNode);
    }

}

new Main();