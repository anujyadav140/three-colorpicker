// src/app/page.tsx
'use client'

import React, { useState, useEffect, Suspense } from 'react'
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

// 1) Define your part names as a const tuple, then derive a union type:
const PART_NAMES = [
  "logo",
  "ankleflap",
  "laceguardarea",
  "midsole",
  "outsole",
  "sidepanel",
  "upper",
  "laces",
] as const
type PartName = typeof PART_NAMES[number]

// 2) Human‐readable labels keyed by that same union:
const HUMAN_LABELS: Record<PartName, string> = {
  logo:          'Logo',
  ankleflap:     'Ankle Flap',
  laceguardarea: 'Lace Guard',
  midsole:       'Midsole',
  outsole:       'Outsole',
  sidepanel:     'Side Panel',
  upper:         'Upper',
  laces:         'Laces',
}

type ColorMap = Record<PartName, string>
const initialColors: ColorMap = PART_NAMES.reduce((acc, name) => {
  acc[name] = '#ffffff'
  return acc
}, {} as ColorMap)

type GLTFResult = {
  scene: Group
  nodes: Record<string, Mesh>
}

const MODEL_URL = '/jordans_1.glb'

function Model({
  colors,
  selectedPart,
  onSelectPart,
}: {
  colors: ColorMap
  selectedPart: PartName | null
  onSelectPart: (part: PartName | null) => void
}) {
  const { scene, nodes } = useGLTF(MODEL_URL) as unknown as GLTFResult

  // apply colors + add/remove outline when selectedPart changes
  useEffect(() => {
    PART_NAMES.forEach((name) => {
      const raw = nodes[name] || scene.getObjectByName(name)
      if (!raw?.isMesh) return
      const mesh = raw as Mesh

      // clone material once
      if (!mesh.userData.__cloned) {
        const originals = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material]
        const clones = originals.map((m) => m.clone())
        mesh.material = Array.isArray(mesh.material) ? clones : clones[0]
        mesh.userData.__cloned = true
      }

      // strip maps + force matte + set color
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      mats.forEach((m) => {
        if (!hasColorProp(m)) return
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
        if ('roughness' in m) (m as any).roughness = 1
        if ('metalness' in m) (m as any).metalness = 0
        m.color.set(colors[name])
        m.needsUpdate = true
      })

      // remove old outline
      if (mesh.userData.outline) {
        mesh.remove(mesh.userData.outline)
        mesh.userData.outline.geometry.dispose()
        mesh.userData.outline.material.dispose()
        delete mesh.userData.outline
      }

      // add new outline if this is selected
      if (name === selectedPart) {
        const edges = new THREE.EdgesGeometry(mesh.geometry, 15)
        const mat   = new THREE.LineBasicMaterial({ color: 0xffff00 })
        const outline = new THREE.LineSegments(edges, mat)
        outline.renderOrder = 999
        outline.material.depthTest = false
        mesh.add(outline)
        mesh.userData.outline = outline
      }
    })
  }, [colors, nodes, scene, selectedPart])

  return (
    // capture clicks on any child mesh
    <group
      onPointerDown={(e) => {
        e.stopPropagation()
        const hit = e.object.name
        if (PART_NAMES.includes(hit as PartName)) {
          onSelectPart(hit as PartName)
        } else {
          onSelectPart(null)
        }
      }}
    >
      <primitive object={scene} />
    </group>
  )
}

export default function Page() {
  const [colors, setColors] = useState<ColorMap>(initialColors)
  const [selectedPart, setSelectedPart] = useState<PartName | null>(null)

  // (Optional) listen for external color‐change messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const { part, color } = e.data as { part: string; color: string }
      if (PART_NAMES.includes(part as PartName)) {
        setColors((c) => ({ ...c, [part as PartName]: color }))
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 0, 1], fov: 35 }}
        gl={{ antialias: true, alpha: false }}
        onPointerMissed={() => setSelectedPart(null)}
      >
        <color attach="background" args={['#ffffff']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />

        <Suspense
          fallback={
            <Html center style={{ color: 'black' }}>
              Loading model…
            </Html>
          }
        >
          <Center>
            <Model
              colors={colors}
              selectedPart={selectedPart}
              onSelectPart={setSelectedPart}
            />
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
          minDistance={0.05}
          maxDistance={5}
          enablePan={false}
        />
      </Canvas>

      {selectedPart && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '0.9rem',
          }}
        >
          {HUMAN_LABELS[selectedPart]}
        </div>
      )}
    </div>
  )
}
