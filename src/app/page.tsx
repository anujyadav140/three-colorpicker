'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useGLTF, Html, OrbitControls, Center } from '@react-three/drei'
import * as THREE from 'three'
import type { Group, Mesh, MeshStandardMaterial } from 'three'

// --- types & constants ---
export type PartName =
  | 'logo'
  | 'ankleflap'
  | 'laceguardarea'
  | 'midsole'
  | 'outsole'
  | 'sidepanel'
  | 'upper'
  | 'laces'

const PART_NAMES: PartName[] = [
  'logo',
  'ankleflap',
  'laceguardarea',
  'midsole',
  'outsole',
  'sidepanel',
  'upper',
  'laces',
]

export interface Mapping {
  offsetX: number
  offsetY: number
  scale: number
}

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
const initialColors: ColorMap = PART_NAMES.reduce(
  (acc, p) => ({ ...acc, [p]: '#ffffff' }),
  {} as ColorMap
)

type TextureMap = Record<PartName, string | null>
const initialTextures: TextureMap = PART_NAMES.reduce(
  (acc, p) => ({ ...acc, [p]: null }),
  {} as TextureMap
)

const initialMappings: Record<PartName, Mapping> = PART_NAMES.reduce(
  (acc, p) => ({ ...acc, [p]: { offsetX: 0, offsetY: 0, scale: 1 } }),
  {} as Record<PartName, Mapping>
)

interface GLTFResult {
  scene: Group
  nodes: Record<string, Mesh>
}
const MODEL_URL = '/jordans_1.glb'

// --- Model component ---
function Model({
  colors,
  textures,
  mappings,
  selectedPart,
  onSelectPart,
  interactive,
}: {
  colors: ColorMap
  textures: TextureMap
  mappings: Record<PartName, Mapping>
  selectedPart: PartName | null
  onSelectPart: (p: PartName | null) => void
  interactive: boolean
}) {
  const { scene, nodes } = useGLTF(MODEL_URL) as unknown as GLTFResult
  const { gl } = useThree()

  useEffect(() => {
    const loader = new THREE.TextureLoader()
    const maxAniso = gl.capabilities.getMaxAnisotropy()

    PART_NAMES.forEach((name) => {
      const obj = nodes[name] || scene.getObjectByName(name)
      if (!obj?.isMesh) return
      const mesh = obj as Mesh

      // Clone material
      if (!mesh.userData.cloned) {
        const originals = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material]
        const clones = originals.map((m) => m.clone() as MeshStandardMaterial)
        mesh.material = Array.isArray(mesh.material) ? clones : clones[0]
        mesh.userData.cloned = true
      }

      const materials = Array.isArray(mesh.material)
        ? (mesh.material as MeshStandardMaterial[])
        : [mesh.material as MeshStandardMaterial]

      materials.forEach((mat) => {
        mat.map = null

        if (textures[name]) {
          const tex = loader.load(textures[name]!)
          tex.flipY = false
          tex.wrapS = THREE.RepeatWrapping
          tex.wrapT = THREE.RepeatWrapping
          tex.anisotropy = maxAniso
          mat.map = tex
          mat.color.set('#ffffff')
        } else {
          mat.color.set(colors[name])
        }

        // Always apply mapping when there is a map
        if (mat.map) {
          const { offsetX, offsetY, scale } = mappings[name]
          const tile = 2 * scale
          mat.map.repeat.set(tile, tile)
          mat.map.offset.set(offsetX, offsetY)
        }

        mat.roughness = 1
        mat.metalness = 0
        mat.needsUpdate = true
      })

      // Highlight outline
      if (mesh.userData.outline) {
        mesh.remove(mesh.userData.outline)
        mesh.userData.outline.geometry.dispose()
        mesh.userData.outline.material.dispose()
        delete mesh.userData.outline
      }
      if (interactive && name === selectedPart) {
        const edges = new THREE.EdgesGeometry(mesh.geometry, 15)
        const outlineMat = new THREE.LineBasicMaterial({ color: 0xffff00 })
        const outline = new THREE.LineSegments(edges, outlineMat)
        outline.renderOrder = 999
        outline.material.depthTest = false
        mesh.add(outline)
        mesh.userData.outline = outline
      }
    })
  }, [textures, colors, mappings, nodes, scene, selectedPart, interactive, gl])

  return (
    <group
      onPointerDown={
        interactive
          ? (e) => {
              e.stopPropagation()
              const hit = e.object.name as PartName
              onSelectPart(PART_NAMES.includes(hit) ? hit : null)
            }
          : undefined
      }
    >
      <primitive object={scene} />
    </group>
  )
}

// --- Page component ---
export default function Page() {
  const [colors, setColors] = useState<ColorMap>(initialColors)
  const [textures, setTextures] = useState<TextureMap>(initialTextures)
  const [mappings, setMappings] = useState(initialMappings)
  const [selectedPart, setSelectedPart] = useState<PartName | null>(null)
  const [interactive, setInteractive] = useState(true)

  const toggleInteractive = () => {
    if (interactive) setSelectedPart(null)
    setInteractive((v) => !v)
  }

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      console.log('📩 from Flutter', e.data)
      const { part, color, mapping, image } = e.data as {
        part: string
        color?: string
        mapping?: Mapping
        image?: string
      }
      if (!PART_NAMES.includes(part as PartName)) return

      if (color) {
        setColors((c) => ({ ...c, [part as PartName]: color }))
        setTextures((t) => ({ ...t, [part as PartName]: null }))
      }

      if (mapping) {
        console.log(`‣ applying mapping to ${part}`, mapping)
        setMappings((m) => ({ ...m, [part as PartName]: mapping }))
      }

      if (image) {
        // image is now a URL string
        setTextures((t) => ({ ...t, [part as PartName]: image }))
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
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
              textures={textures}
              mappings={mappings}
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
        }
        .switch {
          position: relative;
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
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #ccc;
          border-radius: 12px;
          transition: 0.2s;
        }
        .slider::before {
          content: '';
          position: absolute;
          width: 20px;
          height: 20px;
          left: 2px;
          bottom: 2px;
          background: #fff;
          border-radius: 50%;
          transition: 0.2s;
        }
        input:checked + .slider {
          background: #4caf50;
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
          padding: 8px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  )
}
