"use client"

import { MeshGradient } from "@paper-design/shaders-react"

export default function BackgroundPaperShaders() {
  return (
    <div className="fixed inset-0 w-full h-screen pointer-events-none bg-black" style={{ zIndex: 0 }}>
      <MeshGradient
        className="w-full h-full absolute inset-0"
        colors={["#000000", "#000000", "#03040f", "#080c24"]}
        speed={0.8}
      />
    </div>
  )
}
