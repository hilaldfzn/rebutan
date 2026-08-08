"use client";

import {Canvas, useFrame} from "@react-three/fiber";
import {useMemo, useRef} from "react";
import type {Group, Mesh} from "three";

/**
 * The voxel arena — the game, rendered.
 *
 * Six fighters stand on a raised platform around a crown. Whoever holds it is
 * lifted onto the centre plinth wearing it; everyone else faces inward, waiting
 * for their cooldown. A steal visibly moves the crown from one figure to
 * another, so the core mechanic is legible without a single word of UI.
 *
 * Deliberately built from untextured boxes and an orthographic camera. Voxels
 * are the cheapest 3D that still reads as a *game* rather than a tech demo:
 * there are no models to load, nothing to fetch over shared venue wifi, and the
 * whole scene is a few dozen meshes, so it holds framerate on a mid-range phone
 * in a hall where thirty people are on the same access point.
 */

const SEAT_COUNT = 6;
const RING_RADIUS = 4.2;

const FIGHTER_COLORS = ["#ff3d9a", "#24e0c5", "#836ef9", "#ffd23f", "#ff4b3e", "#a99fd0"];

const seatPosition = (i: number): [number, number, number] => {
    const a = (i / SEAT_COUNT) * Math.PI * 2;
    return [Math.cos(a) * RING_RADIUS, 0, Math.sin(a) * RING_RADIUS];
};

/** A voxel crown: a band plus five spikes, all boxes. */
function VoxelCrown({scale = 1}: {scale?: number}) {
    const ref = useRef<Group>(null);

    useFrame((state) => {
        if (!ref.current) return;
        const t = state.clock.elapsedTime;
        ref.current.rotation.y = t * 0.8;
        ref.current.position.y = Math.sin(t * 2) * 0.09;
    });

    return (
        <group ref={ref} scale={scale}>
            <mesh position={[0, 0, 0]} castShadow>
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

/** A voxel fighter: legs, torso, head, eyes. Crossy-road proportions. */
function Fighter({
    position,
    color,
    isHolder,
    occupied,
    phase,
}: {
    position: [number, number, number];
    color: string;
    isHolder: boolean;
    occupied: boolean;
    phase: number;
}) {
    const ref = useRef<Group>(null);

    useFrame((state) => {
        if (!ref.current) return;
        const t = state.clock.elapsedTime;
        // The holder bounces with confidence; the rest twitch, impatient.
        ref.current.position.y = isHolder
            ? 1.05 + Math.abs(Math.sin(t * 3 + phase)) * 0.16
            : Math.abs(Math.sin(t * 2 + phase)) * 0.07;
        // Everyone faces the crown.
        ref.current.lookAt(0, ref.current.position.y, 0);
    });

    const opacity = occupied ? 1 : 0.22;

    return (
        <group ref={ref} position={position}>
            {/* legs */}
            <mesh position={[-0.17, 0.22, 0]} castShadow>
                <boxGeometry args={[0.22, 0.44, 0.24]} />
                <meshLambertMaterial color="#2b2440" transparent opacity={opacity} />
            </mesh>
            <mesh position={[0.17, 0.22, 0]} castShadow>
                <boxGeometry args={[0.22, 0.44, 0.24]} />
                <meshLambertMaterial color="#2b2440" transparent opacity={opacity} />
            </mesh>
            {/* torso */}
            <mesh position={[0, 0.72, 0]} castShadow>
                <boxGeometry args={[0.62, 0.6, 0.4]} />
                <meshLambertMaterial color={color} transparent opacity={opacity} />
            </mesh>
            {/* head */}
            <mesh position={[0, 1.24, 0]} castShadow>
                <boxGeometry args={[0.5, 0.46, 0.44]} />
                <meshLambertMaterial color={color} transparent opacity={opacity} />
            </mesh>
            {/* eyes */}
            <mesh position={[-0.12, 1.28, 0.23]}>
                <boxGeometry args={[0.1, 0.12, 0.04]} />
                <meshBasicMaterial color="#0d0a18" transparent opacity={opacity} />
            </mesh>
            <mesh position={[0.12, 1.28, 0.23]}>
                <boxGeometry args={[0.1, 0.12, 0.04]} />
                <meshBasicMaterial color="#0d0a18" transparent opacity={opacity} />
            </mesh>

            {isHolder ? (
                <group position={[0, 1.62, 0]}>
                    <VoxelCrown scale={0.62} />
                </group>
            ) : null}
        </group>
    );
}

/** The platform: a ring of voxel tiles, coloured by scoring zone. */
function Platform({stage}: {stage: 0 | 1 | 2 | 3}) {
    const tiles = useMemo(() => {
        const out: {pos: [number, number, number]; color: string; h: number}[] = [];
        for (let x = -6; x <= 6; x++) {
            for (let z = -6; z <= 6; z++) {
                const d = Math.hypot(x, z);
                if (d > 6.4) continue;
                // Concentric bands = the 1x / 2x / 3x zones, readable as terrain.
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

/** The plinth the crown sits on when nobody holds it. */
function Plinth() {
    const ref = useRef<Mesh>(null);
    return (
        <mesh ref={ref} position={[0, 0.35, 0]} castShadow>
            <boxGeometry args={[1.1, 0.7, 1.1]} />
            <meshLambertMaterial color="#3b2f78" />
        </mesh>
    );
}

export function VoxelArena({
    holderSeat = -1,
    occupiedSeats,
    stage = 1,
    className = "",
}: Readonly<{
    holderSeat?: number;
    occupiedSeats?: number[];
    stage?: 0 | 1 | 2 | 3;
    className?: string;
}>) {
    const occupied = useMemo(() => new Set(occupiedSeats ?? []), [occupiedSeats]);
    const anyoneHolding = holderSeat >= 0;

    return (
        <div className={className}>
            <Canvas
                orthographic
                shadows
                camera={{position: [11, 11, 11], zoom: 46, near: -100, far: 200}}
                dpr={[1, 1.6]} // capped: phones in a hot room throttle hard at 3x
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
                <Plinth />

                {/* Unclaimed, the crown hovers over the plinth for anyone to take. */}
                {!anyoneHolding ? (
                    <group position={[0, 1.5, 0]}>
                        <VoxelCrown />
                    </group>
                ) : null}

                {Array.from({length: SEAT_COUNT}).map((_, i) => (
                    <Fighter
                        key={seatPosition(i).join(",")}
                        position={seatPosition(i)}
                        color={FIGHTER_COLORS[i]}
                        isHolder={i === holderSeat}
                        occupied={occupied.size === 0 || occupied.has(i)}
                        phase={i * 1.1}
                    />
                ))}
            </Canvas>
        </div>
    );
}

export default VoxelArena;
