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

// Hero blob (CSS), driven by the same scroll fraction
const heroBlob = document.querySelector<HTMLElement>(".hero-blob");
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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
  },
});
