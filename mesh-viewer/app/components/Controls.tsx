'use client'

import { useState, useEffect, useCallback } from 'react'

interface ControlsProps {
  totalFrames: number
  currentIndex: number
  currentTime: number
  timeRange: [number, number]
  isPlaying: boolean
  autoRotate: boolean
  showWireframe: boolean
  colorMode: 'height' | 'curvature' | 'solid'
  playbackSpeed: number
  onIndexChange: (index: number) => void
  onPlayToggle: () => void
  onAutoRotateToggle: () => void
  onWireframeToggle: () => void
  onColorModeChange: (mode: 'height' | 'curvature' | 'solid') => void
  onPlaybackSpeedChange: (speed: number) => void
}

export default function Controls({
  totalFrames,
  currentIndex,
  currentTime,
  timeRange,
  isPlaying,
  autoRotate,
  showWireframe,
  colorMode,
  playbackSpeed,
  onIndexChange,
  onPlayToggle,
  onAutoRotateToggle,
  onWireframeToggle,
  onColorModeChange,
  onPlaybackSpeedChange
}: ControlsProps) {
  
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-6 pt-16">
      {/* Timeline */}
      <div className="max-w-4xl mx-auto">
        {/* Time display */}
        <div className="flex justify-between items-center mb-3 text-white/90 font-mono">
          <span className="text-sm">t = {currentTime.toFixed(2)}s</span>
          <span className="text-xs text-white/50">
            Frame {currentIndex + 1} / {totalFrames}
          </span>
          <span className="text-sm">{timeRange[1].toFixed(1)}s</span>
        </div>
        
        {/* Slider */}
        <div className="relative mb-4">
          <input
            type="range"
            min={0}
            max={totalFrames - 1}
            value={currentIndex}
            onChange={(e) => onIndexChange(parseInt(e.target.value))}
            className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-5
                     [&::-webkit-slider-thumb]:h-5
                     [&::-webkit-slider-thumb]:bg-cyan-400
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(34,211,238,0.5)]
                     [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-webkit-slider-thumb]:transition-transform
                     [&::-webkit-slider-thumb]:hover:scale-125"
          />
          {/* Progress bar */}
          <div 
            className="absolute top-0 left-0 h-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full pointer-events-none"
            style={{ width: `${(currentIndex / (totalFrames - 1)) * 100}%` }}
          />
        </div>
        
        {/* Controls row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Play controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onIndexChange(0)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Reset"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
            
            <button
              onClick={onPlayToggle}
              className="p-3 rounded-full bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/30 transition-all hover:scale-105"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            
            <button
              onClick={() => onIndexChange(totalFrames - 1)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="End"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
            
            {/* Speed control */}
            <select
              value={playbackSpeed}
              onChange={(e) => onPlaybackSpeedChange(parseFloat(e.target.value))}
              className="bg-white/10 text-white text-sm rounded-lg px-2 py-1.5 border border-white/20 cursor-pointer"
            >
              <option value={0.25}>0.25x</option>
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={4}>4x</option>
            </select>
          </div>
          
          {/* View options */}
          <div className="flex items-center gap-3">
            <button
              onClick={onAutoRotateToggle}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                autoRotate 
                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50' 
                  : 'bg-white/10 text-white/70 border border-white/10 hover:bg-white/20'
              }`}
            >
              🔄 Rotate
            </button>
            
            <button
              onClick={onWireframeToggle}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                showWireframe 
                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50' 
                  : 'bg-white/10 text-white/70 border border-white/10 hover:bg-white/20'
              }`}
            >
              ◇ Wireframe
            </button>
            
            {/* Color mode */}
            <div className="flex rounded-lg overflow-hidden border border-white/20">
              {(['height', 'curvature', 'solid'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onColorModeChange(mode)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    colorMode === mode
                      ? 'bg-cyan-500 text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

