<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useNetworkStatus } from '@/composables/useNetworkStatus';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass';
import { Line2 } from 'three/examples/jsm/lines/Line2';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry';
import { IonButton, IonList, IonItem, IonLabel, IonCheckbox, IonIcon } from '@ionic/vue';
import { addCircleSharp, chevronDownOutline, chevronUpOutline } from 'ionicons/icons';

const { networkStatus, peersStatus, currentMode, peerStatuses, peersList, enabledPeer, addPeer, removePeer, enablePeer, disablePeer } = useNetworkStatus();

const newPeerUrl = ref('');
const selectedPeer = ref<string | null>(null);
const showRelayList = ref(false);
let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controls: OrbitControls, composer: EffectComposer;
let stars: THREE.Mesh[] = [], lines: Line2[] = [], starRings: THREE.Mesh[] = [], particles: THREE.Mesh[] = [];
let starPositions: THREE.Vector3[] = [];
let outlinePass: OutlinePass;

onMounted(() => {
  initThreeJS();
  updateStars();
  animate();
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
});

function initThreeJS() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.getElementById('three-container')!.appendChild(renderer.domElement);

  camera.position.set(0, 5, 25);
  camera.lookAt(0, 0, 0);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const ambientLight = new THREE.AmbientLight(0x404040);
  scene.add(ambientLight);
  const pointLight = new THREE.PointLight(0xffffff, 1, 100);
  pointLight.position.set(5, 5, 5);
  scene.add(pointLight);

  composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.0, 0.4, 0.85);
  composer.addPass(bloomPass);

  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
  composer.addPass(fxaaPass);

  const filmPass = new FilmPass(0.35);
  composer.addPass(filmPass);

  outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
  outlinePass.edgeStrength = 3.0;
  outlinePass.edgeGlow = 1.0;
  outlinePass.edgeThickness = 2.0;
  outlinePass.visibleEdgeColor.set(0x00ccff);
  composer.addPass(outlinePass);

  addParticles();

  window.addEventListener('resize', onResize);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

function addParticles() {
  const particleCount = 1000;
  for (let i = 0; i < particleCount; i++) {
    const size = Math.random() * 0.2 + 0.1;
    const geometry = new THREE.SphereGeometry(size, 16, 16);
    const material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, brightness: { value: Math.random() * 0.5 + 0.5 } },
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float brightness;
        varying vec3 vPosition;
        void main() {
          float dist = length(vPosition);
          float glow = exp(-dist * 5.0) * brightness;
          vec3 color = vec3(0.8, 0.9, 1.0);
          gl_FragColor = vec4(color * glow, glow);
        }
      `,
      transparent: true,
    });
    const particle = new THREE.Mesh(geometry, material);
    particle.position.set(
      (Math.random() - 0.5) * 50,
      (Math.random() - 0.5) * 50,
      (Math.random() - 0.5) * 50
    );
    particle.userData = {
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
      ),
    };
    scene.add(particle);
    particles.push(particle);
  }
}

function createStar(peer: string, index: number) {
  const geometry = new THREE.IcosahedronGeometry(0.8, 4); 
  geometry.computeVertexNormals();
  const material = new THREE.ShaderMaterial({
    vertexShader: `
      uniform float time;
      varying vec3 vPosition;
      varying float vNoise;
      void main() {
        vPosition = position;
        vNoise = sin(position.x * 10.0 + time) * 0.5;
        vec3 newPosition = position + normal * vNoise;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color1;
      uniform vec3 color2;
      uniform vec3 color3;
      varying float vNoise;
      void main() {
        vec3 color = mix(color1, color2, vNoise);
        color = mix(color, color3, abs(sin(vNoise * 2.0)));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    uniforms: {
      time: { value: 0 },
      color1: { value: new THREE.Color(0x20e6df) }, 
      color2: { value: new THREE.Color(0xaf2ab8) },
      color3: { value: new THREE.Color(0x6d274f) },
    },
    side: THREE.DoubleSide,
  });
  const star = new THREE.Mesh(geometry, material);
  const pos = new THREE.Vector3(
    (Math.random() - 0.5) * 10,
    (Math.random() - 0.5) * 10,
    (Math.random() - 0.5) * 10
  );
  star.position.set(0, 10, 0);
  star.userData = { peer, targetPos: pos, originalColor: material.uniforms.color1.value.clone() };
  scene.add(star);
  stars.push(star);
  starPositions.push(pos);

  if (enabledPeer.value === peer) {
    const ringGeometry = new THREE.RingGeometry(1.2, 1.5, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x00ccff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    star.add(ring);
    starRings.push(ring);
  }
}

function updateLines() {
  lines.forEach(line => scene.remove(line));
  lines = [];
  for (let i = 1; i < stars.length; i++) {
    const geometry = new LineGeometry();
    const positions = [
      stars[i - 1].position.x, stars[i - 1].position.y, stars[i - 1].position.z,
      stars[i].position.x, stars[i].position.y, stars[i].position.z
    ];
    geometry.setPositions(positions);
    const material = new LineMaterial({
      color: 0x00ccff,
      linewidth: 0.01, 
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
      transparent: true,
      opacity: 0.7,
    });
    const line = new Line2(geometry, material);
    scene.add(line);
    lines.push(line);
  }
}

function updateStars() {
  stars.forEach(star => scene.remove(star));
  starRings = [];
  stars = [];
  starPositions = [];
  peersList.value.forEach((peer, index) => createStar(peer, index));
  updateLines();
}

function animateStarColor(star: THREE.Mesh) {
  const material = star.material as THREE.ShaderMaterial;
  const originalColor = star.userData.originalColor;
  let t = 0;

  const animate = () => {
    t += 0.05;
    if (t <= 1) {
      material.uniforms.color1.value.lerpColors(originalColor, new THREE.Color(0xffffff), t);
      requestAnimationFrame(animate);
    } else if (t <= 2) {
      material.uniforms.color1.value.lerpColors(new THREE.Color(0xffffff), originalColor, t - 1);
      requestAnimationFrame(animate);
    }
  };
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  stars.forEach(star => {
    const target = star.userData.targetPos;
    star.position.lerp(target, 0.05);
    star.position.y += Math.sin(Date.now() * 0.001) * 0.01;
    const material = star.material as THREE.ShaderMaterial;
    material.uniforms.time.value += 0.05;
  });
  starRings.forEach(ring => {
    ring.rotation.z += 0.02;
  });
  particles.forEach(particle => {
    particle.position.add(particle.userData.velocity);
    const material = particle.material as THREE.ShaderMaterial;
    material.uniforms.time.value += 0.05;
    if (particle.position.length() > 50) {
      particle.position.set(
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 50
      );
    }
  });
  updateLines();

  outlinePass.selectedObjects = selectedPeer.value ? stars.filter(s => s.userData.peer === selectedPeer.value) : [];

  controls.update();
  composer.render();
}

function handleAddPeer(url: string) {
  addPeer(url);
  updateStars();
  newPeerUrl.value = '';
}

function onClick(event: MouseEvent) {
  event.preventDefault();
  controls.enabled = false;

  const raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 0.1;
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(stars, false);

  console.log('Mouse position:', mouse);
  console.log('Stars in scene:', stars.length);
  console.log('Star positions:', stars.map(s => ({ peer: s.userData.peer, pos: s.position })));

  if (intersects.length > 0) {
    const obj = intersects[0].object as THREE.Mesh;
    console.log('Intersected star:', obj.userData.peer, 'at', obj.position);
    animateStarColor(obj);
    selectedPeer.value = obj.userData.peer;
  } else {
    console.log('No intersection');
    selectedPeer.value = null;
  }

  setTimeout(() => controls.enabled = true, 100);
}

function togglePeer(peer: string) {
  enabledPeer.value === peer ? disablePeer() : enablePeer(peer);
  updateStars();
}

function deletePeer(peer: string) {
  removePeer(peer);
  updateStars();
  selectedPeer.value = null;
}

function selectPeer(peer: string) {
  selectedPeer.value = peer;
}
</script>

<template>
  <div class="container" @click="onClick">
    <div id="three-container" class="three-container"></div>
    
    <!-- 网络状态 -->
    <div class="status-bar">
      <div class="status-item" :class="networkStatus">
        Net: {{ networkStatus === 'online' ? 'Online' : 'Offline' }}
      </div>
      <div class="status-item" :class="peersStatus">
        Node: {{ peersStatus === 'connected' ? 'Connected' : 'Disconnected' }}
      </div>
      <div class="status-item" :class="currentMode">
        Mode: {{ currentMode === 'relay' ? 'Relay' : 'E2E' }}
      </div>
    </div>

  
    <div class="add-peer-input">
      <input v-model="newPeerUrl" placeholder="Relay URL" @keyup.enter="handleAddPeer(newPeerUrl)" />
      <ion-icon :icon="addCircleSharp" class="add-icon" @click="handleAddPeer(newPeerUrl)" />
    </div>

    <!-- 当前连接地址 -->
    <div class="enabled-peer">
      <strong>Connected:</strong> {{ enabledPeer || 'None' }}
    </div>

    <!-- Relay列表按钮 -->
    <ion-button class="relay-list-toggle" @click.stop="showRelayList = !showRelayList">
      <ion-icon :icon="showRelayList ? chevronUpOutline : chevronDownOutline" slot="start" />
      Relays
    </ion-button>

    <!-- Relay列表 -->
    <ion-list v-if="showRelayList" class="relay-list">
      <ion-item v-for="peer in peersList" :key="peer" @click.stop="selectPeer(peer)">
        <ion-label>{{ peer }}</ion-label>
        <ion-checkbox slot="end" :checked="enabledPeer === peer" @ionChange="togglePeer(peer)" />
        <ion-button slot="end" color="danger" @click.stop="deletePeer(peer)">Delete</ion-button>
      </ion-item>
    </ion-list>

  
    <div v-if="selectedPeer" class="info-card">
      <h3>Relay Details</h3>
      <p><strong>URL:</strong> {{ selectedPeer }}</p>
      <p><strong>Status:</strong> {{ peerStatuses[selectedPeer] || 'checking' }}</p>
      <div class="controls">
        <label>
          <input type="checkbox" :checked="enabledPeer === selectedPeer" @change="togglePeer(selectedPeer)" />
          Enable
        </label>
        <button @click="deletePeer(selectedPeer)">Delete</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: radial-gradient(circle, #1a1a2e, #0f0f1a);
}

.three-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.status-bar {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 10px;
  z-index: 1;
}

.status-item {
  padding: 5px 10px;
  border-radius: 8px;
  color: white;
  font-size: 14px;
  background: rgba(0, 0, 0, 0.5);
}

.status-item.online,
.status-item.connected,
.status-item.relay {
  background: linear-gradient(45deg, #00ff00, #66ffcc);
  color: #333;
}

.status-item.offline,
.status-item.disconnected,
.status-item.e2e {
  background: linear-gradient(45deg, #ff0000, #ff6666);
}

.add-peer-input {
  position: absolute;
  top: 50px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 15px;
  z-index: 1;
  pointer-events: auto;
}

.add-peer-input input {
  padding: 10px;
  border: none;
  border-radius: 15px;
  background: rgba(134, 134, 134, 0.25);
  font-size: 14px;
  width: 300px;
  box-shadow: 0 0 15px rgba(0, 204, 255, 0.5);
  animation: breathe 2s infinite ease-in-out;
}

.add-icon {
  font-size: 39px;
  color: #00ccff;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.add-icon:hover {
  transform: scale(1.1);
}

.enabled-peer {
  position: absolute;
  bottom: 10px;
  left: 10px;
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 5px;
  color: #333;
  z-index: 1;
}

.relay-list-toggle {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
}

.relay-list {
  position: absolute;
  top: 50px;
  right: 10px;
  width: 300px;
  max-height: 400px;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 10px;
  z-index: 1;
}

.info-card {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.9);
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
  z-index: 1;
  width: 300px;
  color: #333;
}

.info-card h3 {
  margin: 0 0 10px;
  font-size: 18px;
}

.info-card p {
  margin: 5px 0;
}

.controls {
  display: flex;
  justify-content: space-between;
  margin-top: 15px;
}

.controls label {
  display: flex;
  align-items: center;
  gap: 5px;
}

.controls button {
  padding: 5px 10px;
  background: #ff6666;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.controls button:hover {
  background: #ff9999;
}

@keyframes breathe {
  0% { box-shadow: 0 0 10px rgba(0, 204, 255, 0.3); }
  50% { box-shadow: 0 0 20px rgba(0, 204, 255, 0.7); }
  100% { box-shadow: 0 0 10px rgba(0, 204, 255, 0.3); }
}
</style>