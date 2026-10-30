import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const viewer = document.getElementById('viewer');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const statusBox = document.getElementById('statusBox');
const toolbar = document.getElementById('toolbar');
const centerModelBtn = document.getElementById('centerModelBtn');
const resetViewBtn = document.getElementById('resetViewBtn');
const toggleWireframeBtn = document.getElementById('toggleWireframeBtn');
const rotateButtons = document.querySelectorAll('[data-rotate-x], [data-rotate-y]');
const scaleButtons = document.querySelectorAll('[data-scale]');
const startCameraBtn = document.getElementById('startCameraBtn');
const gestureVideo = document.getElementById('gestureVideo');
const gestureStatus = document.getElementById('gestureStatus');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070b);
scene.fog = new THREE.Fog(0x05070b, 8, 30);

const camera = new THREE.PerspectiveCamera(50, viewer.clientWidth / viewer.clientHeight, 0.1, 1000);
camera.position.set(5, 3, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewer.clientWidth, viewer.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;
controls.enableZoom = true;
controls.target.set(0, 0, 0);
controls.minDistance = 0.5;
controls.maxDistance = 80;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xcfe3ff, 1.5);
dirLight.position.set(8, 12, 6);
dirLight.castShadow = true;
scene.add(dirLight);

const grid = new THREE.GridHelper(30, 30, 0x3f5c8f, 0x1b2430);
grid.position.y = -1.5;
scene.add(grid);

const modelGroup = new THREE.Group();
scene.add(modelGroup);

let currentMesh = null;
let isWireframe = false;
const pointerMap = new Map();
let gestureCamera = null;
let handTracker = null;
let lastHandCenter = null;
let lastPinchDistance = null;
let lastPalmAngle = null;

function setGestureStatus(message) {
  gestureStatus.textContent = message;
}

function getDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getHandCenter(landmarks) {
  const sample = [0, 5, 9, 13, 17];
  const total = sample.reduce((acc, idx) => {
    acc.x += landmarks[idx].x;
    acc.y += landmarks[idx].y;
    return acc;
  }, { x: 0, y: 0 });

  return {
    x: total.x / sample.length,
    y: total.y / sample.length,
  };
}

function getPalmAngle(landmarks) {
  const wrist = landmarks[0];
  const middleBase = landmarks[9];
  return Math.atan2(middleBase.y - wrist.y, middleBase.x - wrist.x);
}

function rotateModelFromWrist(angleDelta) {
  if (!currentMesh) return;

  const viewAxis = camera.getWorldDirection(new THREE.Vector3()).normalize();
  const rotation = new THREE.Quaternion().setFromAxisAngle(viewAxis, angleDelta);
  modelGroup.quaternion.premultiply(rotation);
}

function countExtendedFingers(landmarks) {
  const tipToPip = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];

  let count = 0;

  for (const [tipIndex, pipIndex] of tipToPip) {
    if (landmarks[tipIndex].y < landmarks[pipIndex].y) {
      count += 1;
    }
  }

  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  if (thumbTip.x < thumbIp.x || thumbTip.y < thumbIp.y) {
    count += 1;
  }

  return count;
}

function tryHandleGesture(landmarks) {
  const handCenter = getHandCenter(landmarks);
  const palmAngle = getPalmAngle(landmarks);
  const fingerCount = countExtendedFingers(landmarks);
  const pinchDistance = getDistance(landmarks[4], landmarks[8]);

  if (fingerCount === 0 && pinchDistance > 0.18) {
    setGestureStatus('Fist detected: reset view');
    resetViewBtn.click();
    lastHandCenter = null;
    lastPinchDistance = null;
    lastPalmAngle = null;
    return;
  }

  if (pinchDistance < 0.12) {
    if (lastPinchDistance !== null) {
      const delta = lastPinchDistance - pinchDistance;
      zoomCamera(delta * 120);
    }
    lastPinchDistance = pinchDistance;
    setGestureStatus('Pinch: zoom');
    lastHandCenter = handCenter;
    lastPalmAngle = null;
    return;
  }

  if (fingerCount >= 3) {
    if (lastPalmAngle !== null) {
      let angleDelta = palmAngle - lastPalmAngle;
      if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
      if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
      if (Math.abs(angleDelta) > 0.015) rotateModelFromWrist(angleDelta);
    }

    if (lastHandCenter) {
      const dx = (handCenter.x - lastHandCenter.x) * 130;
      const dy = (handCenter.y - lastHandCenter.y) * 130;
      orbitCamera(dx, dy);
    }

    setGestureStatus('Open palm: move to orbit, twist wrist to rotate model');
    lastHandCenter = handCenter;
    lastPinchDistance = null;
    lastPalmAngle = palmAngle;
    return;
  }

  if (fingerCount >= 1) {
    if (lastHandCenter) {
      const dx = (handCenter.x - lastHandCenter.x) * 110;
      const dy = (handCenter.y - lastHandCenter.y) * 110;
      orbitCamera(dx, dy);
    }

    setGestureStatus('Index finger: adjust view');
    lastHandCenter = handCenter;
    lastPinchDistance = null;
    lastPalmAngle = null;
    return;
  }

  lastHandCenter = handCenter;
  lastPinchDistance = null;
  lastPalmAngle = null;
  setGestureStatus('Hand detected');
}

function handleHandResults(results) {
  if (!results.multiHandLandmarks || !results.multiHandLandmarks.length) {
    setGestureStatus('No hand detected');
    lastHandCenter = null;
    lastPinchDistance = null;
    lastPalmAngle = null;
    return;
  }

  const landmarks = results.multiHandLandmarks[0];
  tryHandleGesture(landmarks);
}

async function initializeHandTracking() {
  if (!window.Hands || !window.Camera) {
    setGestureStatus('Gesture library is still loading...');
    return;
  }

  if (!handTracker) {
    handTracker = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    handTracker.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    handTracker.onResults(handleHandResults);
  }

  if (!gestureCamera) {
    gestureCamera = new window.Camera(gestureVideo, {
      onFrame: async () => {
        if (handTracker && gestureVideo.readyState >= 2) {
          await handTracker.send({ image: gestureVideo });
        }
      },
      width: 640,
      height: 480,
    });
  }

  if (gestureCamera && typeof gestureCamera.start === 'function') {
    gestureCamera.start();
  }
}

async function startGestureCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setGestureStatus('Your browser does not support webcam hand tracking.');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });

    gestureVideo.srcObject = stream;
    gestureVideo.play();
    startCameraBtn.textContent = 'Camera on';
    startCameraBtn.disabled = true;
    setGestureStatus('Camera live. Show your hand.');
    await initializeHandTracking();
  } catch (error) {
    console.error('Failed to start camera:', error);
    setGestureStatus('Camera access blocked. Please allow webcam access.');
  }
}

function orbitCamera(dx = 0, dy = 0) {
  if (!currentMesh) return;

  const offset = camera.position.clone().sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);

  spherical.theta -= THREE.MathUtils.degToRad(dx * 0.8);
  spherical.phi -= THREE.MathUtils.degToRad(dy * 0.8);
  spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.2, Math.PI - 0.2);

  const newPosition = controls.target.clone().add(new THREE.Vector3().setFromSpherical(spherical));
  camera.position.copy(newPosition);
  controls.update();
}

function zoomCamera(delta = 0) {
  if (!currentMesh) return;

  const direction = camera.position.clone().sub(controls.target).normalize();
  const distance = camera.position.distanceTo(controls.target);
  const newDistance = Math.max(1.5, distance + delta * 0.25);
  camera.position.copy(controls.target.clone().add(direction.multiplyScalar(newDistance)));
  controls.update();
}

function updateStatus(message) {
  statusBox.textContent = message;
}

function handleFile(file) {
  if (!file) return;

  const fileName = file.name.toLowerCase();
  updateStatus(`Loading ${file.name}...`);

  if (fileName.endsWith('.obj')) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadObjectText(String(reader.result), file.name);
        updateStatus(`Loaded OBJ: ${file.name}`);
      } catch (error) {
        console.error(error);
        updateStatus(`OBJ parse failed: ${file.name}`);
      }
    };
    reader.readAsText(file);
    return;
  }

  if (fileName.endsWith('.stl')) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadStlArrayBuffer(reader.result);
        updateStatus(`Loaded STL: ${file.name}`);
      } catch (error) {
        console.error(error);
        updateStatus(`STL parse failed: ${file.name}`);
      }
    };
    reader.readAsArrayBuffer(file);
    return;
  }

  updateStatus('Unsupported file type. Please use .obj or .stl');
}

function setModelMaterial(mesh) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x9cc7ff,
    metalness: 0.25,
    roughness: 0.65,
    side: THREE.DoubleSide,
    wireframe: isWireframe,
  });

  mesh.material = material;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.traverse((child) => {
    if (child.isMesh) {
      child.material = material;
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function centerAndScale(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  mesh.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = 5 / maxDim;
  mesh.scale.setScalar(scale);

  mesh.position.set(0, 0, 0);
  focusCameraOnModel();
}

function focusCameraOnModel() {
  if (!currentMesh) return;

  const box = new THREE.Box3().setFromObject(currentMesh);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const distance = Math.max(5, maxDim * 2.2);

  camera.position.set(distance, distance * 0.7, distance);
  controls.target.set(0, 0, 0);
  controls.update();
}

function loadObjectText(text, name) {
  const loader = new OBJLoader();
  try {
    const object = loader.parse(text);
    object.name = name;

    if (currentMesh) modelGroup.remove(currentMesh);

    currentMesh = object;
    setModelMaterial(currentMesh);
    modelGroup.add(currentMesh);
    centerAndScale(currentMesh);
  } catch (error) {
    console.error('OBJ parse error:', error);
    alert('Failed to parse OBJ file.');
  }
}

function loadStlArrayBuffer(buffer) {
  const loader = new STLLoader();
  try {
    const geometry = loader.parse(buffer);
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: 0x9cc7ff,
        metalness: 0.25,
        roughness: 0.65,
        wireframe: isWireframe,
      })
    );

    if (currentMesh) modelGroup.remove(currentMesh);

    currentMesh = mesh;
    modelGroup.add(currentMesh);
    centerAndScale(currentMesh);
  } catch (error) {
    console.error('STL parse error:', error);
    alert('Failed to parse STL file.');
  }
}

fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  handleFile(file);
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.style.borderColor = 'rgba(156, 199, 255, 0.8)';
    dropZone.style.background = 'rgba(156, 199, 255, 0.08)';
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.style.borderColor = 'rgba(156, 199, 255, 0.4)';
    dropZone.style.background = 'rgba(156, 199, 255, 0.04)';
  });
});

dropZone.addEventListener('drop', (event) => {
  const file = event.dataTransfer.files[0];
  if (file) handleFile(file);
});

rotateButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const xValue = Number(button.dataset.rotateX || 0);
    const yValue = Number(button.dataset.rotateY || 0);
    orbitCamera(yValue, xValue);
  });
});

centerModelBtn.addEventListener('click', () => {
  focusCameraOnModel();
});

resetViewBtn.addEventListener('click', () => {
  camera.position.set(5, 3, 5);
  controls.target.set(0, 0, 0);
  modelGroup.quaternion.identity();
  if (currentMesh) {
    currentMesh.rotation.set(0, 0, 0);
    currentMesh.scale.set(1, 1, 1);
  }
  controls.update();
});

renderer.domElement.addEventListener('pointerdown', (event) => {
  renderer.domElement.setPointerCapture(event.pointerId);
  pointerMap.set(event.pointerId, { x: event.clientX, y: event.clientY });
});

renderer.domElement.addEventListener('pointermove', (event) => {
  if (!pointerMap.has(event.pointerId)) return;

  const previous = pointerMap.get(event.pointerId);
  const dx = event.clientX - previous.x;
  const dy = event.clientY - previous.y;
  pointerMap.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (pointerMap.size === 1) {
    orbitCamera(dx, dy);
  }

  if (pointerMap.size >= 2) {
    const points = Array.from(pointerMap.values());
    const currentDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    const previousDistance = previous.distance ?? currentDistance;
    const zoomDelta = currentDistance - previousDistance;
    zoomCamera(zoomDelta);
    pointerMap.set(event.pointerId, { x: event.clientX, y: event.clientY, distance: currentDistance });
  }
});

renderer.domElement.addEventListener('pointerup', (event) => {
  pointerMap.delete(event.pointerId);
});

renderer.domElement.addEventListener('pointerleave', () => {
  pointerMap.clear();
});

toggleWireframeBtn.addEventListener('click', () => {
  isWireframe = !isWireframe;

  if (currentMesh) {
    currentMesh.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.wireframe = isWireframe;
      }
    });
  }
});

startCameraBtn.addEventListener('click', () => {
  startGestureCamera();
});

function resizeRenderer() {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

window.addEventListener('resize', resizeRenderer);

window.addEventListener('keydown', (event) => {
  const step = 0.2;

  if (event.key === 'ArrowUp') {
    orbitCamera(0, 15);
  }
  if (event.key === 'ArrowDown') {
    orbitCamera(0, -15);
  }
  if (event.key === 'ArrowLeft') {
    orbitCamera(-15, 0);
  }
  if (event.key === 'ArrowRight') {
    orbitCamera(15, 0);
  }

  if (event.key === 'w' || event.key === 'W') zoomCamera(-1.5);
  if (event.key === 's' || event.key === 'S') zoomCamera(1.5);
  if (event.key === 'a' || event.key === 'A') camera.position.x -= step;
  if (event.key === 'd' || event.key === 'D') camera.position.x += step;

  controls.update();
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

resizeRenderer();
animate();
