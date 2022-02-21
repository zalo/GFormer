import {
	BufferGeometry,
	Euler,
	Float32BufferAttribute,
	Group,
	LineBasicMaterial,
	LineDashedMaterial,
	LineSegments,
} from 'three';

/**
 * GCodeLoader is used to load gcode files usually used for 3D printing or CNC applications.
 * Gcode files are composed by commands used by machines to create objects.
 * @class GCodeLoader
 */
class GCodeLoader {
    constructor() {
        this.splitLayer = false;
        this.layers = [];
        this.state = { x: 0, y: 0, z: 0, e: 0, f: 0, extruding: false, relative: false };
        this.currentLayer = undefined;
        this.pathMaterial = new LineDashedMaterial({ color: 0xff2200, dashSize: 0.2, gapSize: 1 });
        this.extrudingMaterial = new LineBasicMaterial({ color: 0x00FF00 });
        this.pathMaterial.name = 'path';
        this.extrudingMaterial.name = 'extruded';
    }

    addObject(vertices, extruding, i) {
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
        const segments = new LineSegments(geometry, extruding ? this.extrudingMaterial : this.pathMaterial);
        segments.computeLineDistances();
        segments.name = 'layer' + i + '-' + (extruding ? 'extruded' : 'path');
        this.object.add(segments);
    }

    newLayer(line) {
        this.currentLayer = { extrusionVertices: [], moveVertices: [], z: line.z };
        this.layers.push(this.currentLayer);
    }

    //Create lie segment between p1 and p2
    addSegment(p1, p2) {
        if (this.currentLayer === undefined) {
            this.newLayer(p1);
        }

        if (this.state.extruding) {
            this.currentLayer.extrusionVertices.push(p1.x, p1.y, p1.z);
            this.currentLayer.extrusionVertices.push(p2.x, p2.y, p2.z);
        } else {
            this.currentLayer.moveVertices.push(p1.x, p1.y, p1.z);
            this.currentLayer.moveVertices.push(p2.x, p2.y, p2.z);
        }

    }

    delta   (v1, v2) { return this.state.relative ? v2 : v2 - v1; }
    absolute(v1, v2) { return this.state.relative ? v1 + v2 : v2; }

    parse(data) {
        this.state = { x: 0, y: 0, z: 0, e: 0, f: 0, extruding: false, relative: false };
        this.layers = [];

        let lines = data.replace(/;.+/g, '').split('\n');
        for (let i = 0; i < lines.length; i++) {
            let tokens = lines[i].split(' ');
            let cmd = tokens[0].toUpperCase();

            //Arguments
            let args = {};
            tokens.splice(1).forEach(function (token) {
                if (token[0] !== undefined) {
                    let key = token[0].toLowerCase();
                    let value = parseFloat(token.substring(1));
                    args[key] = value;
                }
            });

            //Process commands
            //G0/G1 – Linear Movement
            if (cmd === 'G0' || cmd === 'G1') {
                let line = {
                    x: args.x !== undefined ? this.absolute(this.state.x, args.x) : this.state.x,
                    y: args.y !== undefined ? this.absolute(this.state.y, args.y) : this.state.y,
                    z: args.z !== undefined ? this.absolute(this.state.z, args.z) : this.state.z,
                    e: args.e !== undefined ? this.absolute(this.state.e, args.e) : this.state.e,
                    f: args.f !== undefined ? this.absolute(this.state.f, args.f) : this.state.f,
                };

                //Layer change detection is or made by watching Z, it's made by watching when we extrude at a new Z position
                if (this.delta(this.state.e, line.e) > 0) {
                    this.state.extruding = this.delta(this.state.e, line.e) > 0;
                    if (this.currentLayer == undefined || line.z != this.currentLayer.z) {
                        this.newLayer(line);
                    }
                }

                this.addSegment(this.state, line);
                this.state = line;
            } else if (cmd === 'G2' || cmd === 'G3') {
                //G2/G3 - Arc Movement ( G2 clock wise and G3 counter clock wise )
                //console.warn( 'THREE.GCodeLoader: Arc command not supported' );
            } else if (cmd === 'G90') {
                //G90: Set to Absolute Positioning
                this.state.relative = false;
            } else if (cmd === 'G91') {
                //G91: Set to state.relative Positioning
                this.state.relative = true;
            } else if (cmd === 'G92') {
                //G92: Set Position
                const line = this.state;
                line.x = args.x !== undefined ? args.x : line.x;
                line.y = args.y !== undefined ? args.y : line.y;
                line.z = args.z !== undefined ? args.z : line.z;
                line.e = args.e !== undefined ? args.e : line.e;
                this.state = line;
            } else {
                //console.warn( 'THREE.GCodeLoader: Command not supported:' + cmd );
            }
        }

        this.object = new Group();
        this.object.name = 'gcode';
        //if (this.splitLayer) {
        //    for (let i = 0; i < layers.length; i++) {
        //        const layer = layers[i];
        //        this.addObject(layer.extrusionVertices, true, i);
        //        this.addObject(layer.moveVertices, false, i);
        //    }
        //} else {
        const extrusionVertices = [],
              moveVertices      = [];
        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            const layerExtrusionVertices = layer.extrusionVertices;
            const layerPathVertex = layer.moveVertices;

            for (let j = 0; j < layerExtrusionVertices.length; j++) {
                extrusionVertices.push(layerExtrusionVertices[j]);
            }
            for (let j = 0; j < layerPathVertex.length; j++) {
                moveVertices.push(layerPathVertex[j]);
            }
        }

        this.addObject(extrusionVertices, true, this.layers.length);
        this.addObject(moveVertices, false, this.layers.length);
        //}

        this.object.quaternion.setFromEuler(new Euler(- Math.PI / 2, 0, 0));
        return this.object;
    }
}

export { GCodeLoader };
