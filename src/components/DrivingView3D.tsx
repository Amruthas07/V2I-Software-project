/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { VehicleTelemetry, RSUData, TrafficSignalData } from '../types/navigation';

interface DrivingView3DProps {
  telemetry: VehicleTelemetry;
  activeRsu: RSUData | null;
  activeSignal: TrafficSignalData | null;
  currentRoadName: string;
  isNavigating: boolean;
}

export const DrivingView3D: React.FC<DrivingView3DProps> = ({
  telemetry,
  activeRsu,
  activeSignal,
  currentRoadName,
  isNavigating
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const animFrameId = useRef<number | null>(null);

  // References for live 3D animation
  const roadLinesRef = useRef<THREE.InstancedMesh | null>(null);
  const treesGroupRef = useRef<THREE.Group | null>(null);
  const gantryGroupRef = useRef<THREE.Group | null>(null);
  const signboardMeshRef = useRef<THREE.Mesh | null>(null);
  const signalLightsGroupRef = useRef<THREE.Group | null>(null);
  const trafficCarsRef = useRef<THREE.Group[]>([]);
  const brakeLightsRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const rsuTextTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const redLensMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const yellowLensMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const greenLensMatRef = useRef<THREE.MeshBasicMaterial | null>(null);

  // Synchronized state refs for render loop
  const speedRef = useRef(telemetry.speedKmH);
  const isNavigatingRef = useRef(isNavigating);
  const isStoppedRef = useRef(telemetry.isStoppedAtSignal);

  useEffect(() => {
    speedRef.current = telemetry.speedKmH;
    isNavigatingRef.current = isNavigating;
    isStoppedRef.current = telemetry.isStoppedAtSignal;
  }, [telemetry.speedKmH, isNavigating, telemetry.isStoppedAtSignal]);

  // Update brake light emissive brightness when stopping
  useEffect(() => {
    if (brakeLightsRef.current) {
      if (telemetry.isStoppedAtSignal || telemetry.speedKmH < 5) {
        brakeLightsRef.current.emissive.setHex(0xff0022);
        brakeLightsRef.current.emissiveIntensity = 3.0;
      } else {
        brakeLightsRef.current.emissive.setHex(0xbb0011);
        brakeLightsRef.current.emissiveIntensity = 0.8;
      }
    }
  }, [telemetry.isStoppedAtSignal, telemetry.speedKmH]);

  // Dynamically update overhead gantry traffic light colors based on live signal phase
  useEffect(() => {
    const phase = activeSignal?.currentPhase || 'green';
    if (redLensMatRef.current && yellowLensMatRef.current && greenLensMatRef.current) {
      if (phase === 'red') {
        redLensMatRef.current.color.setHex(0xff1122);
        yellowLensMatRef.current.color.setHex(0x221100);
        greenLensMatRef.current.color.setHex(0x002211);
      } else if (phase === 'amber') {
        redLensMatRef.current.color.setHex(0x220000);
        yellowLensMatRef.current.color.setHex(0xf59e0b);
        greenLensMatRef.current.color.setHex(0x002211);
      } else {
        redLensMatRef.current.color.setHex(0x220000);
        yellowLensMatRef.current.color.setHex(0x221100);
        greenLensMatRef.current.color.setHex(0x10b981);
      }
    }
  }, [activeSignal?.currentPhase]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Daylight sky
    scene.fog = new THREE.FogExp2(0x9fc5e8, 0.008);

    const camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / container.clientHeight,
      0.1,
      600
    );
    // Third-person camera positioned slightly behind and above the Tesla, looking forward
    camera.position.set(0, 2.3, 5.6);
    camera.lookAt(0, 1.4, -20);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // 2. Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x445544, 0.8);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    sunLight.position.set(20, 45, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 150;
    sunLight.shadow.camera.left = -25;
    sunLight.shadow.camera.right = 25;
    sunLight.shadow.camera.top = 25;
    sunLight.shadow.camera.bottom = -25;
    scene.add(sunLight);

    // 3. Indian Highway Road System (Multi-Lane Divided Highway)
    // Left-hand traffic: Vehicle drives on the left-side carriageway
    const roadWidth = 24; // 6 lanes total (3 each way)
    const roadLength = 400;

    // Asphalt surface
    const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLength, 1, 1);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x22252a,
      roughness: 0.85,
      metalness: 0.1
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.set(0, 0, -100);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    // Center divider / median barrier (Indian yellow/black striped curb)
    const medianWidth = 1.8;
    const medianGeo = new THREE.BoxGeometry(medianWidth, 0.6, roadLength);
    const medianMat = new THREE.MeshStandardMaterial({
      color: 0x2b3038,
      roughness: 0.7
    });
    const median = new THREE.Mesh(medianGeo, medianMat);
    median.position.set(6.2, 0.3, -100);
    scene.add(median);

    // Median yellow hazard stripes
    const stripeCount = 40;
    for (let i = 0; i < stripeCount; i++) {
      const yellowStripeGeo = new THREE.BoxGeometry(medianWidth + 0.05, 0.62, 2.5);
      const yellowStripeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
      const yellowStripe = new THREE.Mesh(yellowStripeGeo, yellowStripeMat);
      yellowStripe.position.set(6.2, 0.3, -200 + i * 10);
      scene.add(yellowStripe);
    }

    // Outer Guardrail & Black/White Striped Curb on Left
    const curbGeo = new THREE.BoxGeometry(0.8, 0.45, roadLength);
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 });
    const leftCurb = new THREE.Mesh(curbGeo, curbMat);
    leftCurb.position.set(-6.2, 0.22, -100);
    scene.add(leftCurb);

    // Left Steel Guardrail
    const guardrailGeo = new THREE.BoxGeometry(0.15, 0.4, roadLength);
    const guardrailMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 });
    const leftGuardrail = new THREE.Mesh(guardrailGeo, guardrailMat);
    leftGuardrail.position.set(-6.5, 0.8, -100);
    scene.add(leftGuardrail);

    // Roadside Terrain / Green Grass
    const grassGeo = new THREE.PlaneGeometry(300, roadLength);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x2e6f40,
      roughness: 0.95
    });
    const leftGrass = new THREE.Mesh(grassGeo, grassMat);
    leftGrass.rotation.x = -Math.PI / 2;
    leftGrass.position.set(-156, -0.05, -100);
    leftGrass.receiveShadow = true;
    scene.add(leftGrass);

    const rightGrass = new THREE.Mesh(grassGeo, grassMat);
    rightGrass.rotation.x = -Math.PI / 2;
    rightGrass.position.set(156, -0.05, -100);
    rightGrass.receiveShadow = true;
    scene.add(rightGrass);

    // Animated Dashed Lane Divider Markings
    const numDashes = 60;
    const dashGeo = new THREE.PlaneGeometry(0.25, 4.5);
    dashGeo.rotateX(-Math.PI / 2);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const dashInstanced = new THREE.InstancedMesh(dashGeo, dashMat, numDashes * 2);
    dashInstanced.position.y = 0.02;

    const dummy = new THREE.Object3D();
    const dashZPositions: number[] = [];

    for (let i = 0; i < numDashes; i++) {
      const z = 20 - i * 8;
      dashZPositions.push(z);

      // Lane 1 divider (between lane 1 and lane 2 in Indian left traffic)
      dummy.position.set(-2.8, 0.02, z);
      dummy.updateMatrix();
      dashInstanced.setMatrixAt(i * 2, dummy.matrix);

      // Lane 2 divider (between lane 2 and lane 3)
      dummy.position.set(1.4, 0.02, z);
      dummy.updateMatrix();
      dashInstanced.setMatrixAt(i * 2 + 1, dummy.matrix);
    }
    dashInstanced.instanceMatrix.needsUpdate = true;
    scene.add(dashInstanced);
    roadLinesRef.current = dashInstanced;

    // 4. Procedural Roadside Trees (scrolling environment)
    const treesGroup = new THREE.Group();
    const treeTrunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 4, 6);
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.9 });
    const treeFoliageGeo = new THREE.ConeGeometry(2.4, 5.5, 7);
    const treeFoliageMat = new THREE.MeshStandardMaterial({ color: 0x1f5c2b, roughness: 0.8 });

    const treeData: { group: THREE.Group; initialZ: number }[] = [];

    for (let i = 0; i < 35; i++) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(treeTrunkGeo, treeTrunkMat);
      trunk.position.y = 2;
      trunk.castShadow = true;
      tree.add(trunk);

      const foliage = new THREE.Mesh(treeFoliageGeo, treeFoliageMat);
      foliage.position.y = 5.2;
      foliage.castShadow = true;
      tree.add(foliage);

      const isLeft = Math.random() > 0.4;
      const x = isLeft ? -9.5 - Math.random() * 12 : 9.5 + Math.random() * 12;
      const z = 20 - i * 11;
      tree.position.set(x, 0, z);

      treesGroup.add(tree);
      treeData.push({ group: tree, initialZ: z });
    }
    scene.add(treesGroup);
    treesGroupRef.current = treesGroup;

    // 5. Overhead Highway Gantry & RSU Banner (Matching Reference Image)
    const gantry = new THREE.Group();
    // Vertical steel truss legs
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 });
    const legGeo = new THREE.BoxGeometry(0.5, 7.5, 0.5);

    const leftLeg = new THREE.Mesh(legGeo, trussMat);
    leftLeg.position.set(-6.2, 3.75, 0);
    gantry.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, trussMat);
    rightLeg.position.set(6.2, 3.75, 0);
    gantry.add(rightLeg);

    // Horizontal truss bridge across highway
    const beamGeo = new THREE.BoxGeometry(13.2, 0.8, 0.8);
    const beam = new THREE.Mesh(beamGeo, trussMat);
    beam.position.set(0, 6.8, 0);
    gantry.add(beam);

    // Dynamic RSU Banner Texture Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;

    // Draw dark rounded card with green glowing WiFi / RSU text matching image
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 148);

    // Green WiFi symbol
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('📡  RSU-KAD-01', 90, 65);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('Connected', 150, 115);

    const rsuTexture = new THREE.CanvasTexture(canvas);
    rsuTextTextureRef.current = rsuTexture;

    const rsuBannerGeo = new THREE.PlaneGeometry(4.8, 1.5);
    const rsuBannerMat = new THREE.MeshBasicMaterial({ map: rsuTexture });
    const rsuBanner = new THREE.Mesh(rsuBannerGeo, rsuBannerMat);
    rsuBanner.position.set(-1.8, 6.8, 0.42);
    gantry.add(rsuBanner);

    // Blue Indian Highway Signboard "NH 766" on the right of the gantry
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 256;
    signCanvas.height = 140;
    const sCtx = signCanvas.getContext('2d')!;
    sCtx.fillStyle = '#0284c7'; // Indian NH Blue
    sCtx.fillRect(0, 0, 256, 140);
    sCtx.strokeStyle = '#f59e0b'; // Gold border
    sCtx.lineWidth = 10;
    sCtx.strokeRect(5, 5, 246, 130);
    sCtx.fillStyle = '#ffffff';
    sCtx.font = 'bold 52px sans-serif';
    sCtx.textAlign = 'center';
    sCtx.fillText('NH 766', 128, 88);

    const signTexture = new THREE.CanvasTexture(signCanvas);
    const signGeo = new THREE.PlaneGeometry(2.4, 1.3);
    const signMat = new THREE.MeshBasicMaterial({ map: signTexture });
    const signboard = new THREE.Mesh(signGeo, signMat);
    signboard.position.set(3.8, 6.8, 0.42);
    gantry.add(signboard);
    signboardMeshRef.current = signboard;

    // Traffic Signal Gantry Attachment (Red, Yellow, Green)
    const signalBox = new THREE.Group();
    const boxHousingGeo = new THREE.BoxGeometry(0.6, 1.6, 0.4);
    const boxHousingMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
    const boxMesh = new THREE.Mesh(boxHousingGeo, boxHousingMat);
    signalBox.add(boxMesh);

    // 3 light lenses
    const redLightMat = new THREE.MeshBasicMaterial({ color: activeSignal?.currentPhase === 'red' ? 0xff1122 : 0x220000 });
    const yellowLightMat = new THREE.MeshBasicMaterial({ color: activeSignal?.currentPhase === 'amber' ? 0xf59e0b : 0x221100 });
    const greenLightMat = new THREE.MeshBasicMaterial({ color: activeSignal?.currentPhase === 'green' ? 0x10b981 : 0x002211 });

    redLensMatRef.current = redLightMat;
    yellowLensMatRef.current = yellowLightMat;
    greenLensMatRef.current = greenLightMat;

    const lensGeo = new THREE.CircleGeometry(0.18, 16);

    const redLens = new THREE.Mesh(lensGeo, redLightMat);
    redLens.position.set(0, 0.5, 0.21);
    signalBox.add(redLens);

    const yellowLens = new THREE.Mesh(lensGeo, yellowLightMat);
    yellowLens.position.set(0, 0, 0.21);
    signalBox.add(yellowLens);

    const greenLens = new THREE.Mesh(lensGeo, greenLightMat);
    greenLens.position.set(0, -0.5, 0.21);
    signalBox.add(greenLens);

    signalBox.position.set(-0.8, 5.2, 0);
    gantry.add(signalBox);
    signalLightsGroupRef.current = signalBox;

    gantry.position.set(0, 0, -45);
    scene.add(gantry);
    gantryGroupRef.current = gantry;

    // 6. Detailed Tesla Model 3/S Procedural Car (Subject Vehicle)
    const carGroup = new THREE.Group();

    // Pearl White Aerodynamic Chassis
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xf3f4f6, // Pearl white
      metalness: 0.25,
      roughness: 0.18
    });

    // Lower Main Body Hull
    const mainBodyGeo = new THREE.BoxGeometry(1.86, 0.52, 4.4);
    const mainBody = new THREE.Mesh(mainBodyGeo, bodyMat);
    mainBody.position.y = 0.52;
    mainBody.castShadow = true;
    carGroup.add(mainBody);

    // Aerodynamic Sloped Cabin / Glasshouse
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.05,
      metalness: 0.95
    });
    const cabinGeo = new THREE.BoxGeometry(1.6, 0.44, 2.3);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 0.94, -0.2);
    cabin.castShadow = true;
    carGroup.add(cabin);

    // Rear Hatch Glass Slope
    const rearGlassGeo = new THREE.BoxGeometry(1.58, 0.38, 0.9);
    rearGlassGeo.rotateX(0.4);
    const rearGlass = new THREE.Mesh(rearGlassGeo, glassMat);
    rearGlass.position.set(0, 0.88, 1.15);
    carGroup.add(rearGlass);

    // Distinctive Tesla Rear Red Tail-Light Bar
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff0022,
      emissive: 0xdd0011,
      emissiveIntensity: 1.2,
      roughness: 0.2
    });
    brakeLightsRef.current = tailMat;

    const tailLightGeo = new THREE.BoxGeometry(1.72, 0.12, 0.06);
    const tailLights = new THREE.Mesh(tailLightGeo, tailMat);
    tailLights.position.set(0, 0.62, 2.2);
    carGroup.add(tailLights);

    // Indian License Plate: KA 09 EV 2026
    const plateCanvas = document.createElement('canvas');
    plateCanvas.width = 256;
    plateCanvas.height = 70;
    const pCtx = plateCanvas.getContext('2d')!;
    pCtx.fillStyle = '#ffffff';
    pCtx.fillRect(0, 0, 256, 70);
    pCtx.strokeStyle = '#000000';
    pCtx.lineWidth = 4;
    pCtx.strokeRect(2, 2, 252, 66);
    pCtx.fillStyle = '#000000';
    pCtx.font = 'bold 30px monospace';
    pCtx.textAlign = 'center';
    pCtx.fillText('KA 09 EV 2026', 128, 48);

    const plateTex = new THREE.CanvasTexture(plateCanvas);
    const plateGeo = new THREE.PlaneGeometry(0.68, 0.2);
    const plateMat = new THREE.MeshBasicMaterial({ map: plateTex });
    const plateMesh = new THREE.Mesh(plateGeo, plateMat);
    plateMesh.position.set(0, 0.42, 2.21);
    carGroup.add(plateMesh);

    // Tesla Chrome Logo / Badge on trunk
    const badgeGeo = new THREE.BoxGeometry(0.12, 0.04, 0.02);
    const badgeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.1 });
    const badge = new THREE.Mesh(badgeGeo, badgeMat);
    badge.position.set(0, 0.68, 2.21);
    carGroup.add(badge);

    // Rear diffuser / bumper
    const diffuserGeo = new THREE.BoxGeometry(1.78, 0.2, 0.2);
    const diffuserMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
    const diffuser = new THREE.Mesh(diffuserGeo, diffuserMat);
    diffuser.position.set(0, 0.28, 2.15);
    carGroup.add(diffuser);

    // 4 Sport Alloy Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 18);
    wheelGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });

    // Wheel positions [x, y, z]
    const wheelPositions: [number, number, number][] = [
      [-0.92, 0.36, 1.4],  // Rear Left
      [0.92, 0.36, 1.4],   // Rear Right
      [-0.92, 0.36, -1.4], // Front Left
      [0.92, 0.36, -1.4]   // Front Right
    ];

    wheelPositions.forEach((pos) => {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(...pos);
      wheel.castShadow = true;

      // Rim cap
      const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.25, 6);
      rimGeo.rotateZ(Math.PI / 2);
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x71717a, metalness: 0.8, roughness: 0.2 });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wheel.add(rim);

      carGroup.add(wheel);
    });

    // Position vehicle in Indian left-hand driving lane (x = -2.8)
    carGroup.position.set(-2.8, 0, 0);
    scene.add(carGroup);

    // 7. Ambient Traffic Vehicles (ahead and oncoming)
    const trafficGroup = new THREE.Group();
    // Traffic Car 1: Ahead in middle lane
    const tCar1 = new THREE.Group();
    const tCar1Body = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.55, 4.2),
      new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 })
    );
    tCar1Body.position.y = 0.55;
    tCar1.add(tCar1Body);
    tCar1.position.set(1.4, 0, -32);
    trafficGroup.add(tCar1);

    // Traffic Car 2: Ahead in left lane further out
    const tCar2 = new THREE.Group();
    const tCar2Body = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.6, 4.3),
      new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.4 })
    );
    tCar2Body.position.y = 0.58;
    tCar2.add(tCar2Body);
    tCar2.position.set(-2.8, 0, -68);
    trafficGroup.add(tCar2);

    scene.add(trafficGroup);
    trafficCarsRef.current = [tCar1, tCar2];

    // 8. Animation & Render Loop
    let clock = new THREE.Clock();
    let gantryZ = -45;

    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const currentSpeed = speedRef.current;
      const isNav = isNavigatingRef.current;

      // Speed in meters per second (1 km/h = 0.277 m/s)
      const speedMPS = isNav ? (currentSpeed * 0.277) : 0;

      // Scroll Road Dashes
      if (dashInstanced && speedMPS > 0) {
        for (let i = 0; i < numDashes; i++) {
          dashZPositions[i] += speedMPS * delta * 1.5;
          if (dashZPositions[i] > 20) {
            dashZPositions[i] -= numDashes * 8;
          }

          dummy.position.set(-2.8, 0.02, dashZPositions[i]);
          dummy.updateMatrix();
          dashInstanced.setMatrixAt(i * 2, dummy.matrix);

          dummy.position.set(1.4, 0.02, dashZPositions[i]);
          dummy.updateMatrix();
          dashInstanced.setMatrixAt(i * 2 + 1, dummy.matrix);
        }
        dashInstanced.instanceMatrix.needsUpdate = true;
      }

      // Scroll Roadside Trees
      if (treesGroup && speedMPS > 0) {
        treeData.forEach((item) => {
          item.group.position.z += speedMPS * delta * 1.5;
          if (item.group.position.z > 25) {
            item.group.position.z -= 35 * 11;
          }
        });
      }

      // Scroll Overhead Gantry towards vehicle
      if (gantry && speedMPS > 0) {
        gantryZ += speedMPS * delta * 1.5;
        if (gantryZ > 15) {
          gantryZ = -180; // Loop gantry periodically
        }
        gantry.position.z = gantryZ;
      }

      // Move ambient traffic vehicles
      if (trafficCarsRef.current.length > 0 && speedMPS > 0) {
        // tCar1 moves slightly slower than player car
        tCar1.position.z += (speedMPS - 18) * delta;
        if (tCar1.position.z > 15) tCar1.position.z = -90;
        if (tCar1.position.z < -120) tCar1.position.z = -20;

        // tCar2 cruises ahead
        tCar2.position.z += (speedMPS - 22) * delta;
        if (tCar2.position.z > 15) tCar2.position.z = -110;
        if (tCar2.position.z < -130) tCar2.position.z = -40;
      }

      // Subtle vehicle suspension idle vibrations
      if (carGroup) {
        if (speedMPS > 0) {
          carGroup.position.y = Math.sin(clock.getElapsedTime() * 14) * 0.008;
          // Subtle camera follow sway
          camera.position.x = -2.8 + Math.sin(clock.getElapsedTime() * 2) * 0.03;
        } else {
          carGroup.position.y = 0;
          camera.position.x = -2.8;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-900">
      <div ref={mountRef} className="w-full h-full" />

      {/* Floating HUD Badges Matching Reference Image */}
      <div className="absolute top-3 left-3 pointer-events-none flex items-center gap-2 z-20">
        <div className="px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 text-xs text-cyan-300 font-mono flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>FSD v12 · Indian Left Traffic</span>
        </div>
      </div>

      <div className="absolute top-3 right-3 pointer-events-none z-20">
        <div className="px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800 text-xs text-slate-300 font-mono shadow-lg">
          {currentRoadName || 'NH 766 Highway'}
        </div>
      </div>

      {/* DYNAMIC V2I STATUS BANNERS */}
      {/* 1. Red Signal Stop Banner */}
      {telemetry.isStoppedAtSignal && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 px-3.5 py-2 rounded-xl bg-rose-950/95 border-2 border-rose-500 text-rose-100 font-mono text-xs flex items-center gap-2.5 shadow-2xl backdrop-blur-md animate-pulse whitespace-nowrap">
          <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_12px_#f43f5e] animate-ping shrink-0" />
          <div>
            <div className="font-bold text-xs text-rose-100">🔴 SIGNAL RED: VEHICLE HALTED ({activeSignal?.countdownSeconds || 18}s)</div>
            <div className="text-[10px] text-rose-300">Mysuru Ring Road Intersection · Auto-Resuming on Green</div>
          </div>
        </div>
      )}

      {/* 2. RSU Speed Advisory / Road Work Banner */}
      {!telemetry.isStoppedAtSignal && telemetry.speedKmH === 50 && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 px-3.5 py-2 rounded-xl bg-purple-950/95 border-2 border-purple-500 text-purple-100 font-mono text-xs flex items-center gap-2.5 shadow-2xl backdrop-blur-md whitespace-nowrap">
          <div className="w-3 h-3 rounded-full bg-purple-400 animate-ping shrink-0" />
          <div>
            <div className="font-bold text-xs text-purple-100">📡 RSU-KAD-01: ADVISORY 50 km/h ACTIVE</div>
            <div className="text-[10px] text-purple-300">Road Work Ahead (500m) · Left Lane Closed</div>
          </div>
        </div>
      )}

      {/* 3. FASTag Toll Scan Banner */}
      {telemetry.isProcessingToll && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 px-3.5 py-2 rounded-xl bg-amber-950/95 border-2 border-amber-500 text-amber-100 font-mono text-xs flex items-center gap-2.5 shadow-2xl backdrop-blur-md whitespace-nowrap animate-bounce">
          <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping shrink-0" />
          <div>
            <div className="font-bold text-xs text-amber-100">💳 KADAKOLA FASTag: ₹55.00 PAID</div>
            <div className="text-[10px] text-amber-300">RFID DSRC Tag Authorized · Barrier Opened</div>
          </div>
        </div>
      )}
    </div>
  );
};
