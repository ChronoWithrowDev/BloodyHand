import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CAVES, G, caveFloorHeight, caveLocal, type CaveDef } from './state';

const rockMaterial = new THREE.MeshStandardMaterial({ color: '#444550', roughness: 0.96, vertexColors: true, side: THREE.DoubleSide });
const floorMaterial = new THREE.MeshStandardMaterial({ color: '#454144', roughness: 1, side: THREE.DoubleSide });
const rubbleMaterial = new THREE.MeshStandardMaterial({ color: '#55515b', roughness: 1 });
const timberMaterial = new THREE.MeshStandardMaterial({ color: '#58432e', roughness: 0.95 });
const metalMaterial = new THREE.MeshStandardMaterial({ color: '#4a4e55', metalness: 0.55, roughness: 0.65 });
const dummy = new THREE.Object3D();

const hash = (i: number) => {
  const n = Math.sin(i * 12.9898) * 43758.5453;
  return n - Math.floor(n);
};

function tunnelGeometry(c: CaveDef, floor: boolean) {
  const steps = Math.ceil(c.depth / 4);
  const sides = floor ? 4 : 14;
  const vertices: number[] = [], colors: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const d = (i / steps) * c.depth;
    const y = caveFloorHeight(c, d) - c.floorY;
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI;
      const texture = 0.83 + hash(i * 31 + j * 7) * 0.17;
      const x = floor ? -c.width / 2 + (j / sides) * c.width : Math.cos(a) * (c.width / 2 + 0.2);
      const roof = floor ? 0.035 : Math.sin(a) * (8.4 + hash(i * 13 + j) * 0.7);
      vertices.push(x, y + roof, -d);
      colors.push(texture, texture, texture);
      uv.push(j / sides, d / 8);
      if (i < steps && j < sides) {
        const v = i * (sides + 1) + j;
        indices.push(v, v + sides + 1, v + 1, v + 1, v + sides + 1, v + sides + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function lavaGeometry(c: CaveDef) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (const pool of [{ from: 0.48, to: 0.57, side: -1 }, { from: 0.72, to: 0.81, side: 1 }]) {
    const start = positions.length / 3;
    for (let i = 0; i <= 14; i++) {
      const d = c.depth * (pool.from + (i / 14) * (pool.to - pool.from));
      const y = caveFloorHeight(c, d) - c.floorY + 0.07;
      const xs = pool.side < 0 ? [-c.width / 2 + 0.25, -2.1] : [2.1, c.width / 2 - 0.25];
      xs.forEach((x, j) => { positions.push(x, y, -d); uv.push(j, i / 14); });
      if (i < 14) {
        const v = start + i * 2;
        indices.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function signTexture(text: string, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#161b20'; ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.strokeRect(9, 9, 494, 142);
  ctx.fillStyle = color; ctx.font = 'bold 57px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 80);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function DeepCave({ c }: { c: CaveDef }) {
  const root = useRef<THREE.Group>(null!);
  const crystals = useRef<THREE.InstancedMesh>(null!);
  const rubble = useRef<THREE.InstancedMesh>(null!);
  const stalactites = useRef<THREE.InstancedMesh>(null!);
  const frames = useRef<THREE.InstancedMesh>(null!);
  const crystalLight = useRef<THREE.PointLight>(null!);
  const warmLight = useRef<THREE.PointLight>(null!);
  const lavaLight = useRef<THREE.PointLight>(null!);
  const elapsed = useRef(0);
  const geometry = useMemo(() => ({ shell: tunnelGeometry(c, false), floor: tunnelGeometry(c, true), lava: lavaGeometry(c) }), [c]);
  const crystalMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: c.crystal, emissive: c.crystal, emissiveIntensity: 0.65, roughness: 0.25, metalness: 0.1, flatShading: true,
  }), [c]);
  const lavaMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } }, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `uniform float time; varying vec2 vUv;
      void main(){
        vec2 p=vUv*vec2(8.0,35.0);
        float flow=sin(p.x*2.4+sin(p.y*0.8-time*0.38)*2.0)+sin(p.y*1.7+time*0.55);
        float crust=smoothstep(0.3,1.45,flow);
        vec3 molten=mix(vec3(1.5,0.12,0.012),vec3(2.1,0.76,0.07),sin(flow*2.0)*0.5+0.5);
        gl_FragColor=vec4(mix(molten,vec3(0.07,0.021,0.018),crust),1.0);
      }`,
  }), []);
  const signs = useMemo(() => ({ exit: signTexture('<  EXIT', '#87cfbb'), deep: signTexture('DEEP SHAFT', '#d1ba83') }), []);

  const clusterCount = Math.ceil(c.depth / 8);
  const rockCount = Math.ceil(c.depth / 6);
  const frameCount = Math.ceil(c.depth / 18);

  useEffect(() => {
    for (let i = 0; i < clusterCount; i++) {
      const d = 10 + hash(i + c.x * 9) * (c.depth - 26);
      const side = i % 2 ? 1 : -1;
      const x = side * (c.width / 2 - 0.45);
      for (let k = 0; k < 3; k++) {
        const scale = 0.5 + hash(i * 19 + k * 3) * 1.25;
        dummy.position.set(x + (k - 1) * 0.24, caveFloorHeight(c, d) - c.floorY + scale * 0.55, -d + k * 0.23);
        dummy.rotation.set((hash(i + k) - 0.5) * 0.45, i * 0.6, -side * (0.25 + k * 0.18));
        dummy.scale.set(scale * 0.55, scale * 1.8, scale * 0.55);
        dummy.updateMatrix(); crystals.current.setMatrixAt(i * 3 + k, dummy.matrix);
      }
    }
    for (let i = 0; i < rockCount; i++) {
      const d = 12 + (i / rockCount) * (c.depth - 18);
      const scale = 0.25 + hash(i * 13) * 0.65;
      dummy.position.set((i % 2 ? 1 : -1) * (c.width / 2 - 0.8), caveFloorHeight(c, d) - c.floorY + scale * 0.25, -d);
      dummy.rotation.set(i, i * 0.7, 0.1); dummy.scale.set(scale * 1.4, scale * 0.6, scale);
      dummy.updateMatrix(); rubble.current.setMatrixAt(i, dummy.matrix);
      dummy.position.set((hash(i * 7) - 0.5) * (c.width - 3), caveFloorHeight(c, d) - c.floorY + 7, -d - 1);
      dummy.rotation.set(Math.PI, 0, 0.08); dummy.scale.set(scale * 0.6, 1.2 + scale, scale * 0.6);
      dummy.updateMatrix(); stalactites.current.setMatrixAt(i, dummy.matrix);
    }
    for (let i = 0; i < frameCount; i++) {
      const d = 3 + i * 18;
      const y = caveFloorHeight(c, d) - c.floorY;
      const pieces = [
        { x: -c.width / 2 + 0.35, y: y + 2.8, s: [0.27, 5.6, 0.32] },
        { x: c.width / 2 - 0.35, y: y + 2.8, s: [0.27, 5.6, 0.32] },
        { x: 0, y: y + 5.65, s: [c.width - 0.4, 0.28, 0.35] },
      ];
      pieces.forEach((p, k) => {
        dummy.position.set(p.x, p.y, -d); dummy.rotation.set(0, 0, 0);
        dummy.scale.set(p.s[0], p.s[1], p.s[2]); dummy.updateMatrix(); frames.current.setMatrixAt(i * 3 + k, dummy.matrix);
      });
    }
    for (const mesh of [crystals.current, rubble.current, stalactites.current, frames.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    return () => {
      geometry.shell.dispose(); geometry.floor.dispose(); geometry.lava.dispose();
      crystalMaterial.dispose(); lavaMaterial.dispose(); signs.exit.dispose(); signs.deep.dispose();
    };
  }, [c, clusterCount, rockCount, frameCount, geometry, crystalMaterial, lavaMaterial, signs]);

  useFrame((_, dt) => {
    elapsed.current += dt;
    if (!root.current) return;
    const inside = G.inCave === c.id;
    const atMouth = Math.hypot(G.pos.x - c.x, G.pos.z - c.z, G.pos.y - c.floorY) < 52;
    root.current.visible = inside || atMouth;
    const active = root.current.visible;
    crystalLight.current.visible = active;
    warmLight.current.visible = active;
    lavaLight.current.visible = active && c.lava && inside;
    if (!active) return;
    const d = inside ? THREE.MathUtils.clamp(-caveLocal(c, G.pos.x, G.pos.z)[1], 0, c.depth - 5) : 5;
    const y = caveFloorHeight(c, d) - c.floorY;
    crystalLight.current.position.set((Math.floor(d / 18) % 2 ? 1 : -1) * (c.width / 2 - 1), y + 2.4, -d - 5);
    crystalLight.current.intensity = 9 + Math.sin(elapsed.current * 0.9) * 1.3;
    warmLight.current.position.set(0, y + 3.9, -d + 4);
    lavaLight.current.position.set(0, y + 0.5, -d - 3);
    lavaLight.current.intensity = d > c.depth * 0.43 ? 12 : 0;
    lavaMaterial.uniforms.time.value = elapsed.current;
  });

  return (
    <group ref={root} dispose={null} position={[c.x, c.floorY, c.z]} rotation={[0, -c.rot, 0]}>
      <mesh geometry={geometry.shell} material={rockMaterial} receiveShadow />
      <mesh geometry={geometry.floor} material={floorMaterial} receiveShadow />
      <mesh position={[0, caveFloorHeight(c, c.depth) - c.floorY + 3.6, -c.depth]}>
        <boxGeometry args={[c.width, 8, 0.8]} />
        <primitive object={rubbleMaterial} attach="material" />
      </mesh>
      <instancedMesh ref={crystals} args={[undefined, crystalMaterial, clusterCount * 3]}>
        <octahedronGeometry args={[0.45, 0]} />
      </instancedMesh>
      <instancedMesh ref={rubble} args={[undefined, rubbleMaterial, rockCount]}>
        <dodecahedronGeometry args={[0.6, 0]} />
      </instancedMesh>
      <instancedMesh ref={stalactites} args={[undefined, rubbleMaterial, rockCount]}>
        <coneGeometry args={[0.35, 1.4, 6]} />
      </instancedMesh>
      <instancedMesh ref={frames} args={[undefined, timberMaterial, frameCount * 3]}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      {c.lava && <mesh geometry={geometry.lava} material={lavaMaterial} />}
      {Array.from({ length: Math.ceil(c.depth / 65) }).map((_, i) => {
        const d = 16 + i * 65;
        return (
          <group key={i} position={[-c.width / 2 + 0.9, caveFloorHeight(c, d) - c.floorY + 2.6, -d]} rotation={[0, Math.PI / 2, 0]}>
            <mesh>
              <planeGeometry args={[1.55, 0.48]} />
              <meshBasicMaterial map={signs.exit} toneMapped />
            </mesh>
          </group>
        );
      })}
      <group position={[0, 0, 0]}>
        <mesh position={[-c.width / 2 - 0.4, 2.4, 0]} material={timberMaterial}>
          <boxGeometry args={[0.7, 4.8, 0.7]} />
        </mesh>
        <mesh position={[c.width / 2 + 0.4, 2.4, 0]} material={timberMaterial}>
          <boxGeometry args={[0.7, 4.8, 0.7]} />
        </mesh>
        <mesh position={[0, 4.8, 0]} material={timberMaterial}>
          <boxGeometry args={[c.width + 1.5, 0.65, 1]} />
        </mesh>
        <mesh position={[0, 5.5, 0.5]}>
          <planeGeometry args={[3.4, 1.06]} />
          <meshBasicMaterial map={signs.deep} />
        </mesh>
      </group>
      {/* Deep-end supplies stay off the central walking path. */}
      <group position={[c.width / 2 - 1.5, caveFloorHeight(c, c.depth - 14) - c.floorY, -c.depth + 14]}>
        <mesh position={[0, 0.5, 0]} material={timberMaterial}><boxGeometry args={[1, 1, 1]} /></mesh>
        <mesh position={[0, 0.97, 0]} material={metalMaterial}><boxGeometry args={[1.03, 0.08, 1.03]} /></mesh>
      </group>
      <pointLight ref={crystalLight} color={c.crystal} intensity={9} distance={30} decay={1.45} visible={false} />
      <pointLight ref={warmLight} color="#d9c5a5" intensity={5} distance={23} decay={1.4} visible={false} />
      <pointLight ref={lavaLight} color="#ff5d16" intensity={12} distance={26} decay={1.4} visible={false} />
    </group>
  );
}

export default function DeepCaves() {
  return <>{CAVES.map((c) => <DeepCave key={c.id} c={c} />)}</>;
}