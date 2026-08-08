"use client";

import {Canvas, useFrame, useThree} from "@react-three/fiber";
import {useMemo, useRef, useState} from "react";
import type {Group} from "three";

import {useKeys} from "@/lib/useKeys";

/**
 * The voxel arena — the game, rendered and played.
 *
 * You drive your own fighter with WASD or the arrow keys. The crown sits on the
 * plinth at the centre, or on whoever currently holds it. Walk into range and
 * press SPACE to take it, which fires the real `steal()` transaction.
 *
 * WHAT IS AND IS NOT ON CHAIN — this distinction matters and the UI must not
 * blur it. Movement is local and cosmetic: broadcasting positions would need a
 * server, and the project has none by design. The *crown* is entirely on chain —
 * who holds it, since which block, and every payout. So walking is free and
 * instant, and taking the crown costs a transaction and can be refused by the
 * contract. The game never pretends otherwise: if the chain rejects a steal, the
 * crown stays where it was.
 *
 * Built from untextured boxes under an orthographic camera. Voxels are the
 * cheapest 3D that still reads as a game rather than a tech demo: nothing to
 * fetch over a shared venue access point, a few dozen meshes, and it holds
 * framerate on a mid-range phone.
 */

const SEAT_COUNT = 6;
const RING_RADIUS = 4.2;
const ARENA_RADIUS = 5.9;
const GRAB_RANGE = 1.7;
const MOVE_SPEED = 5.2;

const FIGHTER_COLORS = ["#ff3d9a", "#24e0c5", "#836ef9", "#ffd23f", "#ff4b3e", "#a99fd0"];

const seatPosition = (i: number): [number, number, number] => {
    const a = (i / SEAT_COUNT) * Math.PI * 2;
    return [Math.cos(a) * RING_RADIUS, 0, Math.sin(a) * RING_RADIUS];
};

function VoxelCrown({scale = 1, spin = true}: {scale?: number; spin?: boolean}) {
    const ref = useRef<Group>(null);

    useFrame((state) => {
        if (!ref.current) return;
        const t = state.clock.elapsedTime;
        if (spin) ref.current.rotation.y = t * 0.8;
        ref.current.position.y = Math.sin(t * 2) * 0.09;
    });

    return (
        <group ref={ref} scale={scale}>
            <mesh castShadow>
                <boxGeometry args={[0.86, 0.24, 0.86]} />
                <meshLambertMaterial color="#ffd23f" />
            </mesh>
            {[
                [0, 0.3, 0.32],
                [0.32, 0.3, 0],
                [0, 0.3, -0.32],
                [-0.32, 0.3, 0],
            ].map(([x, y, z]) => (
                <mesh key={`${x}-${z}`} position={[x, y, z]} castShadow>
                    <boxGeometry args={[0.2, 0.34, 0.2]} />
                    <meshLambertMaterial color="#ffd23f" />
                </mesh>
            ))}
            <mesh position={[0, 0.42, 0]} castShadow>
                <boxGeometry args={[0.22, 0.5, 0.22]} />
                <meshLambertMaterial color="#fff0a8" />
            </mesh>
        </group>
    );
}

function FighterBody({color, opacity}: {color: string; opacity: number}) {
    return (
        <>
            <mesh position={[-0.17, 0.22, 0]} castShadow>
                <boxGeometry args={[0.22, 0.44, 0.24]} />
                <meshLambertMaterial color="#2b2440" transparent opacity={opacity} />
            </mesh>
            <mesh position={[0.17, 0.22, 0]} castShadow>
                <boxGeometry args={[0.22, 0.44, 0.24]} />
                <meshLambertMaterial color="#2b2440" transparent opacity={opacity} />
            </mesh>
            <mesh position={[0, 0.72, 0]} castShadow>
                <boxGeometry args={[0.62, 0.6, 0.4]} />
                <meshLambertMaterial color={color} transparent opacity={opacity} />
            </mesh>
            <mesh position={[0, 1.24, 0]} castShadow>
                <boxGeometry args={[0.5, 0.46, 0.44]} />
                <meshLambertMaterial color={color} transparent opacity={opacity} />
            </mesh>
            <mesh position={[-0.12, 1.28, 0.23]}>
                <boxGeometry args={[0.1, 0.12, 0.04]} />
                <meshBasicMaterial color="#0d0a18" transparent opacity={opacity} />
            </mesh>
            <mesh position={[0.12, 1.28, 0.23]}>
                <boxGeometry args={[0.1, 0.12, 0.04]} />
                <meshBasicMaterial color="#0d0a18" transparent opacity={opacity} />
            </mesh>
        </>
    );
}

/** A rival: parked on their seat, facing the crown, bobbing impatiently. */
function SeatedFighter({
    seat,
    color,
    isHolder,
    occupied,
}: {
    seat: number;
    color: string;
    isHolder: boolean;
    occupied: boolean;
}) {
    const ref = useRef<Group>(null);
    const pos = seatPosition(seat);

    useFrame((state) => {
        if (!ref.current) return;
        const t = state.clock.elapsedTime;
        ref.current.position.y = isHolder
            ? Math.abs(Math.sin(t * 3 + seat)) * 0.14
            : Math.abs(Math.sin(t * 2 + seat)) * 0.06;
        ref.current.lookAt(0, ref.current.position.y, 0);
    });

    return (
        <group ref={ref} position={pos}>
            <FighterBody color={color} opacity={occupied ? 1 : 0.22} />
            {isHolder ? (
                <group position={[0, 1.62, 0]}>
                    <VoxelCrown scale={0.62} />
                </group>
            ) : null}
        </group>
    );
}

/**
 * Your fighter. Keyboard-driven, clamped to the platform, and the only thing on
 * screen that can trigger a transaction.
 */
function PlayerFighter({
    color,
    isHolder,
    canGrab,
    onGrab,
    onRangeChange,
}: {
    color: string;
    isHolder: boolean;
    canGrab: boolean;
    onGrab: () => void;
    onRangeChange: (inRange: boolean) => void;
}) {
    const ref = useRef<Group>(null);
    const keys = useKeys();
    const wasInRange = useRef(false);
    const grabLatch = useRef(false);
    const {camera} = useThree();

    useFrame((state, delta) => {
        const g = ref.current;
        if (!g) return;

        const k = keys.current;
        const dt = Math.min(delta, 0.05); // clamp so a tab-out cannot teleport you

        if (k.x !== 0 || k.z !== 0) {
            // Screen-relative movement: the camera is isometric, so raw XZ input
            // would feel diagonal and wrong. Rotating by 45° makes "up" mean up.
            const a = Math.PI / 4;
            const dx = k.x * Math.cos(a) - k.z * Math.sin(a);
            const dz = k.x * Math.sin(a) + k.z * Math.cos(a);
            const len = Math.hypot(dx, dz) || 1;

            g.position.x += (dx / len) * MOVE_SPEED * dt;
            g.position.z += (dz / len) * MOVE_SPEED * dt;

            // Keep everyone on the platform.
            const d = Math.hypot(g.position.x, g.position.z);
            if (d > ARENA_RADIUS) {
                g.position.x = (g.position.x / d) * ARENA_RADIUS;
                g.position.z = (g.position.z / d) * ARENA_RADIUS;
            }

            g.rotation.y = Math.atan2(dx, dz);
            g.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 11)) * 0.12; // stride
        } else {
            g.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 2)) * 0.05;
        }

        // Camera drifts toward the player instead of cutting — a hard-locked
        // isometric camera makes small movements feel like the world is sliding.
        camera.position.x += (11 + g.position.x * 0.35 - camera.position.x) * 0.05;
        camera.position.z += (11 + g.position.z * 0.35 - camera.position.z) * 0.05;
        camera.lookAt(g.position.x * 0.3, 0, g.position.z * 0.3);

        const distToCrown = Math.hypot(g.position.x, g.position.z);
        const inRange = !isHolder && distToCrown < GRAB_RANGE;
        if (inRange !== wasInRange.current) {
            wasInRange.current = inRange;
            onRangeChange(inRange);
        }

        // Latched so holding SPACE fires one transaction, not sixty.
        if (k.grab && inRange && canGrab && !grabLatch.current) {
            grabLatch.current = true;
            onGrab();
        }
        if (!k.grab) grabLatch.current = false;
    });

    return (
        <group ref={ref} position={[0, 0, RING_RADIUS]}>
            {/* Marker ring so you always know which fighter is yours. */}
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.46, 0.6, 24]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
            </mesh>
            <FighterBody color={color} opacity={1} />
            {isHolder ? (
                <group position={[0, 1.62, 0]}>
                    <VoxelCrown scale={0.62} />
                </group>
            ) : null}
        </group>
    );
}

function Platform({stage}: {stage: 0 | 1 | 2 | 3}) {
    const tiles = useMemo(() => {
        const out: {pos: [number, number, number]; color: string; h: number}[] = [];
        for (let x = -6; x <= 6; x++) {
            for (let z = -6; z <= 6; z++) {
                const d = Math.hypot(x, z);
                if (d > 6.4) continue;
                let color = "#241a4d";
                let h = 0.5;
                if (d < 1.9) {
                    color = stage === 3 ? "#5c1a22" : "#3a2a6b";
                    h = 0.78;
                } else if (d < 4.0) {
                    color = stage >= 2 ? "#4a3a1f" : "#2c2059";
                    h = 0.62;
                }
                out.push({pos: [x, -h / 2, z], color, h});
            }
        }
        return out;
    }, [stage]);

    return (
        <group>
            {tiles.map((t) => (
                <mesh key={`${t.pos[0]}-${t.pos[2]}`} position={t.pos} receiveShadow>
                    <boxGeometry args={[0.96, t.h, 0.96]} />
                    <meshLambertMaterial color={t.color} />
                </mesh>
            ))}
        </group>
    );
}

/** Pulsing ring marking grab range, so "close enough" is never a guess. */
function GrabZone({active}: {active: boolean}) {
    const ref = useRef<Group>(null);
    useFrame((state) => {
        if (!ref.current) return;
        const s = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.05;
        ref.current.scale.set(s, 1, s);
    });
    return (
        <group ref={ref}>
            <mesh position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[GRAB_RANGE - 0.14, GRAB_RANGE, 40]} />
                <meshBasicMaterial
                    color={active ? "#ffd23f" : "#836ef9"}
                    transparent
                    opacity={active ? 0.85 : 0.3}
                />
            </mesh>
        </group>
    );
}

export function VoxelArena({
    holderSeat = -1,
    playerSeat = 0,
    occupiedSeats,
    stage = 1,
    isHolder = false,
    canGrab = false,
    interactive = false,
    onGrab,
    className = "",
}: Readonly<{
    holderSeat?: number;
    playerSeat?: number;
    occupiedSeats?: number[];
    stage?: 0 | 1 | 2 | 3;
    isHolder?: boolean;
    canGrab?: boolean;
    interactive?: boolean;
    onGrab?: () => void;
    className?: string;
}>) {
    const occupied = useMemo(() => new Set(occupiedSeats ?? []), [occupiedSeats]);
    const [inRange, setInRange] = useState(false);
    const crownIsLoose = holderSeat < 0 && !isHolder;

    return (
        <div className={className}>
            <Canvas
                orthographic
                shadows
                camera={{position: [11, 11, 11], zoom: 44, near: -100, far: 200}}
                dpr={[1, 1.6]} // capped: phones throttle hard in a warm hall
            >
                <color attach="background" args={["#0d0a18"]} />
                <ambientLight intensity={0.62} />
                <directionalLight
                    position={[8, 14, 6]}
                    intensity={1.15}
                    castShadow
                    shadow-mapSize={[1024, 1024]}
                />
                <directionalLight position={[-8, 6, -6]} intensity={0.32} color="#836ef9" />

                <Platform stage={stage} />

                {/* Plinth and loose crown, only while nobody holds it. */}
                {crownIsLoose ? (
                    <>
                        <mesh position={[0, 0.35, 0]} castShadow>
                            <boxGeometry args={[1.1, 0.7, 1.1]} />
                            <meshLambertMaterial color="#3b2f78" />
                        </mesh>
                        <group position={[0, 1.5, 0]}>
                            <VoxelCrown />
                        </group>
                    </>
                ) : null}

                {interactive ? <GrabZone active={inRange && canGrab} /> : null}

                {Array.from({length: SEAT_COUNT}).map((_, i) => {
                    if (interactive && i === playerSeat) return null;
                    return (
                        <SeatedFighter
                            key={seatPosition(i).join(",")}
                            seat={i}
                            color={FIGHTER_COLORS[i]}
                            isHolder={i === holderSeat}
                            occupied={occupied.size === 0 || occupied.has(i)}
                        />
                    );
                })}

                {interactive ? (
                    <PlayerFighter
                        color={FIGHTER_COLORS[playerSeat % SEAT_COUNT]}
                        isHolder={isHolder}
                        canGrab={canGrab}
                        onGrab={() => onGrab?.()}
                        onRangeChange={setInRange}
                    />
                ) : null}
            </Canvas>
        </div>
    );
}

export default VoxelArena;
