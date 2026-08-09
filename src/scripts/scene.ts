import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const canvas = document.querySelector<HTMLCanvasElement>("#bg-canvas");
if (!canvas) throw new Error("bg-canvas not found");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  35,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 1, 6.5);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Lights
scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 1.2));

// Floating particles for depth
const particleGeo = new THREE.BufferGeometry();
const particleCount = 260;
const positions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount * 3; i++) {
  positions[i] = (Math.random() - 0.5) * 20;
}
particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
const particles = new THREE.Points(
  particleGeo,
  new THREE.PointsMaterial({
    color: 0x8a8a99,
    size: 0.035,
    transparent: true,
    opacity: 0.6,
  })
);
scene.add(particles);

// Radial glow / crater textures drawn on canvas, used as sprite/sphere maps
function makeRadialTexture(inner: string, outer: string, size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

const moonPhotoTexture = new THREE.TextureLoader().load("/textures/moon.png");
const sunPhotoTexture = new THREE.TextureLoader().load("/textures/sun.png");

// Sun: real NASA/SDO photo sprite (its corona is baked in) + a touch of extra glow
const sunGroup = new THREE.Group();
const sunCore = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: sunPhotoTexture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
);
sunCore.scale.set(2.0, 2.0, 1);
const sunGlowOuter = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: makeRadialTexture("rgba(255,190,110,0.45)", "rgba(255,150,70,0)"),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
sunGlowOuter.scale.set(5.4, 5.4, 1);
sunGroup.add(sunGlowOuter, sunCore);
sunGroup.position.set(-9, -1, -14);
sunCore.material.opacity = 0;
sunGlowOuter.material.opacity = 0;
sunGroup.visible = false;
scene.add(sunGroup);

// Moon: real photo sprite (always faces camera) + soft cool glow halo
const moonGroup = new THREE.Group();
const moonCore = new THREE.Sprite(
  new THREE.SpriteMaterial({ map: moonPhotoTexture, transparent: true })
);
moonCore.scale.set(1.1, 1.1, 1);
const moonGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: makeRadialTexture("rgba(210,220,255,0.55)", "rgba(210,220,255,0)"),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
moonGlow.scale.set(3.0, 3.0, 1);
moonGroup.add(moonGlow, moonCore);
moonGroup.position.set(-9, -1, -14);
moonCore.material.opacity = 0;
moonGlow.material.opacity = 0;
moonGroup.visible = false;
scene.add(moonGroup);

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", onResize);

// Scroll-driven camera parallax, one tween per section
const sections = ["hero", "about", "projects", "contact"];
const cameraPath = [
  { x: 0, y: 1, z: 6.5 },
  { x: 1.4, y: 0.4, z: 4.5 },
  { x: 2.6, y: 0.6, z: 4 },
  { x: 3.6, y: 1.4, z: 5 },
];

const sideNavLinks = document.querySelectorAll<HTMLAnchorElement>(".side-nav-link");
function setActiveSection(id: string) {
  sideNavLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.section === id);
  });
}

sections.forEach((id, i) => {
  const el = document.getElementById(id);
  if (!el) return;
  ScrollTrigger.create({
    trigger: el,
    start: "top center",
    end: "bottom center",
    onEnter: () => {
      animateTo(i);
      setActiveSection(id);
    },
    onEnterBack: () => {
      animateTo(i);
      setActiveSection(id);
    },
  });
});

function animateTo(index: number) {
  const target = cameraPath[index];
  gsap.to(camera.position, {
    x: target.x,
    y: target.y,
    z: target.z,
    duration: 1.2,
    ease: "power2.inOut",
  });
}

// Idle animation loop
const clock = new THREE.Clock();
function tick() {
  const t = clock.getElapsedTime();
  particles.rotation.y = t * 0.02;
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// Hero blob (CSS) + sun/moon (Three.js), all driven by the same scroll fraction
const heroBlob = document.querySelector<HTMLElement>(".hero-blob");
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smoothstep01 = (t: number) => t * t * (3 - 2 * t);

// Sun and moon each cross the sky once, left-to-right, over their own window
// of the page scroll — sun through hero/about, moon through projects/contact —
// instead of a full circular orbit that finished before the page was over.
// The windows overlap in the middle for a dusk handoff.
const orbitCenterY = -1;
const orbitRadiusX = 9.5;
const orbitRadiusY = 5.2;
const orbitZ = -14;

const sunWindow = { start: 0, end: 0.62 };
const moonWindow = { start: 0.38, end: 1 };

// t: 0 = rising at the left horizon, 1 = setting at the right horizon.
// Height follows a real sun's apparent motion — slow near the horizon, fast
// near zenith — for free, since that's just how sin/cos behave here.
function placeOnArc(group: THREE.Group, t: number) {
  const theta = Math.PI * (1 - t);
  const x = Math.cos(theta) * orbitRadiusX;
  const y = Math.sin(theta) * orbitRadiusY + orbitCenterY;
  group.position.set(x, y, orbitZ);
  return Math.sin(theta);
}

const EDGE_FADE = 0.15;
function windowOpacity(p: number, win: { start: number; end: number }) {
  const t = (p - win.start) / (win.end - win.start);
  if (t < 0 || t > 1) return { t: clamp01(t), opacity: 0 };
  const fadeIn = smoothstep01(clamp01(t / EDGE_FADE));
  const fadeOut = smoothstep01(clamp01((1 - t) / EDGE_FADE));
  return { t, opacity: Math.min(fadeIn, fadeOut) };
}

ScrollTrigger.create({
  trigger: document.body,
  start: "top top",
  end: "bottom bottom",
  scrub: true,
  onUpdate: (self) => {
    const p = self.progress;

    if (heroBlob) {
      const angle = p * 720;
      const m = (1 - Math.cos(p * Math.PI * 4)) / 2;
      heroBlob.style.transform = `rotate(${angle}deg)`;
      heroBlob.style.borderRadius = `${lerp(42, 63, m)}% ${lerp(58, 37, m)}% ${lerp(63, 40, m)}% ${lerp(37, 60, m)}% / ${lerp(41, 58, m)}% ${lerp(44, 47, m)}% ${lerp(56, 53, m)}% ${lerp(59, 42, m)}%`;
    }

    const sun = windowOpacity(p, sunWindow);
    placeOnArc(sunGroup, clamp01(sun.t));
    sunCore.material.opacity = sun.opacity;
    sunGlowOuter.material.opacity = sun.opacity * 0.85;
    sunGroup.visible = sun.opacity > 0.001;

    const moon = windowOpacity(p, moonWindow);
    placeOnArc(moonGroup, clamp01(moon.t));
    moonCore.material.opacity = moon.opacity;
    moonGlow.material.opacity = moon.opacity * 0.85;
    moonGroup.visible = moon.opacity > 0.001;
  },
});
