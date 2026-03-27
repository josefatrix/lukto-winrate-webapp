import React, { Suspense, useMemo, useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, Environment, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { AvatarFigure, createAvatarState, SKIN_TONES, BOOT_COLORS } from './AvatarFigure'

const JERSEY_THEMES = {
  base_green: { body: '#16a34a', accent: '#86efac', shoulder: '#14532d', collar: '#e2e8f0' },
  classic_stripes: { mode: 'stripes', body: '#f8fafc', stripe: '#dc2626', accent: '#dc2626', shoulder: '#b91c1c', collar: '#1e3a8a' },
  blackout: { body: '#111827', accent: '#374151', shoulder: '#020617', collar: '#22d3ee' },
  mint_wave: { body: '#0f766e', accent: '#34d399', shoulder: '#115e59', collar: '#ecfeff' },
  junior: { mode: 'stripes', body: '#ffffff', stripe: '#dc2626', accent: '#1e3a8a', shoulder: '#dc2626', collar: '#dc2626', shorts: '#1e3a8a' },
}

const HairMesh = ({ style, color }) => {
  const material = <meshStandardMaterial color={color || '#1f2937'} roughness={0.9} />
  switch (style) {
    case 'buzz':
      return (
        <mesh position={[0, 0.55, 0]}>
          <sphereGeometry args={[0.42, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          {material}
        </mesh>
      )
    case 'long':
      return (
        <group position={[0, 0.7, -0.1]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.9, 0.4, 0.9]} />
            {material}
          </mesh>
          <mesh position={[0, -0.4, -0.2]}>
            <boxGeometry args={[1.0, 0.8, 0.3]} />
            {material}
          </mesh>
        </group>
      )
    case 'short':
    default:
      return (
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.35, 0.41, 0.3, 16]} />
          {material}
        </mesh>
      )
  }
}

const Pedestal = () => {
  return (
    <group position={[0, -1.95, 0]}>
      {/* Base Floor */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[2.5, 2.7, 0.2, 32]} />
        <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.8} />
      </mesh>
      {/* Neon Ring */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[2.4, 2.4, 0.05, 32]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
      {/* Inner Grass/Turf core */}
      <mesh receiveShadow position={[0, 0.11, 0]}>
        <cylinderGeometry args={[2.3, 2.3, 0.02, 32]} />
        <meshStandardMaterial color="#16a34a" roughness={1} />
      </mesh>
    </group>
  )
}

const AnimatedSoccerPlayer = ({ loadout, animationState = 'juggling' }) => {
  const { loadout: resolvedLoadout } = useMemo(() => createAvatarState({ loadout }), [loadout])

  const jersey = JERSEY_THEMES[resolvedLoadout.jersey] || JERSEY_THEMES.base_green
  const skinTone = SKIN_TONES[resolvedLoadout.skinTone] || SKIN_TONES.medium
  const bootsColor = BOOT_COLORS[resolvedLoadout.boots] || BOOT_COLORS.black
  const isNeonBoot = resolvedLoadout.boots === 'neon'

  const [logos, setLogos] = useState({ crest: null, sponsor: null })

  // Preload real images for the textures
  useEffect(() => {
    if (resolvedLoadout.jersey !== 'junior') return

    const loadImg = (src) => new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null) // Silently fail
      img.src = src
    })

    Promise.all([
      loadImg('/avatars/badges/junior_crest.png'),
      loadImg('/avatars/badges/aguila_logo.png')
    ]).then(([crest, sponsor]) => {
      setLogos({ crest, sponsor })
    })
  }, [resolvedLoadout.jersey])

  // Refs for IK animation
  const rootRef = useRef()
  const torsoRef = useRef()
  const headRef = useRef()

  const leftShoulderRef = useRef()
  const rightShoulderRef = useRef()
  const leftElbowRef = useRef()
  const rightElbowRef = useRef()

  const leftHipRef = useRef()
  const rightHipRef = useRef()
  const leftKneeRef = useRef()
  const rightKneeRef = useRef()

  const ballRef = useRef()

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 4 // base speed

    if (!rootRef.current || !leftHipRef.current || !rightHipRef.current || !ballRef.current) return

    // Reset rotations to prevent compounding across state changes
    [leftHipRef, rightHipRef, leftKneeRef, rightKneeRef, leftShoulderRef, rightShoulderRef, leftElbowRef, rightElbowRef].forEach(ref => {
      ref.current.rotation.set(0, 0, 0)
    })
    ballRef.current.visible = true

    if (animationState === 'juggling') {
      const cycle = t % (Math.PI * 2)
      const isLeftKick = cycle < Math.PI

      rootRef.current.position.y = Math.sin(t * 2) * 0.1 // bobbing

      leftShoulderRef.current.rotation.z = Math.sin(t) * 0.2 + 0.3
      rightShoulderRef.current.rotation.z = -Math.sin(t) * 0.2 - 0.3
      leftShoulderRef.current.rotation.x = Math.sin(t) * 0.2
      rightShoulderRef.current.rotation.x = -Math.sin(t) * 0.2

      leftElbowRef.current.rotation.x = -0.5 + Math.sin(t) * 0.2
      rightElbowRef.current.rotation.x = -0.5 - Math.sin(t) * 0.2

      if (isLeftKick) {
        leftHipRef.current.rotation.x = -Math.sin(cycle) * 1.5
        leftKneeRef.current.rotation.x = Math.sin(cycle) * 1.2
      } else {
        rightHipRef.current.rotation.x = -Math.sin(cycle - Math.PI) * 1.5
        rightKneeRef.current.rotation.x = Math.sin(cycle - Math.PI) * 1.2
      }

      const bounceHeight = Math.abs(Math.sin(t)) * 1.5
      const bounceX = isLeftKick ? 0.3 : -0.3
      ballRef.current.position.set(Math.sin(t) * 0.3, bounceHeight - 1.2, 0.5 + Math.abs(Math.sin(t)) * 0.2)
      ballRef.current.rotation.set(t * 2, t * 1.5, 0)

      headRef.current.rotation.set(Math.sin(t) * 0.2 - 0.1, Math.sin(t) * 0.3, 0)

    } else if (animationState === 'idle') {
      // Idle Breathing Loop
      const idleT = clock.getElapsedTime() * 2 // Slower breathing
      ballRef.current.position.set(0.5, -1.6, 0.5) // Ball rests on the ground next to foot
      ballRef.current.rotation.set(0, 0, 0)

      rootRef.current.position.y = Math.sin(idleT) * 0.05

      leftShoulderRef.current.rotation.z = 0.1
      rightShoulderRef.current.rotation.z = -0.1
      leftShoulderRef.current.rotation.x = Math.sin(idleT) * 0.05
      rightShoulderRef.current.rotation.x = -Math.sin(idleT) * 0.05

      leftElbowRef.current.rotation.x = -0.1
      rightElbowRef.current.rotation.x = -0.1

      headRef.current.rotation.set(Math.sin(idleT * 0.5) * 0.1, Math.sin(idleT * 0.3) * 0.2, 0) // Looking around slightly
    } else if (animationState === 'celebrate') {
      // Goal Celebration Loop
      const celT = clock.getElapsedTime() * 6
      ballRef.current.visible = false // Ball not needed for celebration usually

      rootRef.current.position.y = Math.abs(Math.sin(celT)) * 0.3 // Jumping up and down

      leftShoulderRef.current.rotation.set(0, 0, Math.PI - 0.5 + Math.sin(celT) * 0.2) // Arms up
      rightShoulderRef.current.rotation.set(0, 0, -Math.PI + 0.5 - Math.sin(celT) * 0.2) // Arms up

      leftHipRef.current.rotation.x = -0.2
      rightHipRef.current.rotation.x = 0.2
      leftKneeRef.current.rotation.x = 0.2
      rightKneeRef.current.rotation.x = 0.2

      headRef.current.rotation.set(-0.2, Math.sin(celT * 0.5) * 0.3, 0)
    }
  })

  // Base Texture (Stripes)
  const stripeTexture = useMemo(() => {
    if (typeof document === 'undefined') return null
    if (jersey.mode !== 'stripes' || !jersey.stripe) return null

    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 512
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = jersey.body || '#ffffff'
    ctx.fillRect(0, 0, 1024, 512)

    ctx.fillStyle = jersey.stripe
    const stripes = 9
    const stripeW = 1024 / (stripes * 2 - 1)
    for (let i = 0; i < stripes; i++) {
      ctx.fillRect(i * stripeW * 2, 0, stripeW, 512)
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(1.5, 1) // Adjusted for RoundedBox UVs
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
  }, [jersey])

  // Front Decal Texture (Transparent background with Logos)
  const frontDecalTexture = useMemo(() => {
    if (typeof document === 'undefined') return null
    if (resolvedLoadout.jersey !== 'junior') return null

    const canvas = document.createElement('canvas')
    const w = 512; const h = 512
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')

    // Completely transparent background
    ctx.clearRect(0, 0, w, h)

    // Sponsor Logo
    if (logos.sponsor) {
      const sw = w * 0.8
      const sh = (logos.sponsor.height / logos.sponsor.width) * sw
      ctx.drawImage(logos.sponsor, (w - sw) / 2, h * 0.4, sw, sh)
    } else {
      const boxW = w * 0.9
      const boxH = h * 0.35
      const boxX = (w - boxW) / 2
      const boxY = h * 0.4
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(boxX, boxY, boxW, boxH)
      ctx.strokeStyle = jersey.accent || '#1e3a8a'
      ctx.lineWidth = w * 0.02
      ctx.strokeRect(boxX, boxY, boxW, boxH)

      ctx.fillStyle = jersey.accent || '#1e3a8a'
      ctx.textAlign = 'center'
      ctx.font = `bold ${h * 0.09}px sans-serif`
      ctx.fillText('CERVEZA', w / 2, boxY + boxH * 0.45)
      ctx.font = `900 ${h * 0.14}px sans-serif`
      ctx.letterSpacing = '-1px'
      ctx.fillText('AGUILA', w / 2, boxY + boxH * 0.85)
    }

    // Crest
    if (logos.crest) {
      const cw = w * 0.25
      const ch = (logos.crest.height / logos.crest.width) * cw
      ctx.drawImage(logos.crest, w * 0.65, h * 0.1, cw, ch)
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
  }, [logos, resolvedLoadout.jersey, jersey])

  const backDecalTexture = useMemo(() => {
    if (typeof document === 'undefined') return null
    if (resolvedLoadout.jersey !== 'junior') return null

    const canvas = document.createElement('canvas')
    canvas.width = 512; canvas.height = 512
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, 512, 512)

    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(256, 256, 180, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = jersey.accent || '#1e3a8a'
    ctx.textAlign = 'center'
    ctx.font = `900 ${512 * 0.45}px sans-serif`
    ctx.fillText('10', 256, 256 + 60)

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
  }, [resolvedLoadout.jersey, jersey])

  // Simple materials
  const jerseyMaterial = <meshStandardMaterial color={stripeTexture ? '#ffffff' : jersey.body} map={stripeTexture} roughness={0.8} />
  const sleeveMaterial = <meshStandardMaterial color={jersey.shoulder || jersey.body} roughness={0.8} />
  const sockMaterial = <meshStandardMaterial color={jersey.body} roughness={0.8} />
  const shortsMaterial = <meshStandardMaterial color={jersey.shorts || jersey.shoulder || '#1e293b'} roughness={0.9} />
  const skinMaterial = <meshStandardMaterial color={skinTone} roughness={0.6} />
  const bootsMaterial = <meshStandardMaterial color={bootsColor} roughness={0.4} metalness={0.2} emissive={isNeonBoot ? bootsColor : '#000'} emissiveIntensity={isNeonBoot ? 0.8 : 0} />
  const ballMaterial = <meshStandardMaterial color="#ffffff" roughness={0.4} />

  // Measurements
  const torsoArgs = [0.8, 1.2, 0.4]
  const headSize = 0.4

  return (
    <group position={[0, 1.6, 0]}>
      {/* Root Node (Hips) */}
      <group ref={rootRef}>

        {/* Pelvis/Shorts Base */}
        <mesh position={[0, -0.6, 0]}>
          <boxGeometry args={[0.85, 0.4, 0.45]} />
          {shortsMaterial}
        </mesh>

        {/* Torso */}
        <group ref={torsoRef}>
          <RoundedBox args={torsoArgs} radius={0.1} smoothness={2} position={[0, 0, 0]}>
            {jerseyMaterial}
          </RoundedBox>

          {/* Front Decal (Logos) */}
          {frontDecalTexture && (
            <mesh position={[0, 0, 0.21]}>
              <planeGeometry args={[0.7, 0.7]} />
              <meshStandardMaterial map={frontDecalTexture} transparent={true} depthWrite={false} polygonOffset={true} polygonOffsetFactor={-1} />
            </mesh>
          )}

          {/* Back Decal (Number) */}
          {backDecalTexture && (
            <mesh position={[0, 0, -0.21]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[0.7, 0.7]} />
              <meshStandardMaterial map={backDecalTexture} transparent={true} depthWrite={false} polygonOffset={true} polygonOffsetFactor={-1} />
            </mesh>
          )}

          {/* Collar detail */}
          <mesh position={[0, 0.61, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.05, 16]} />
            <meshStandardMaterial color={jersey.collar || jersey.accent} />
          </mesh>

          {/* Neck & Head */}
          <group position={[0, 0.7, 0]} ref={headRef}>
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[0.15, 0.15, 0.2, 16]} />
              {skinMaterial}
            </mesh>
            <mesh position={[0, 0.4, 0]}>
              <sphereGeometry args={[headSize, 32, 32]} />
              {skinMaterial}
            </mesh>
            {/* Eyes */}
            <mesh position={[-0.15, 0.45, 0.35]}>
              <sphereGeometry args={[0.04, 16, 16]} />
              <meshStandardMaterial color="#000000" />
            </mesh>
            <mesh position={[0.15, 0.45, 0.35]}>
              <sphereGeometry args={[0.04, 16, 16]} />
              <meshStandardMaterial color="#000000" />
            </mesh>
            {/* Dynamic Hair */}
            <HairMesh style={resolvedLoadout.hair} />
          </group>

          {/* Left Arm (Player's Left) */}
          <group position={[0.55, 0.5, 0]} ref={leftShoulderRef}>
            {/* Sleeve */}
            <mesh position={[0, -0.2, 0]}>
              <cylinderGeometry args={[0.2, 0.18, 0.4, 8]} />
              {sleeveMaterial}
            </mesh>
            {/* Upper Arm */}
            <mesh position={[0, -0.35, 0]}>
              <cylinderGeometry args={[0.14, 0.12, 0.7, 8]} />
              {skinMaterial}
            </mesh>
            {/* Elbow Joint */}
            <group position={[0, -0.7, 0]} ref={leftElbowRef}>
              <mesh position={[0, -0.35, 0]}>
                <cylinderGeometry args={[0.12, 0.1, 0.7, 8]} />
                {skinMaterial}
              </mesh>
              {/* Hand */}
              <mesh position={[0, -0.75, 0]}>
                <sphereGeometry args={[0.12, 16, 16]} />
                {skinMaterial}
              </mesh>
            </group>
          </group>

          {/* Right Arm (Player's Right) */}
          <group position={[-0.55, 0.5, 0]} ref={rightShoulderRef}>
            {/* Sleeve */}
            <mesh position={[0, -0.2, 0]}>
              <cylinderGeometry args={[0.2, 0.18, 0.4, 8]} />
              {sleeveMaterial}
            </mesh>
            {/* Upper Arm */}
            <mesh position={[0, -0.35, 0]}>
              <cylinderGeometry args={[0.14, 0.12, 0.7, 8]} />
              {skinMaterial}
            </mesh>
            {/* Elbow Joint */}
            <group position={[0, -0.7, 0]} ref={rightElbowRef}>
              <mesh position={[0, -0.35, 0]}>
                <cylinderGeometry args={[0.12, 0.1, 0.7, 8]} />
                {skinMaterial}
              </mesh>
              {/* Hand */}
              <mesh position={[0, -0.75, 0]}>
                <sphereGeometry args={[0.12, 16, 16]} />
                {skinMaterial}
              </mesh>
            </group>
          </group>
        </group>

        {/* Legs */}
        {[[0.22, leftHipRef, leftKneeRef], [-0.22, rightHipRef, rightKneeRef]].map(([xPos, hipRef, kneeRef], i) => (
          <group position={[xPos, -0.8, 0]} ref={hipRef} key={i}>
            <mesh position={[0, -0.2, 0]}>
              <cylinderGeometry args={[0.22, 0.2, 0.5, 8]} />
              {shortsMaterial}
            </mesh>
            <mesh position={[0, -0.45, 0]}>
              <cylinderGeometry args={[0.18, 0.15, 0.9, 8]} />
              {skinMaterial}
            </mesh>
            <group position={[0, -0.9, 0]} ref={kneeRef}>
              <mesh position={[0, -0.45, 0]}>
                <cylinderGeometry args={[0.14, 0.1, 0.9, 8]} />
                {skinMaterial}
              </mesh>
              <mesh position={[0, -0.5, 0]}>
                <cylinderGeometry args={[0.15, 0.12, 0.6, 8]} />
                {sockMaterial}
              </mesh>
              <mesh position={[0, -0.95, 0.1]}>
                <boxGeometry args={[0.25, 0.2, 0.4]} />
                {bootsMaterial}
              </mesh>
              <mesh position={[0, -1.05, 0.1]}>
                <boxGeometry args={[0.2, 0.05, 0.3]} />
                <meshStandardMaterial color="#fff" roughness={0.2} metalness={0.8} />
              </mesh>
            </group>
          </group>
        ))}
      </group>

      {/* The Ball */}
      <group ref={ballRef}>
        <mesh>
          <sphereGeometry args={[0.25, 16, 16]} />
          {ballMaterial}
        </mesh>
        <mesh>
          <icosahedronGeometry args={[0.251, 1]} />
          <meshStandardMaterial color="#111827" wireframe wireframeLinewidth={2} />
        </mesh>
      </group>
    </group>
  )
}

export const AvatarFigure3D = ({
  loadout = {},
  size = 176,
  className = '',
  title = 'Animated 3D Soccer Player',
  interactive = true,
  zoomEnabled = true,
  fallbackTo2D = true,
  animationState, // Use prop if provided, defaults to juggling in Profile mode
}) => {
  const canRender3D = useMemo(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false
    try {
      const canvas = document.createElement('canvas')
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
    } catch {
      return false
    }
  }, [])

  if (!canRender3D && fallbackTo2D) {
    return <AvatarFigure loadout={loadout} size={size} className={className} title={title} />
  }

  // Determine an animation based on whether the avatar is interactive/large vs preview
  // Make it default to juggling for a more lively experience
  const defaultAnim = size > 100 ? 'juggling' : 'idle'
  const activeAnim = animationState || defaultAnim

  return (
    <div className={`avatar-figure-3d player-3d ${className}`.trim()} style={{ width: size, height: size }} aria-label={title}>
      <Canvas
        shadows
        dpr={[1, 1.6]}
        gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        camera={{ position: [0, 1.5, 7], fov: 45, near: 0.1, far: 20 }}
      >
        <color attach="background" args={['#020617']} />

        <Environment preset="park" background={false} />

        <ambientLight intensity={0.5} />
        <hemisphereLight intensity={0.3} color="#ffffff" groundColor="#16a34a" />

        <spotLight position={[5, 10, 5]} intensity={2.5} castShadow shadow-mapSize={[1024, 1024]} penumbra={0.5} />
        <spotLight position={[-5, 8, -5]} intensity={1.5} penumbra={1} color="#38bdf8" />

        <Suspense fallback={null}>
          <Pedestal />
          <AnimatedSoccerPlayer loadout={loadout} animationState={activeAnim} />
        </Suspense>

        <ContactShadows position={[0, -1.95, 0]} opacity={0.7} blur={2.5} scale={8} far={4} color="#000000" />

        <OrbitControls
          enablePan={false}
          enableZoom={zoomEnabled}
          zoomSpeed={0.8}
          minDistance={3}
          maxDistance={10}
          enableRotate={interactive}
          autoRotate={!interactive && activeAnim === 'idle'}
          autoRotateSpeed={0.5}
          enableDamping
          dampingFactor={0.05}
          target={[0, 0.5, 0]} // Center view roughly at waist height
          maxPolarAngle={Math.PI / 2 + 0.1}
        />
      </Canvas>
    </div>
  )
}

export default AvatarFigure3D
