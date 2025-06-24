// src/app/page.tsx
'use client'

import React, { useState, useEffect, Suspense, useCallback } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useGLTF, Html, OrbitControls, Center } from '@react-three/drei'
import * as THREE from 'three'
import type { Group, Mesh, MeshStandardMaterial } from 'three'
import Cropper from 'react-easy-crop'


// Define the parts of the shoe
type PartName =
  | 'logo' | 'ankleflap' | 'laceguardarea'
  | 'midsole' | 'outsole' | 'sidepanel' | 'upper' | 'laces'

const PART_NAMES: PartName[] = [
  'logo','ankleflap','laceguardarea','midsole',
  'outsole','sidepanel','upper','laces',
]

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

// Mapping parameters for textures
interface Mapping { offsetX: number; offsetY: number; scale: number }
const initialMappings: Record<PartName, Mapping> = PART_NAMES.reduce(
  (acc, p) => ({ ...acc, [p]: { offsetX: 0, offsetY: 0, scale: 1 } }),
  {} as Record<PartName, Mapping>
)

interface GLTFResult { scene: Group; nodes: Record<string, Mesh> }
const MODEL_URL = '/jordans_1.glb'

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

      if (!mesh.userData.cloned) {
        const originals = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material]
        const clones = originals.map((m) => (m.clone() as MeshStandardMaterial))
        mesh.material = Array.isArray(mesh.material) ? clones : clones[0]
        mesh.userData.cloned = true
      }

      const materials = Array.isArray(mesh.material)
        ? mesh.material as MeshStandardMaterial[]
        : [mesh.material as MeshStandardMaterial]

      materials.forEach((mat) => {
        mat.map = null
        if (textures[name]) {
          const tex = loader.load(textures[name]!)
          tex.flipY = false
          tex.wrapS = THREE.RepeatWrapping
          tex.wrapT = THREE.RepeatWrapping
          tex.anisotropy = maxAniso

          const { offsetX, offsetY, scale } = mappings[name]
          const tile = 2 * scale
          tex.repeat.set(tile, tile)
          tex.offset.set(offsetX, offsetY)

          mat.map = tex
          mat.color.set('#ffffff')
        } else {
          mat.color.set(colors[name])
        }
        mat.roughness = 1
        mat.metalness = 0
        mat.needsUpdate = true
      })

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

export default function Page() {
  const [colors, setColors] = useState<ColorMap>(initialColors)
  const [textures, setTextures] = useState<TextureMap>(initialTextures)
  const [mappings, setMappings] = useState(initialMappings)
  const [selectedPart, setSelectedPart] = useState<PartName | null>(null)
  const [interactive, setInteractive] = useState(true)

  // Cropping states
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [showCrop, setShowCrop] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState<{ x: number; y: number; width: number; height: number } | null>(null)

  const toggleInteractive = () => {
    if (interactive) setSelectedPart(null)
    setInteractive((v) => !v)
  }

  // External postMessage handler
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const { part, color, image } = e.data as { part: string; color?: string; image?: string }
      if (!PART_NAMES.includes(part as PartName)) return
      if (color) {
        setColors((c) => ({ ...c, [part as PartName]: color }))
        setTextures((t) => ({ ...t, [part as PartName]: null }))
      }
      if (image) {
        setTextures((t) => ({ ...t, [part as PartName]: image }))
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedPart) return
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
      setShowCrop(true)
    }
    reader.readAsDataURL(file)
  }

  const onCropComplete = useCallback((_: any, cp: any) => setCroppedAreaPixels(cp), [])

  const applyCrop = useCallback(async () => {
    if (imageSrc && croppedAreaPixels && selectedPart) {
      try {
        const blob = await getCroppedImg(imageSrc, croppedAreaPixels)
        const url = URL.createObjectURL(blob)
        setTextures((t) => ({ ...t, [selectedPart]: url }))
      } catch (e) {
        console.error(e)
      }
    }
    setShowCrop(false)
    setImageSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }, [imageSrc, croppedAreaPixels, selectedPart])

  const cancelCrop = () => {
    setShowCrop(false)
    setImageSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }

  // Mapping controls
  const updateMapping = (key: keyof Mapping, value: number) => {
    if (!selectedPart) return
    setMappings((m) => ({
      ...m,
      [selectedPart]: { ...m[selectedPart], [key]: value },
    }))
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div className="toggle-container">
        <span className="toggle-text">Highlight: {interactive ? 'ON' : 'OFF'}</span>
        <label className="switch">
          <input type="checkbox" checked={interactive} onChange={toggleInteractive} />
          <span className="slider" />
        </label>
      </div>

      <Canvas
        camera={{ position: [0, 0, 1], fov: 35 }}
        gl={{ antialias: true, alpha: false }}
        onPointerMissed={() => interactive && setSelectedPart(null)}
      >
        <color attach="background" args={["#ffffff"]} />
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
        <OrbitControls makeDefault target={[0,0,0]} enableDamping dampingFactor={0.1} minPolarAngle={0} maxPolarAngle={Math.PI} enableZoom zoomSpeed={1} minDistance={0.05} maxDistance={5} enablePan={false} />
      </Canvas>

      {interactive && selectedPart && (
        <div className="hud">
          <div>{HUMAN_LABELS[selectedPart]}</div>
          <input type="file" accept="image/*" onChange={onFileChange} style={{ marginTop: '8px' }} />

          {textures[selectedPart] && (
            <div className="controls">
              <label>
                Offset X:
                <input type="range" min={-1} max={1} step={0.01} value={mappings[selectedPart].offsetX} onChange={e => updateMapping('offsetX', parseFloat(e.target.value))} />
              </label>
              <label>
                Offset Y:
                <input type="range" min={-1} max={1} step={0.01} value={mappings[selectedPart].offsetY} onChange={e => updateMapping('offsetY', parseFloat(e.target.value))} />
              </label>
              <label>
                Scale:
                <input type="range" min={0.5} max={5} step={0.1} value={mappings[selectedPart].scale} onChange={e => updateMapping('scale', parseFloat(e.target.value))} />
              </label>
            </div>
          )}
        </div>
      )}

      {showCrop && imageSrc && (
        <div className="crop-modal">
          <div className="cropper-container">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="crop-actions">
            <button onClick={cancelCrop}>Cancel</button>
            <button onClick={applyCrop}>Apply</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .toggle-container { position:absolute; top:20px; right:20px; z-index:10; display:flex; align-items:center; }
        .toggle-text { margin-right:8px; font-size:0.9rem; color:#222; user-select:none; }
        .switch { position:relative; display:inline-block; width:50px; height:24px; }
        .switch input { opacity:0; width:0; height:0; }
        .slider { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background:#ccc; transition:0.2s; border-radius:12px; }
        .slider::before { content:""; position:absolute; width:20px; height:20px; left:2px; bottom:2px; background:#fff; transition:0.2s; border-radius:50%; }
        input:checked + .slider { background:#4caf50; }
        input:checked + .slider::before { transform:translateX(26px); }
        .hud { position:absolute; bottom:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.7); color:#fff; padding:8px; border-radius:4px; display:flex; flex-direction:column; gap:8px; }
        .controls label { display:flex; flex-direction:column; font-size:0.8rem; }
        .crop-modal { position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:20; }
        .cropper-container { width:300px; height:300px; position:relative; background:#333; }
        .crop-actions { margin-top:16px; display:flex; gap:8px; }
        .crop-actions button { padding:8px 16px; border:none; background:#4caf50; color:#fff; border-radius:4px; cursor:pointer; }
        .crop-actions button:hover { opacity:0.9; }
      `}</style>
    </div>
  )
}


// src/utils/cropImage.ts
/**
 * Crop an image given source and cropping rectangle, returning a Blob.
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<Blob> {
  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.setAttribute('crossOrigin', 'anonymous')
      img.onload = () => resolve(img)
      img.onerror = (err) => reject(err)
      img.src = url
    })

  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')!

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas is empty'))
    }, 'image/png')
  })
}
