'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import dynamic from 'next/dynamic'
import Controls from './components/Controls'

// Dynamic import to avoid SSR issues with Three.js
const MeshViewer = dynamic(() => import('./components/MeshViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 font-mono">Loading 3D viewer...</p>
      </div>
    </div>
  )
})

interface MeshData {
  timesteps: Array<{
    index: number
    time: number
    points: number[][]
    triangles: number[][]
  }>
  metadata: {
    total_timesteps: number
    exported_timesteps: number
    time_range: [number, number]
  }
}

function LoadingScreen({ progress }: { progress: number }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black flex items-center justify-center">
      <div className="text-center max-w-md px-8">
        <div className="relative w-32 h-32 mx-auto mb-8">
          {/* Animated cell icon */}
          <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20" />
          <div 
            className="absolute inset-0 rounded-full border-4 border-transparent border-t-cyan-400 animate-spin"
            style={{ animationDuration: '1.5s' }}
          />
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 animate-pulse" />
          <div className="absolute inset-8 rounded-full bg-cyan-400/10" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">Loading Simulation</h2>
        <p className="text-white/50 mb-6 font-mono text-sm">Cytokinesis mesh data</p>
        
        {/* Progress bar */}
        <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-white/40 mt-2 text-sm font-mono">{progress.toFixed(0)}%</p>
      </div>
    </div>
  )
}

export default function Home() {
  const [data, setData] = useState<MeshData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadProgress, setLoadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  // Playback state
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  
  // View options
  const [autoRotate, setAutoRotate] = useState(true)
  const [showWireframe, setShowWireframe] = useState(false)
  const [colorMode, setColorMode] = useState<'height' | 'curvature' | 'solid'>('height')
  
  // Load mesh data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadProgress(10)
        
        const response = await fetch('/data/mesh_data.json')
        
        if (!response.ok) {
          throw new Error(`Failed to load mesh data: ${response.status}`)
        }
        
        // Get content length for progress
        const contentLength = response.headers.get('content-length')
        const total = contentLength ? parseInt(contentLength) : 0
        
        if (total && response.body) {
          const reader = response.body.getReader()
          const chunks: Uint8Array[] = []
          let received = 0
          
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
            received += value.length
            setLoadProgress(10 + (received / total) * 80)
          }
          
          const allChunks = new Uint8Array(received)
          let position = 0
          for (const chunk of chunks) {
            allChunks.set(chunk, position)
            position += chunk.length
          }
          
          const text = new TextDecoder().decode(allChunks)
          setLoadProgress(95)
          
          const meshData = JSON.parse(text)
          setData(meshData)
        } else {
          // Fallback for browsers that don't support streaming
          const meshData = await response.json()
          setData(meshData)
        }
        
        setLoadProgress(100)
        setTimeout(() => setLoading(false), 300)
        
      } catch (err) {
        console.error('Error loading mesh data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
        setLoading(false)
      }
    }
    
    loadData()
  }, [])
  
  // Animation loop
  useEffect(() => {
    if (!isPlaying || !data) return
    
    const interval = setInterval(() => {
      setCurrentIndex(prev => {
        const next = prev + 1
        if (next >= data.timesteps.length) {
          setIsPlaying(false)
          return prev
        }
        return next
      })
    }, 100 / playbackSpeed)
    
    return () => clearInterval(interval)
  }, [isPlaying, data, playbackSpeed])
  
  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!data) return
      
      switch (e.key) {
        case ' ':
          e.preventDefault()
          setIsPlaying(p => !p)
          break
        case 'ArrowLeft':
          setCurrentIndex(prev => Math.max(0, prev - 1))
          break
        case 'ArrowRight':
          setCurrentIndex(prev => Math.min(data.timesteps.length - 1, prev + 1))
          break
        case 'Home':
          setCurrentIndex(0)
          break
        case 'End':
          setCurrentIndex(data.timesteps.length - 1)
          break
        case 'r':
          setAutoRotate(p => !p)
          break
        case 'w':
          setShowWireframe(p => !p)
          break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [data])
  
  if (loading) {
    return <LoadingScreen progress={loadProgress} />
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Error Loading Data</h2>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    )
  }
  
  if (!data) return null
  
  const currentTimestep = data.timesteps[currentIndex]
  
  return (
    <main className="relative w-full h-screen overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-6 bg-gradient-to-b from-black/80 to-transparent">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-1">
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Cytokinesis
            </span>
            <span className="text-white/60 font-normal text-lg ml-3">Cell Division Simulation</span>
          </h1>
          <p className="text-white/40 text-sm font-mono">
            Active viscous shell model • {data.metadata.exported_timesteps} frames • {data.metadata.time_range[1].toFixed(1)}s
          </p>
        </div>
      </div>
      
      {/* Stats overlay */}
      <div className="absolute top-24 right-6 z-10 bg-black/40 backdrop-blur-sm rounded-lg p-4 text-white/80 font-mono text-sm">
        <div className="space-y-1">
          <div className="flex justify-between gap-8">
            <span className="text-white/50">Vertices:</span>
            <span className="text-cyan-400">{currentTimestep.points.length.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-8">
            <span className="text-white/50">Triangles:</span>
            <span className="text-cyan-400">{currentTimestep.triangles.length.toLocaleString()}</span>
          </div>
        </div>
      </div>
      
      {/* Keyboard hints */}
      <div className="absolute top-24 left-6 z-10 bg-black/40 backdrop-blur-sm rounded-lg p-3 text-white/50 text-xs font-mono space-y-1">
        <div><kbd className="px-1.5 py-0.5 bg-white/10 rounded">Space</kbd> Play/Pause</div>
        <div><kbd className="px-1.5 py-0.5 bg-white/10 rounded">←</kbd> <kbd className="px-1.5 py-0.5 bg-white/10 rounded">→</kbd> Step</div>
        <div><kbd className="px-1.5 py-0.5 bg-white/10 rounded">R</kbd> Toggle Rotate</div>
        <div><kbd className="px-1.5 py-0.5 bg-white/10 rounded">W</kbd> Wireframe</div>
      </div>
      
      {/* 3D Viewer */}
      <MeshViewer 
        data={data}
        currentIndex={currentIndex}
        autoRotate={autoRotate}
        showWireframe={showWireframe}
        colorMode={colorMode}
      />
      
      {/* Controls */}
      <Controls
        totalFrames={data.timesteps.length}
        currentIndex={currentIndex}
        currentTime={currentTimestep.time}
        timeRange={data.metadata.time_range}
        isPlaying={isPlaying}
        autoRotate={autoRotate}
        showWireframe={showWireframe}
        colorMode={colorMode}
        playbackSpeed={playbackSpeed}
        onIndexChange={setCurrentIndex}
        onPlayToggle={() => setIsPlaying(p => !p)}
        onAutoRotateToggle={() => setAutoRotate(p => !p)}
        onWireframeToggle={() => setShowWireframe(p => !p)}
        onColorModeChange={setColorMode}
        onPlaybackSpeedChange={setPlaybackSpeed}
      />
    </main>
  )
}
