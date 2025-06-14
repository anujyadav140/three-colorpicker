// src/app/page.tsx
'use client'

import React, { useState, useEffect, ChangeEvent, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF, Html, OrbitControls, Center } from '@react-three/drei'
import * as THREE from 'three'
import type { Group, Mesh, Material, Color as ThreeColor } from 'three'

// helper to detect & set color on a material
function hasColorProp(mat: Material): mat is Material & { color: ThreeColor } {
  return (
    (mat as any).color !== undefined &&
    typeof (mat as any).color.set === 'function'
  )
}

type GLTFResult = {
  scene: Group
  nodes: Record<string, Mesh>
}

const MODEL_URL = 'https://hwirj3tptvfk3tad.public.blob.vercel-storage.com/jordans_1-7nkPL27q2fIwTDUDEfsQLWT1AOmv3A.glb'
const PART_NAMES = [
  "Jordan_logo",
  "Jordan_back",
  "Jordan_side",
  "Jordan_front",
  "Jordan_strap",
  "Jordan_skeleton",
  "Jordan_sole",
] as const

type ColorMap = Record<typeof PART_NAMES[number], string>
const initialColors: ColorMap = PART_NAMES.reduce((acc, name) => {
  acc[name] = '#ffffff'
  return acc
}, {} as ColorMap)

function Model({ colors }: { colors: ColorMap }) {
  const { scene, nodes } = useGLTF(MODEL_URL) as unknown as GLTFResult

  // debug: list out all meshes so you can confirm names
  useEffect(() => {
    const meshNames: string[] = []
    scene.traverse((obj) => {
      if ((obj as Mesh).isMesh) meshNames.push(obj.name || '(no name)')
    })
    console.log('🕸️ Mesh names:', meshNames)
  }, [scene])

  // apply colors + strip all maps + force matte
  useEffect(() => {
    PART_NAMES.forEach((name) => {
      let mesh = nodes[name] || scene.getObjectByName(name)
      if (!(mesh as Mesh)?.isMesh) return
      mesh = mesh as Mesh

      // clone material once
      if (!mesh.userData.__cloned) {
        const originals = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material]
        const clones = originals.map((m) => m.clone())
        mesh.material = Array.isArray(mesh.material) ? clones : clones[0]
        mesh.userData.__cloned = true
      }

      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]

      mats.forEach((m) => {
        if (!hasColorProp(m)) return

        // —— strip _every_ map that could introduce shading/specularity
        ;[
          'map',
          'normalMap',
          'roughnessMap',
          'metalnessMap',
          'bumpMap',
          'aoMap',
        ].forEach((k) => {
          if ((m as any)[k]) (m as any)[k] = null
        })

        // —— force fully matte
        if ('roughness' in m) (m as any).roughness = 1
        if ('metalness' in m) (m as any).metalness = 0

        // —— if you still see z-fighting, uncomment these:
        // m.polygonOffset = true
        // m.polygonOffsetFactor = 1
        // m.polygonOffsetUnits = 1

        // —— finally set your color
        m.color.set(colors[name])
        m.needsUpdate = true
      })
    })
  }, [colors, nodes, scene])

  return <primitive object={scene} />
}

export default function Page() {
  const [colors, setColors] = useState<ColorMap>(initialColors)

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        dpr={[1, 1]}              // lock devicePixelRatio to avoid sub-pixel flicker
        gl={{ antialias: true }} // ensure antialiasing is on
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />

        <Suspense fallback={<Html center>Loading model…</Html>}>
          <Center>
            <Model colors={colors} />
          </Center>
        </Suspense>

        <OrbitControls
          makeDefault
          target={[0, 0, 0]}
          enableDamping
          dampingFactor={0.1}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
          enableZoom
          zoomSpeed={1}
          minDistance={0.5}
          maxDistance={20}
          enablePan={false}
        />
      </Canvas>

      {/* Color picker UI */}
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          background: 'rgba(0,0,0,0.45)',
          padding: '0.75rem',
          borderRadius: '4px',
          color: '#fff',
          fontSize: '0.9rem',
        }}
      >
        {PART_NAMES.map((name) => (
          <label
            key={name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
            }}
          >
            {name.replace(/jordans_?/i, '')}
            <input
              type="color"
              value={colors[name]}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setColors((prev) => ({
                  ...prev,
                  [name]: e.target.value,
                }))
              }
              style={{
                width: '1.5rem',
                height: '1.5rem',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
            />
          </label>
        ))}
      </div>

      <style jsx global>{`
        html,
        body,
        #__next {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div>
  )
}
