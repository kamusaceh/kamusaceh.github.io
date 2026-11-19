import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";

const viewport = document.querySelector("#viewport");
const loading = document.querySelector("#loading");
const countLabel = document.querySelector("#building-count");
const modeLabel = document.querySelector("#mode-label");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8cbd8);
scene.fog = new THREE.Fog(0xa8cbd8, 100, 260);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 600);
camera.position.set(42, 38, 48);

const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 12;
controls.maxDistance = 190;

scene.add(new THREE.HemisphereLight(0xe7f6ff, 0x65765c, 2));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
sun.position.set(35, 70, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left = -100; sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100; sun.shadow.camera.bottom = -100;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(220,220),
  new THREE.MeshStandardMaterial({color:0x78966f, roughness:1})
);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
ground.name = "ground";
scene.add(ground);

const grid = new THREE.GridHelper(220,110,0x526f62,0x6d876e);
grid.position.y = 0.025;
scene.add(grid);

// Jalan dasar membentuk jaringan blok sederhana.
const roadMat = new THREE.MeshStandardMaterial({color:0x39464b, roughness:1});
function road(x,z,w,d){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,.08,d),roadMat);
  m.position.set(x,.045,z); m.receiveShadow=true; scene.add(m);
}
for(let p=-90;p<=90;p+=30){road(p,0,7,200);road(0,p,200,7)}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const objects = [];
let selected = "house";
let removeMode = false;

const palette = {
  house:{label:"Rumah",color:0xe7c7a0,height:5,width:7,depth:7},
  office:{label:"Kantor",color:0x8aaec0,height:15,width:9,depth:9},
  tower:{label:"Menara",color:0x6f8fa7,height:30,width:8,depth:8},
  park:{label:"Taman",color:0x4d9b62,height:1,width:11,depth:11}
};

function addBuilding(kind,x,z){
  const spec=palette[kind];
  const group=new THREE.Group();
  group.position.set(x,0,z);
  const base=new THREE.Mesh(
    new THREE.BoxGeometry(spec.width,spec.height,spec.depth),
    new THREE.MeshStandardMaterial({color:spec.color,roughness:.82})
  );
  base.position.y=spec.height/2;
  base.castShadow=true;base.receiveShadow=true;group.add(base);
  const details=new THREE.Group();
  if(kind!=="park"){
    const floors=Math.max(1,Math.floor(spec.height/3));
    for(let f=0;f<floors;f++){
      for(let side=-1;side<=1;side+=2){
        const win=new THREE.Mesh(
          new THREE.BoxGeometry(spec.width*.12,.65,.08),
          new THREE.MeshStandardMaterial({color:0xc9e5e8,emissive:0x233c43})
        );
        win.position.set(side*spec.width*.28,1.3+f*2.6,spec.depth/2+.045);
        details.add(win);
      }
    }
    const roof=new THREE.Mesh(new THREE.BoxGeometry(spec.width*.72,.35,spec.depth*.72),new THREE.MeshStandardMaterial({color:0x46535b}));
    roof.position.y=spec.height+.18;details.add(roof);
  }else{
    for(let i=0;i<5;i++){
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.16,.22,1.5,6),new THREE.MeshStandardMaterial({color:0x75553b}));
      trunk.position.set((i-2)*1.8,.75,(i%2?1:-1)*2);details.add(trunk);
      const crown=new THREE.Mesh(new THREE.SphereGeometry(1.15,8,6),new THREE.MeshStandardMaterial({color:0x2f7549}));
      crown.position.set((i-2)*1.8,2,(i%2?1:-1)*2);crown.castShadow=true;details.add(crown);
    }
  }
  group.add(details);
  group.userData={kind,details};
  scene.add(group);objects.push(group);
  updateCount();
}

function updateCount(){countLabel.textContent=objects.length+" objek dibangun"}

function placeAtPointer(event){
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.x=((event.clientX-rect.left)/rect.width)*2-1;
  pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObject(ground);
  if(!hits.length)return;
  const point=hits[0].point;
  const x=Math.round(point.x/5)*5,z=Math.round(point.z/5)*5;
  if(removeMode){
    let nearest=null,best=9;
    for(const obj of objects){const d=obj.position.distanceTo(new THREE.Vector3(x,0,z));if(d<best){best=d;nearest=obj}}
    if(nearest){scene.remove(nearest);objects.splice(objects.indexOf(nearest),1);updateCount()}
  }else{
    addBuilding(selected,x,z);
  }
}

renderer.domElement.addEventListener("pointerdown",event=>{
  if(event.button!==0)return;
  if(controls.enabled && event.target===renderer.domElement) placeAtPointer(event);
});

document.querySelectorAll("[data-kind]").forEach(button=>{
  button.addEventListener("click",()=>{
    selected=button.dataset.kind;removeMode=false;
    document.querySelectorAll(".tool").forEach(b=>b.classList.remove("active"));
    button.classList.add("active");modeLabel.textContent=palette[selected].label;
  });
});
document.querySelector("#remove").addEventListener("click",()=>{
  removeMode=true;document.querySelectorAll(".tool").forEach(b=>b.classList.remove("active"));
  document.querySelector("#remove").classList.add("active");modeLabel.textContent="Hapus objek";
});

function resize(){
  const w=viewport.clientWidth,h=viewport.clientHeight;
  camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);
}
new ResizeObserver(resize).observe(viewport);resize();

function animate(){
  requestAnimationFrame(animate);
  controls.update();
  // LOD sederhana: detail kecil hanya dirender saat kamera cukup dekat.
  for(const obj of objects){
    const distance=camera.position.distanceTo(obj.position);
    obj.userData.details.visible=distance<95;
  }
  renderer.render(scene,camera);
}
animate();
loading.classList.add("hidden");
