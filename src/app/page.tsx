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

const PART_NAMES = [
  'logo','ankleflap','laceguardarea','midsole',
  'outsole','sidepanel','upper','laces',
] as const
type PartName = typeof PART_NAMES[number]

const HUMAN_LABELS: Record<PartName, string> = {
  logo: 'Logo',
  ankleflap: 'Ankle Flap',
  laceguardarea: 'Lace Guard',
  midsole: 'Midsole',
  outsole: 'Outsole',
  sidepanel: 'Side Panel',
  upper: 'Upper',
  laces: 'Laces',
}

type ColorMap = Record<PartName, string>
const initialColors: ColorMap = PART_NAMES.reduce((acc, n) => {
  acc[n] = '#ffffff'
  return acc
}, {} as ColorMap)

type GLTFResult = { scene: Group; nodes: Record<string, Mesh> }
const MODEL_URL = '/jordans_1.glb'

function Model({
  colors,
  selectedPart,
  onSelectPart,
  interactive,
}: {
  colors: ColorMap
  selectedPart: PartName | null
  onSelectPart: (p: PartName | null) => void
  interactive: boolean
}) {
  const { scene, nodes } = useGLTF(MODEL_URL) as unknown as GLTFResult

  useEffect(() => {
    PART_NAMES.forEach((name) => {
      const raw = nodes[name] || scene.getObjectByName(name)
      if (!raw?.isMesh) return
      const mesh = raw as Mesh

      if (!mesh.userData.__cloned) {
        const orig = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        const clone = orig.map((m) => m.clone())
        mesh.material = Array.isArray(mesh.material) ? clone : clone[0]
        mesh.userData.__cloned = true
      }

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((m) => {
        if (!hasColorProp(m)) return
        ;[
          'map','normalMap','roughnessMap',
          'metalnessMap','bumpMap','aoMap',
        ].forEach((k) => (m as any)[k] && ((m as any)[k] = null))
        if ('roughness' in m) (m as any).roughness = 1
        if ('metalness' in m) (m as any).metalness = 0
        m.color.set(colors[name])
        m.needsUpdate = true
      })

      if (mesh.userData.outline) {
        mesh.remove(mesh.userData.outline)
        mesh.userData.outline.geometry.dispose()
        mesh.userData.outline.material.dispose()
        delete mesh.userData.outline
      }

      if (interactive && name === selectedPart) {
        const edges = new THREE.EdgesGeometry(mesh.geometry, 15)
        const mat   = new THREE.LineBasicMaterial({ color: 0xffff00 })
        const outline = new THREE.LineSegments(edges, mat)
        outline.renderOrder = 999
        outline.material.depthTest = false
        mesh.add(outline)
        mesh.userData.outline = outline
      }
    })
  }, [colors, nodes, scene, selectedPart, interactive])

  return (
    <group
      onPointerDown={
        interactive
          ? (e) => {
              e.stopPropagation()
              const hit = e.object.name
              if (PART_NAMES.includes(hit as PartName)) {
                onSelectPart(hit as PartName)
              } else {
                onSelectPart(null)
              }
            }
          : undefined
      }
    >
      <primitive object={scene} />
    </group>
  )
}

export default function Page() {
  const [colors, setColors] = useState<ColorMap>(initialColors)
  const [selectedPart, setSelectedPart] = useState<PartName | null>(null)
  const [interactive, setInteractive] = useState(true)

  const toggleInteractive = () => {
    if (interactive) setSelectedPart(null)
    setInteractive((v) => !v)
  }

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
      {/* Toggle + status */}
      <div className="toggle-container">
        <span className="toggle-text">
          Highlight: {interactive ? 'ON' : 'OFF'}
        </span>
        <label className="switch">
          <input
            type="checkbox"
            checked={interactive}
            onChange={toggleInteractive}
          />
          <span className="slider" />
        </label>
      </div>

      <Canvas
        camera={{ position: [0, 0, 1], fov: 35 }}
        gl={{ antialias: true, alpha: false }}
        onPointerMissed={() => interactive && setSelectedPart(null)}
      >
        <color attach="background" args={['#ffffff']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />

        <Suspense fallback={<Html center>Loading model…</Html>}>
          <Center>
            <Model
              colors={colors}
              selectedPart={selectedPart}
              onSelectPart={setSelectedPart}
              interactive={interactive}
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

      {interactive && selectedPart && (
        <div className="hud">{HUMAN_LABELS[selectedPart]}</div>
      )}

      <style jsx>{`
        .toggle-container {
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 10;
          display: flex;
          align-items: center;
        }
        .toggle-text {
          margin-right: 8px;
          font-size: 0.9rem;
          color: #222;
          user-select: none;
        }
        .switch {
          position: relative;
          display: inline-block;
          width: 50px;
          height: 24px;
        }
        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; bottom: 0; right: 0;
          background-color: #ccc;
          transition: 0.2s;
          border-radius: 12px;
        }
        .slider::before {
          content: '';
          position: absolute;
          height: 20px;
          width: 20px;
          left: 2px;
          bottom: 2px;
          background: white;
          transition: 0.2s;
          border-radius: 50%;
        }
        input:checked + .slider {
          background-color: #4caf50;
        }
        input:checked + .slider::before {
          transform: translateX(26px);
        }
        .hud {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.7);
          color: #fff;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  )
}
