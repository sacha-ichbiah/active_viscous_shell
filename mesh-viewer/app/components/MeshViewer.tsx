'use client'

import { useRef, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

interface TimestepData {
    index: number
    time: number
    points: number[][]
    triangles: number[][]
}

interface MeshData {
    timesteps: TimestepData[]
    metadata: {
        total_timesteps: number
        exported_timesteps: number
        time_range: [number, number]
    }
}

function CellMesh({
    timestep,
    colorMode
}: {
    timestep: TimestepData
    colorMode: 'height' | 'curvature' | 'solid'
}) {
    const meshRef = useRef<THREE.Mesh>(null)

    const geometry = useMemo(() => {
        const geom = new THREE.BufferGeometry()

        // Flatten points array
        const posArray: number[] = []
        for (const p of timestep.points) {
            posArray.push(p[0], p[1], p[2])
        }
        const positions = new Float32Array(posArray)
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))

        // Flatten triangles array
        const idxArray: number[] = []
        for (const t of timestep.triangles) {
            idxArray.push(t[0], t[1], t[2])
        }
        const indices = new Uint32Array(idxArray)
        geom.setIndex(new THREE.BufferAttribute(indices, 1))

        geom.computeVertexNormals()

        // Compute colors based on z-coordinate
        const colors = new Float32Array(timestep.points.length * 3)
        let zMin = Infinity, zMax = -Infinity
        for (const p of timestep.points) {
            if (p[2] < zMin) zMin = p[2]
            if (p[2] > zMax) zMax = p[2]
        }
        const zRange = zMax - zMin || 1

        timestep.points.forEach((point, i) => {
            const t = (point[2] - zMin) / zRange

            if (colorMode === 'height') {
                // Blue to red colormap
                colors[i * 3] = t * 0.9 + 0.1
                colors[i * 3 + 1] = 0.3 + 0.4 * (1 - Math.abs(t - 0.5) * 2)
                colors[i * 3 + 2] = (1 - t) * 0.9 + 0.1
            } else if (colorMode === 'curvature') {
                // Distance from center
                const r = Math.sqrt(point[0] ** 2 + point[1] ** 2)
                const rNorm = Math.min(r / 1.2, 1)
                colors[i * 3] = 0.2 + rNorm * 0.7
                colors[i * 3 + 1] = 0.8 - rNorm * 0.5
                colors[i * 3 + 2] = 0.9 - rNorm * 0.6
            } else {
                // Solid color
                colors[i * 3] = 0.3
                colors[i * 3 + 1] = 0.7
                colors[i * 3 + 2] = 0.9
            }
        })

        geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))

        return geom
    }, [timestep, colorMode])

    return (
        <mesh ref={meshRef} geometry={geometry}>
            <meshPhongMaterial
                vertexColors
                side={THREE.DoubleSide}
                shininess={30}
                specular={new THREE.Color(0x222222)}
            />
        </mesh>
    )
}

function WireframeMesh({ timestep }: { timestep: TimestepData }) {
    const geometry = useMemo(() => {
        const geom = new THREE.BufferGeometry()
        const posArray: number[] = []
        for (const p of timestep.points) {
            posArray.push(p[0], p[1], p[2])
        }
        geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(posArray), 3))

        const idxArray: number[] = []
        for (const t of timestep.triangles) {
            idxArray.push(t[0], t[1], t[2])
        }
        geom.setIndex(new THREE.BufferAttribute(new Uint32Array(idxArray), 1))
        return geom
    }, [timestep])

    return (
        <lineSegments>
            <wireframeGeometry args={[geometry]} />
            <lineBasicMaterial color="#22d3ee" />
        </lineSegments>
    )
}

function Scene({
    timestep
}: {
    timestep: TimestepData
}) {

    return (
        <>
            <color attach="background" args={['#1a1a2e']} />

            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 5, 5]} intensity={1.2} />
            <directionalLight position={[-5, 3, -5]} intensity={0.5} />
            <pointLight position={[0, 0, 3]} intensity={0.5} color="#ffffff" />

            <group rotation={[Math.PI / 2, 0, 0]}>
                <WireframeMesh timestep={timestep} />
            </group>

            <OrbitControls
                enableDamping
                dampingFactor={0.05}
                minDistance={1}
                maxDistance={10}
                target={[0, 0, 0]}
            />
        </>
    )
}

export default function MeshViewer({
    data,
    currentIndex
}: {
    data: MeshData
    currentIndex: number
}) {
    const timestep = data.timesteps[currentIndex]

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 0
            }}
        >
            <Canvas
                camera={{ position: [0, 0, 4], fov: 45, near: 0.1, far: 100 }}
                gl={{
                    antialias: true,
                    alpha: false,
                    powerPreference: 'high-performance'
                }}
                dpr={[1, 2]}
                style={{ width: '100%', height: '100%' }}
                onCreated={({ gl }) => {
                    gl.setClearColor('#1a1a2e')
                    console.log('Canvas created successfully')
                }}
            >
                <Scene timestep={timestep} />
            </Canvas>
        </div>
    )
}
