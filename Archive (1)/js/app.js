import * as THREE from "three/webgpu";

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui'; 
import getMaterial from './getMaterial.js';


const range = (min,max) => Math.random() * (max - min) + min;

export default class Sketch {
  constructor(options) {
    this.scene = new THREE.Scene();

    this.container = options.dom;
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer = new THREE.WebGPURenderer();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0x000000, 1); 

    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      70,
      this.width / this.height,
      0.01,
      1000
    );

    // let frustumSize = 10;
    // let aspect = this.width / this.height;
    // this.camera = new THREE.OrthographicCamera( frustumSize * aspect / - 2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / - 2, -1000, 1000 );
    this.camera.position.set(0, 0, 3.8);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.time = 0;

    
    this.isPlaying = true;
    // this.createASCIITexture();
    this.anotherScene();
    this.addObjects();
    
    this.resize();
    this.render();
    this.setupResize();
    // this.setUpSettings();
  }

  anotherScene(){
    this.scene2 = new THREE.Scene();
    this.camera2 = new THREE.PerspectiveCamera(70, this.width / this.height, 0.01, 1000);
    this.camera2.position.set(0, 0, 5.8);
    this.renderTarget = new THREE.RenderTarget(this.width, this.height);
    

    let num = 50
    this.cubes = []
    for(let i = 0; i < num; i++){
      let size = range(0.5,0.9);
      let mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size,size,size), 
        new THREE.MeshPhysicalMaterial({color:0xffffff}));
      mesh.position.set(range(-3,3),range(-3,3),range(-3,3));
      mesh.rotation.set(range(0,Math.PI),range(0,Math.PI),range(0,Math.PI));
      this.scene2.add(mesh);
      this.cubes.push(mesh);
    }

    this.addLights(this.scene2);

  }

  createASCIITexture(){
    let dict = "`.-':_,^=;><+!rc*/z?sLTv)J7(|Fi{C}fI31tlu[neoZ5Yxjya]2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@"
    this.length = dict.length;
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');
    // document.body.appendChild(canvas);
    canvas.width = this.length*64;
    canvas.height = 64;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = "bold 40px Menlo";
    ctx.textAlign = "center";

    for(let i = 0; i < this.length; i++){

      if(i>50){
        for(let j = 0; j < 3; j++){
          ctx.filter = `blur(${j*3}px)`;
          ctx.fillText(dict[i], 32 + i*64, 46);
        }
      }
      ctx.filter = 'none';
      ctx.fillText(dict[i], 32 + i*64, 46);
    }


    let asciiTexture = new THREE.Texture(canvas);
    asciiTexture.needsUpdate = true;
    return asciiTexture;
    
  }

  setUpSettings() {
    this.settings = {
      progress: 0,
    };
    this.gui = new GUI();
    this.gui.add(this.settings, "progress", 0, 1, 0.01).onChange((val)=>{})
  }

  setupResize() {
    window.addEventListener("resize", this.resize.bind(this));
  }

  resize() {
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  addObjects() {
    this.material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      wireframe: true,
    });
    this.material = getMaterial({
      asciiTexture: this.createASCIITexture(),
      customLength: this.length,
      scene: this.renderTarget.texture
    });
    let rows = 50;
    let columns = Math.floor(rows);
    let instances = rows * columns;
    let size = 0.1;
    this.geometry = new THREE.PlaneGeometry(size, size, 1, 1);

    this.positions = new Float32Array(instances * 3);
    this.colors = new Float32Array(instances * 3);
    let uv = new Float32Array(instances * 2);
    let random = new Float32Array(instances );
    this.instancedMesh = new THREE.InstancedMesh(this.geometry, this.material, instances);

    let index = 0
    for(let i = 0; i < rows; i++){
      for(let j = 0; j < columns; j++){
        let index = (i * columns) + j;
        uv[index * 2] = i / (rows - 1);
        random[index] =Math.pow(Math.random(),4);
        uv[index * 2 + 1] = j / (columns - 1);
        this.positions[index * 3] = i * size - size*(rows - 1) / 2;
        this.positions[index * 3 + 1] = j * size - size*(columns - 1) / 2;
        this.positions[index * 3 + 2] = 0;
        let m = new THREE.Matrix4();
        m.setPosition(this.positions[index * 3], this.positions[index * 3 + 1], this.positions[index * 3 + 2]);
        // this.instancedMesh.setMatrixAt(index, m);
        index++;
      }
    }
    // this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.geometry.setAttribute('aPosition', new THREE.InstancedBufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aPixelUV', new THREE.InstancedBufferAttribute(uv, 2));
    this.geometry.setAttribute('aRandom', new THREE.InstancedBufferAttribute(random, 1));
    

    
    this.scene.add(this.instancedMesh);
  }

  addLights(scene) {
    const light1 = new THREE.AmbientLight(0xffffff, 0.05);
    scene.add(light1);

    const light2 = new THREE.DirectionalLight(0xffffff, 2.5);
    light2.position.set(1, 0, 0.866); // ~60º
    scene.add(light2);
  }

  render() {
    if (!this.isPlaying) return;
    this.time += 0.005;
    this.cubes.forEach((cube,i) => {
      cube.rotation.x = Math.sin(this.time * cube.position.x);
      cube.rotation.y = Math.sin(this.time * cube.position.y);
      cube.rotation.z = Math.sin(this.time * cube.position.z);
      cube.position.y = 3*Math.sin(this.time  + i);
    });
    requestAnimationFrame(this.render.bind(this));
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.renderAsync(this.scene2, this.camera2);
    this.renderer.setRenderTarget(null);
    this.renderer.renderAsync(this.scene, this.camera);
  }
}

new Sketch({
  dom: document.getElementById("container")
});
