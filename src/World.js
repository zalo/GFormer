import * as THREE from '../node_modules/three/build/three.module.js';
import Stats from '../node_modules/three/examples/jsm/libs/stats.module.js';
import { OrbitControls } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';

/** The fundamental set up and animation structures for 3D Visualization */
export default class World {

    constructor(mainObject) { this._setupWorld(mainObject); }

    /** **INTERNAL**: Set up a basic world */
    _setupWorld(mainObject) {
        // app container div
        this.container = document.getElementById('appbody');
        document.body.appendChild(this.container);
        
        // camera and world
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.01, 1000 );
        this.camera.position.set( 0.0, 1, 4 );
        this.camera.layers.enableAll();
        this.scene.add(this.camera);

        this.backgroundColor  = 0x222222; //0xa0a0a0
        this.scene.background = new THREE.Color(this.backgroundColor);          
        this.scene.fog        = new THREE.Fog  (this.backgroundColor, 4, 10);

        // Create two lights to evenly illuminate the model and cast shadows
        this.light  = new THREE.HemisphereLight (0xffffff, 0x444444);
        this.light .position.set(0, 200, 0);
        this.light2 = new THREE.DirectionalLight(0xbbbbbb);
        this.light2.position.set(6, 50, -12);
        this.light2.castShadow = true;
        this.light2.shadow.camera.top      =  2;
        this.light2.shadow.camera.bottom   = -2;
        this.light2.shadow.camera.left     = -2;
        this.light2.shadow.camera.right    =  2;
        //this.light2.shadow.radius        =  32;
        this.light2.shadow.mapSize.width   =  128;
        this.light2.shadow.mapSize.height  =  128;
        this.scene.add(this.light);
        this.scene.add(this.light2);
        //this.renderer.shadowMap.enabled    = true;
        //this.renderer.shadowMap.type       = THREE.PCFSoftShadowMap;
        //this.scene.add(new THREE.CameraHelper(this.light2.shadow.camera));

        // Create the ground mesh
        this.groundMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(20, 20),
        new THREE.MeshPhongMaterial({
            color: 0x080808, depthWrite: true, dithering: true,
            polygonOffset: true, // Push the mesh back for line drawing
            polygonOffsetFactor: 6.0, polygonOffsetUnits: 1.0
        }));
        this.groundMesh.position.y = -0.01;
        this.groundMesh.rotation.x = - Math.PI / 2;
        this.groundMesh.receiveShadow = true;
        this.scene.add(this.groundMesh);

        // Create the Ground Grid; one line every 100 units
        this.grid = new THREE.GridHelper(20, 20, 0xcccccc, 0xcccccc);
        this.grid.position.y = -0.01;
        this.grid.material.opacity = 0.3;
        this.grid.material.transparent = true;
        this.scene.add(this.grid);

        // renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true } ); //, alpha: true
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);
        this.renderer.setAnimationLoop(mainObject.update.bind(mainObject));
        this.renderer.setClearColor( 0x35363e, 0 ); // the default
        window.addEventListener('resize', this._onWindowResize.bind(this), false);
        window.addEventListener('orientationchange', this._onWindowResize.bind(this), false);
        this._onWindowResize();

        this.draggableObjects = [];
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 1, 0);
        this.controls.panSpeed = 2;
        this.controls.zoomSpeed = 1;
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.10;
        this.controls.screenSpacePanning = true;
        this.controls.update();
        this.controls.addEventListener('change', () => this.viewDirty = true);

        // raycaster
        this.raycaster = new THREE.Raycaster();
        this.raycaster.layers.set(0);

        // stats
        this.stats = new Stats();
        this.stats.dom.style.transform = "scale(0.7);";
        this.container.appendChild(this.stats.dom);

        // Temp variables to reduce allocations
        this.mat  = new THREE.Matrix4();
        this.vec = new THREE.Vector3();
        this.zVec = new THREE.Vector3(0, 0, 1);
        this.quat = new THREE.Quaternion().identity();
        this.color = new THREE.Color();

    }

    /** **INTERNAL**: This function recalculates the viewport based on the new window size. */
    _onWindowResize() {
        let width = window.innerWidth, height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

}