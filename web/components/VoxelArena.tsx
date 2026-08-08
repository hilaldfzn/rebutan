"use client";

/* eslint-disable react-hooks/immutability --
 * This file is a `useFrame` loop, and a frame loop's whole job is to mutate
 * objects that outlive the render: three.js `Object3D` transforms, the shared
 * anchor map, and the fx record below. The rule assumes anything captured from
 * render scope is frozen after render, which is the correct default for React
 * and the exact opposite of how react-three-fiber works — the alternative is
 * routing sixty position updates a second through setState. Scoped to this file
 * deliberately: nothing else in the app animates this way.
 */

import {Canvas, useFrame, useThree} from "@react-three/fiber";
import {createContext, useContext, useMemo, useRef, useState} from "react";
import {AdditiveBlending, DoubleSide, Vector3, type Group, type Mesh, type MeshBasicMaterial} from "three";

import {FIGHTERS, SEAT_COUNT, fighterAt, type GearKind} from "@/lib/fighters";
import {useKeys} from "@/lib/useKeys";

/**
 * The voxel arena — the game, rendered and played.
 *
 * You drive your own fighter with WASD or the arrow keys. The crown starts on
 * the plinth at the centre of the arena; once someone takes it, it is worn on
 * their head, and it stays there until it is taken off them. Walk into range of
 * wherever the crown currently is and press SPACE to take it, which fires the
 * real `steal()` transaction.
 *
 * WHAT IS AND IS NOT ON CHAIN — this distinction matters and the UI must not
 * blur it. Movement is local and cosmetic: broadcasting positions would need a
 * server, and the project has none by design. The *crown* is entirely on chain —
 * who holds it, since which block, and every payout. So walking is free and
 * instant, and taking the crown costs a transaction and can be refused by the
 * contract. The game never pretends otherwise: if the chain rejects a steal, the
 * crown stays where it was, and nothing in this file animates until the chain
 * says the holder changed.
 *
 * THE CROWN IS ONE OBJECT, NOT A FLAG. It is mounted exactly once and never
 * unmounted; a handover moves it. That is the whole reason the transfer reads as
 * a game event instead of a re-render — an object that arcs across the arena,
 * lands, and knocks the room about cannot be mistaken for a state variable
 * flipping. Everything downstream (the trail, the shockwaves, the sparks, the
 * loser's recoil, the winner's pop, the camera kick) is derived from that one
 * flight, so they cannot desynchronise from each other.
 *
 * Built from untextured boxes under an orthographic camera. Voxels are the
 * cheapest 3D that still reads as a game rather than a tech demo: nothing to
 * fetch over a shared venue access point, a few dozen meshes, and it holds
 * framerate on a mid-range phone.
 */

const RING_RADIUS = 4.2;
const ARENA_RADIUS = 5.9;
const GRAB_RANGE = 1.7;
const MOVE_SPEED = 5.2;

/** Crown resting heights: floating over the plinth, and worn on a head. */
const THRONE_Y = 1.5;
const HEAD_Y = 1.66;

/** How long a handover takes, in seconds. Long enough to follow across a room,
 *  short enough that it never blocks the next steal (MIN_REIGN is ~1.2s). */
const FLIGHT = 0.72;
/** Peak of the crown's arc above the straight line between the two heads. */
const HOP = 2.3;

const STUN = 0.9; // dethroned recoil
const POP = 0.6; // coronation bounce
const RIPPLE_LIFE = 0.85;
/** Shockwave pool. Four is enough for a take-off, a landing, and one contested
 *  overlap — steals are throttled to one per 3 blocks, so they cannot stack. */
const RIPPLE_SLOTS = [0, 1, 2, 3];
const SPARK_LIFE = 0.75;
const SPARK_COUNT = 14;

const THRONE = "throne";
const PLAYER = "player";
const seatKey = (i: number) => `seat:${i}`;

const seatPosition = (i: number): [number, number, number] => {
    const a = (i / SEAT_COUNT) * Math.PI * 2;
    return [Math.cos(a) * RING_RADIUS, 0, Math.sin(a) * RING_RADIUS];
};

// ─── Shared scene state ──────────────────────────────────────────────────────

/**
 * Every cross-component value in the scene, held in mutable objects behind one
 * stable context value.
 *
 * Refs and not state, deliberately. All of this is read and written inside
 * `useFrame`; routing it through React would re-render the entire arena sixty
 * times a second to move a crown four metres. Nothing here ever triggers a
 * render — the only React state in the file is the one boolean the HUD ring
 * needs.
 */
type RippleState = {at: number; x: number; z: number; gold: boolean};

type Fx = {
    /** Live world position of the crown. The grab test and every locator read
     *  this, so "in range" always means in range of the crown itself — not of
     *  the centre of the map, which is where it stops being once it is worn. */
    crownPos: Vector3;
    flying: boolean;
    startedAt: number;
    landedAt: number;
    /** Flight endpoints, republished each frame so the trail can retrace the
     *  arc analytically instead of buffering positions. `to` genuinely moves:
     *  the crown chases a walking player. */
    from: Vector3;
    to: Vector3;
    /** Anchor keys of the dethroned and the crowned, for their reactions. */
    fromKey: string;
    toKey: string;
    landPos: Vector3;
    /** Camera kick, decayed every frame. */
    shake: number;
    ripples: RippleState[];
    rippleCursor: number;
};

type Scene = {anchors: Map<string, Vector3>; fx: Fx};

const SceneCtx = createContext<Scene | null>(null);

function useScene(): Scene {
    const scene = useContext(SceneCtx);
    if (!scene) throw new Error("arena components must render inside <SceneCtx>");
    return scene;
}

function createScene(): Scene {
    // Pre-seeded so the crown has somewhere to be on frame zero, before any
    // fighter's useFrame has run. An empty map here is a one-frame crown at the
    // origin, which reads as a flicker.
    const anchors = new Map<string, Vector3>();
    anchors.set(THRONE, new Vector3(0, THRONE_Y, 0));
    for (let i = 0; i < SEAT_COUNT; i++) {
        const [x, , z] = seatPosition(i);
        anchors.set(seatKey(i), new Vector3(x, HEAD_Y, z));
    }
    anchors.set(PLAYER, new Vector3(0, HEAD_Y, RING_RADIUS));

    return {
        anchors,
        fx: {
            crownPos: new Vector3(0, THRONE_Y, 0),
            flying: false,
            startedAt: 0,
            // Far in the past, so nothing plays a landing animation on mount.
            landedAt: -999,
            from: new Vector3(),
            to: new Vector3(),
            fromKey: "",
            toKey: "",
            landPos: new Vector3(),
            shake: 0,
            ripples: Array.from({length: 4}, () => ({at: -999, x: 0, z: 0, gold: true})),
            rippleCursor: 0,
        },
    };
}

function pushRipple(fx: Fx, now: number, x: number, z: number, gold: boolean) {
    const slot = fx.ripples[fx.rippleCursor % fx.ripples.length];
    fx.rippleCursor += 1;
    slot.at = now;
    slot.x = x;
    slot.z = z;
    slot.gold = gold;
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Position along the handover arc at normalised time `t`. */
function arcPoint(fx: Fx, t: number, out: Vector3): Vector3 {
    out.lerpVectors(fx.from, fx.to, smoothstep(t));
    out.y += Math.sin(Math.PI * t) * HOP;
    return out;
}

/**
 * The two reactions a fighter can have to a handover.
 *
 * Transform-only — no material swaps. A tilt and a bounce survive a projector,
 * a colour-blind viewer, and a phone with the brightness turned down; a flash of
 * red does not.
 *
 * `g` MUST be the inner body group, never the fighter's outer group. The outer
 * group is aimed with `lookAt`, which writes a quaternion; for the two seats
 * whose facing decomposes to an Euler with x = -π, assigning `rotation.z` here
 * rebuilt that quaternion from (-π, θ, 0) and flipped the fighter upside-down
 * through the floor. Two of six fighters silently vanished. Keeping aim and
 * reaction on separate objects makes that class of bug impossible rather than
 * merely fixed.
 */
function applyFighterFx(g: Group, fx: Fx, key: string, now: number) {
    let lift = 0;
    let tilt = 0;
    let scale = 1;

    if (fx.fromKey === key) {
        const t = (now - fx.startedAt) / STUN;
        if (t >= 0 && t < 1) {
            const decay = 1 - t;
            tilt = Math.sin(t * Math.PI * 5) * 0.45 * decay; // rocked back on their heels
            lift -= 0.14 * decay;
            scale -= 0.1 * decay;
        }
    }

    if (fx.toKey === key) {
        const t = (now - fx.landedAt) / POP;
        if (t >= 0 && t < 1) {
            const decay = 1 - t;
            lift += Math.sin(t * Math.PI) * 0.55; // jump for it
            scale += Math.sin(t * Math.PI * 2) * 0.18 * decay;
        }
    }

    g.position.y += lift;
    g.rotation.z = tilt;
    g.scale.setScalar(scale);
}

// ─── The crown ───────────────────────────────────────────────────────────────

function CrownMesh() {
    return (
        <>
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
        </>
    );
}

/**
 * The one crown, and the only thing in the scene that knows where it belongs.
 *
 * The handover is detected here inside `useFrame` rather than in an effect, so
 * the take-off point is exactly where the crown was rendered on the previous
 * frame. Detecting it in an effect would launch the flight from the *target*
 * anchor on some frames — the crown would leap to the new head and then fly to
 * itself, which is the precise failure this component exists to avoid.
 */
function CrownRig({targetKey}: {targetKey: string}) {
    const {anchors, fx} = useScene();
    const ref = useRef<Group>(null);
    const prevKey = useRef<string | null>(null);
    const scale = useRef(1);

    useFrame((state) => {
        const g = ref.current;
        if (!g) return;
        const now = state.clock.elapsedTime;

        const dest = anchors.get(targetKey);
        if (dest) fx.to.copy(dest);

        if (prevKey.current !== targetKey) {
            if (prevKey.current === null) {
                // First frame. Snap — there was no previous holder to take it from.
                g.position.copy(fx.to);
                fx.from.copy(fx.to);
            } else {
                fx.from.copy(g.position);
                fx.flying = true;
                fx.startedAt = now;
                fx.fromKey = prevKey.current;
                fx.toKey = targetKey;
                // Dethroning shockwave, in attack magenta, at the loser's feet.
                pushRipple(fx, now, g.position.x, g.position.z, false);
            }
            prevKey.current = targetKey;
        }

        // Worn crowns are smaller than the one on the plinth; the change is
        // eased so the transition never snaps at either end of the flight.
        const wanted = targetKey === THRONE ? 1 : 0.7;
        scale.current += (wanted - scale.current) * 0.12;

        let pop = 1;

        if (fx.flying) {
            const t = Math.min(1, (now - fx.startedAt) / FLIGHT);
            arcPoint(fx, t, g.position);
            // Spins hard on take-off and settles into its idle rotation.
            g.rotation.y = now * 0.8 + (1 - t) * (1 - t) * Math.PI * 5;
            pop = 1 + Math.sin(Math.PI * t) * 0.45;

            if (t >= 1) {
                fx.flying = false;
                fx.landedAt = now;
                fx.landPos.copy(g.position);
                fx.shake = 1;
                // Coronation shockwave, in gold, under the new holder.
                pushRipple(fx, now, g.position.x, g.position.z, true);
            }
        } else {
            g.position.copy(fx.to);
            g.position.y += Math.sin(now * 2) * 0.09;
            g.rotation.y = now * 0.8;

            // Overshoot on landing: the crown thuds down and rings.
            const t = (now - fx.landedAt) / 0.45;
            if (t >= 0 && t < 1) pop = 1 + Math.sin(t * Math.PI * 3) * 0.2 * (1 - t);
        }

        g.scale.setScalar(scale.current * pop);
        fx.crownPos.copy(g.position);
    });

    return (
        <group ref={ref}>
            <CrownMesh />
        </group>
    );
}

/** Ghosts of the crown strung back along its own arc while it is in flight. */
function CrownTrail() {
    const {fx} = useScene();
    const ref = useRef<Group>(null);
    const tmp = useMemo(() => new Vector3(), []);
    const ghosts = useMemo(() => [0.05, 0.1, 0.16, 0.23, 0.31, 0.4], []);

    useFrame((state) => {
        const g = ref.current;
        if (!g) return;
        g.visible = fx.flying;
        if (!fx.flying) return;

        const t = Math.min(1, (state.clock.elapsedTime - fx.startedAt) / FLIGHT);
        g.children.forEach((child, i) => {
            const back = t - ghosts[i];
            child.visible = back > 0;
            if (back <= 0) return;
            arcPoint(fx, back, tmp);
            child.position.copy(tmp);
            child.rotation.y = state.clock.elapsedTime * 2 + i;
            const s = 0.34 * (1 - i / ghosts.length);
            child.scale.setScalar(s);
        });
    });

    return (
        <group ref={ref} visible={false}>
            {ghosts.map((g, i) => (
                <mesh key={g}>
                    <boxGeometry args={[1, 1, 1]} />
                    <meshBasicMaterial
                        color="#ffd23f"
                        transparent
                        opacity={0.55 - i * 0.07}
                        depthWrite={false}
                    />
                </mesh>
            ))}
        </group>
    );
}

/**
 * A shaft of light over the crown.
 *
 * Under an isometric camera a small object on the far side of the arena is easy
 * to lose behind a fighter. The beacon means the answer to "where is the crown"
 * is always legible from anywhere on the board, including from the back of the
 * room on a projector.
 */
function CrownBeacon() {
    const {fx} = useScene();
    const ref = useRef<Mesh>(null);

    useFrame((state) => {
        const m = ref.current;
        if (!m) return;
        m.position.set(fx.crownPos.x, fx.crownPos.y + 1.9, fx.crownPos.z);
        const s = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.08;
        m.scale.set(s, 1, s);
    });

    return (
        <mesh ref={ref}>
            {/* Narrow at the crown, flaring slightly upward — a beam leaving the
                object, not a cone landing on it. Deliberately thin: gold at low
                alpha over a violet-black ground goes brown, so a wide shaft
                reads as a smudge hanging over the arena instead of as light.
                A thin bright pin survives that; a broad dim one does not. */}
            <cylinderGeometry args={[0.19, 0.07, 3, 6, 1, true]} />
            {/* Additive, or it darkens the scene instead of lighting it. */}
            <meshBasicMaterial
                color="#ffd23f"
                transparent
                opacity={0.3}
                blending={AdditiveBlending}
                side={DoubleSide}
                depthWrite={false}
            />
        </mesh>
    );
}

// ─── Impact ──────────────────────────────────────────────────────────────────

/** One slot of the shockwave pool. Magenta on a dethroning, gold on a landing. */
function Ripple({index}: {index: number}) {
    const {fx} = useScene();
    const mesh = useRef<Mesh>(null);
    const mat = useRef<MeshBasicMaterial>(null);

    useFrame((state) => {
        const m = mesh.current;
        const mt = mat.current;
        if (!m || !mt) return;

        const r = fx.ripples[index];
        const t = (state.clock.elapsedTime - r.at) / RIPPLE_LIFE;
        if (t < 0 || t > 1) {
            m.visible = false;
            return;
        }

        m.visible = true;
        m.position.set(r.x, 0.07, r.z);
        m.scale.setScalar(0.4 + t * 3.4);
        mt.opacity = (1 - t) * (1 - t) * 0.9;
        mt.color.set(r.gold ? "#ffd23f" : "#ff3d9a");
    });

    return (
        <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <ringGeometry args={[0.6, 0.82, 32]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} ref={mat} />
        </mesh>
    );
}

/** Gold chips thrown out of the floor where the crown lands. */
function SparkBurst() {
    const {fx} = useScene();
    const ref = useRef<Group>(null);
    const dirs = useMemo(
        () =>
            Array.from({length: SPARK_COUNT}, (_, i) => {
                const a = (i / SPARK_COUNT) * Math.PI * 2;
                // Alternating reach, so the burst is not a perfect wheel.
                const r = i % 2 === 0 ? 2.6 : 1.7;
                return [Math.cos(a) * r, Math.sin(a) * r] as const;
            }),
        [],
    );

    useFrame((state) => {
        const g = ref.current;
        if (!g) return;
        const t = (state.clock.elapsedTime - fx.landedAt) / SPARK_LIFE;
        g.visible = t >= 0 && t < 1;
        if (!g.visible) return;

        g.children.forEach((child, i) => {
            const [dx, dz] = dirs[i];
            child.position.set(
                fx.landPos.x + dx * t,
                Math.max(0.1, fx.landPos.y * 0.5 + Math.sin(Math.PI * t) * 1.1 - t * t * 1.4),
                fx.landPos.z + dz * t,
            );
            child.rotation.set(t * 9 + i, t * 7, t * 5);
            child.scale.setScalar(Math.max(0.001, (1 - t) * 0.19));
        });
    });

    return (
        <group ref={ref} visible={false}>
            {dirs.map((d) => (
                <mesh key={`${d[0]}-${d[1]}`}>
                    <boxGeometry args={[1, 1, 1]} />
                    <meshBasicMaterial color="#fff0a8" />
                </mesh>
            ))}
        </group>
    );
}

// ─── Fighters ────────────────────────────────────────────────────────────────

/**
 * Headgear, which is what actually distinguishes one fighter from another.
 *
 * It is hidden the moment its wearer is crowned, so a fighter is never wearing
 * two things at once and the crown never clips through a hat. That also gives
 * the handover a second, quieter tell: gear off on the way in, gear back on the
 * moment it is taken from you.
 */
function Gear({kind, color, accent}: {kind: GearKind; color: string; accent: string}) {
    switch (kind) {
        case "horns":
            return (
                <>
                    <mesh position={[-0.27, 1.58, 0]} rotation={[0, 0, 0.42]} castShadow>
                        <boxGeometry args={[0.13, 0.4, 0.13]} />
                        <meshLambertMaterial color={accent} />
                    </mesh>
                    <mesh position={[0.27, 1.58, 0]} rotation={[0, 0, -0.42]} castShadow>
                        <boxGeometry args={[0.13, 0.4, 0.13]} />
                        <meshLambertMaterial color={accent} />
                    </mesh>
                </>
            );
        case "antenna":
            return (
                <>
                    <mesh position={[0, 1.6, 0]} castShadow>
                        <boxGeometry args={[0.08, 0.32, 0.08]} />
                        <meshLambertMaterial color={accent} />
                    </mesh>
                    <mesh position={[0, 1.82, 0]}>
                        <boxGeometry args={[0.19, 0.19, 0.19]} />
                        <meshBasicMaterial color={accent} />
                    </mesh>
                </>
            );
        case "visor":
            return (
                <>
                    {/* Flat cap with a brow that hides the eyes entirely. */}
                    <mesh position={[0, 1.52, 0]} castShadow>
                        <boxGeometry args={[0.58, 0.14, 0.5]} />
                        <meshLambertMaterial color={accent} />
                    </mesh>
                    <mesh position={[0, 1.3, 0.2]}>
                        <boxGeometry args={[0.54, 0.17, 0.1]} />
                        <meshBasicMaterial color={color} />
                    </mesh>
                </>
            );
        case "mohawk":
            return (
                <>
                    {[
                        [0.22, 0.24],
                        [0.34, 0],
                        [0.22, -0.24],
                    ].map(([h, z]) => (
                        <mesh key={z} position={[0, 1.47 + h / 2, z]} castShadow>
                            <boxGeometry args={[0.11, h, 0.16]} />
                            <meshLambertMaterial color={accent} />
                        </mesh>
                    ))}
                </>
            );
        case "blade":
            return (
                <mesh position={[0, 1.72, -0.06]} rotation={[-0.25, 0, 0]} castShadow>
                    <boxGeometry args={[0.1, 0.56, 0.3]} />
                    <meshLambertMaterial color={accent} />
                </mesh>
            );
        case "tophat":
            return (
                <>
                    <mesh position={[0, 1.51, 0]} castShadow>
                        <boxGeometry args={[0.68, 0.08, 0.62]} />
                        <meshLambertMaterial color={accent} />
                    </mesh>
                    <mesh position={[0, 1.72, 0]} castShadow>
                        <boxGeometry args={[0.42, 0.36, 0.4]} />
                        <meshLambertMaterial color={accent} />
                    </mesh>
                </>
            );
    }
}

function FighterModel({
    seat,
    opacity,
    gearRef,
}: {
    seat: number;
    opacity: number;
    gearRef: React.RefObject<Group | null>;
}) {
    const {color, accent, gear} = fighterAt(seat);
    const ghost = opacity < 1;

    return (
        <>
            <mesh position={[-0.17, 0.22, 0]} castShadow>
                <boxGeometry args={[0.22, 0.44, 0.24]} />
                <meshLambertMaterial color="#2b2440" transparent={ghost} opacity={opacity} />
            </mesh>
            <mesh position={[0.17, 0.22, 0]} castShadow>
                <boxGeometry args={[0.22, 0.44, 0.24]} />
                <meshLambertMaterial color="#2b2440" transparent={ghost} opacity={opacity} />
            </mesh>
            <mesh position={[0, 0.72, 0]} castShadow>
                <boxGeometry args={[0.62, 0.6, 0.4]} />
                <meshLambertMaterial color={color} transparent={ghost} opacity={opacity} />
            </mesh>
            {/* Chest emblem in the accent tone — the fighter's colour repeated
                where it is still visible when the head is behind someone. */}
            <mesh position={[0, 0.74, 0.21]}>
                <boxGeometry args={[0.24, 0.24, 0.04]} />
                <meshBasicMaterial color={accent} transparent={ghost} opacity={opacity} />
            </mesh>
            <mesh position={[0, 1.24, 0]} castShadow>
                <boxGeometry args={[0.5, 0.46, 0.44]} />
                <meshLambertMaterial color={color} transparent={ghost} opacity={opacity} />
            </mesh>
            <mesh position={[-0.12, 1.28, 0.23]}>
                <boxGeometry args={[0.1, 0.12, 0.04]} />
                <meshBasicMaterial color="#0d0a18" transparent={ghost} opacity={opacity} />
            </mesh>
            <mesh position={[0.12, 1.28, 0.23]}>
                <boxGeometry args={[0.1, 0.12, 0.04]} />
                <meshBasicMaterial color="#0d0a18" transparent={ghost} opacity={opacity} />
            </mesh>

            <group ref={gearRef}>
                <Gear kind={gear} color={color} accent={accent} />
            </group>
        </>
    );
}

/**
 * A ring of light under whoever is wearing the crown.
 *
 * Redundant with the crown itself, and that redundancy is the point: at the
 * moment of a steal two fighters are mid-animation and the crown is in the air,
 * so the floor has to answer "whose is it now" before the crown has landed.
 */
function HolderRing({active}: {active: boolean}) {
    const ref = useRef<Mesh>(null);
    const mat = useRef<MeshBasicMaterial>(null);

    useFrame((state) => {
        const m = ref.current;
        const mt = mat.current;
        if (!m || !mt) return;
        m.visible = active;
        if (!active) return;
        const t = state.clock.elapsedTime;
        m.scale.setScalar(1 + Math.sin(t * 3.4) * 0.07);
        mt.opacity = 0.45 + Math.sin(t * 3.4) * 0.18;
    });

    return (
        <mesh ref={ref} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <ringGeometry args={[0.62, 0.86, 28]} />
            <meshBasicMaterial ref={mat} color="#ffd23f" transparent opacity={0.5} depthWrite={false} />
        </mesh>
    );
}

/** A rival: parked on their seat, watching the crown, bobbing impatiently. */
function SeatedFighter({
    seat,
    isHolder,
    occupied,
}: {
    seat: number;
    isHolder: boolean;
    occupied: boolean;
}) {
    const {anchors, fx} = useScene();
    const ref = useRef<Group>(null);
    const bodyRef = useRef<Group>(null);
    const gearRef = useRef<Group>(null);
    const pos = useMemo(() => seatPosition(seat), [seat]);
    const key = seatKey(seat);

    useFrame((state) => {
        const g = ref.current;
        const body = bodyRef.current;
        if (!g || !body) return;
        const t = state.clock.elapsedTime;

        g.position.y = isHolder
            ? Math.abs(Math.sin(t * 3 + seat)) * 0.14
            : Math.abs(Math.sin(t * 2 + seat)) * 0.06;

        // Everyone tracks the crown, wherever it has got to.
        const dx = fx.crownPos.x - g.position.x;
        const dz = fx.crownPos.z - g.position.z;
        if (dx * dx + dz * dz > 0.04) g.lookAt(fx.crownPos.x, g.position.y, fx.crownPos.z);

        applyFighterFx(body, fx, key, t);

        anchors.get(key)?.set(g.position.x, g.position.y + body.position.y + HEAD_Y, g.position.z);
        if (gearRef.current) gearRef.current.visible = !(isHolder && !fx.flying);
    });

    return (
        <group ref={ref} position={pos}>
            {/* Outside the body group: the ring belongs to the floor, so it must
                not lift or tilt when its owner is knocked about. */}
            <HolderRing active={isHolder} />
            <group ref={bodyRef}>
                {/* An empty seat is still a fighter, just not one with a stake
                    in the round. At 0.22 the darker half of the palette
                    disappeared into the floor and the arena read as half-built,
                    which undercuts the point of six distinct characters. */}
                <FighterModel seat={seat} opacity={occupied ? 1 : 0.42} gearRef={gearRef} />
            </group>
        </group>
    );
}

/**
 * Your fighter. Keyboard-driven, clamped to the platform, and the only thing on
 * screen that can trigger a transaction.
 *
 * Range is measured to the crown's live position, not to the centre of the
 * arena. That is what makes STEAL a mechanic rather than a button: once someone
 * is wearing it, taking it back means walking up to *them*. The HUD's STEAL
 * button remains unconditional, so nobody is ever locked out of a legal move by
 * the movement layer — the arena adds skill, it never removes access.
 */
function PlayerFighter({
    seat,
    isHolder,
    canGrab,
    onGrab,
    onRangeChange,
}: {
    seat: number;
    isHolder: boolean;
    canGrab: boolean;
    onGrab: () => void;
    onRangeChange: (inRange: boolean) => void;
}) {
    const {anchors, fx} = useScene();
    const ref = useRef<Group>(null);
    const bodyRef = useRef<Group>(null);
    const gearRef = useRef<Group>(null);
    const keys = useKeys();
    const wasInRange = useRef(false);
    const grabLatch = useRef(false);
    const start = useMemo(() => seatPosition(seat), [seat]);

    useFrame((state, delta) => {
        const g = ref.current;
        const body = bodyRef.current;
        if (!g || !body) return;

        const k = keys.current;
        const dt = Math.min(delta, 0.05); // clamp so a tab-out cannot teleport you
        const t = state.clock.elapsedTime;

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
            g.position.y = Math.abs(Math.sin(t * 11)) * 0.12; // stride
        } else {
            g.position.y = Math.abs(Math.sin(t * 2)) * 0.05;
        }

        applyFighterFx(body, fx, PLAYER, t);

        anchors
            .get(PLAYER)
            ?.set(g.position.x, g.position.y + body.position.y + HEAD_Y, g.position.z);
        if (gearRef.current) gearRef.current.visible = !(isHolder && !fx.flying);

        const inRange =
            !isHolder && Math.hypot(g.position.x - fx.crownPos.x, g.position.z - fx.crownPos.z) < GRAB_RANGE;
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
        <group ref={ref} position={start}>
            {/* Marker ring so you always know which fighter is yours. */}
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.46, 0.6, 24]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.55} depthWrite={false} />
            </mesh>
            <HolderRing active={isHolder} />
            <group ref={bodyRef}>
                <FighterModel seat={seat} opacity={1} gearRef={gearRef} />
            </group>
        </group>
    );
}

// ─── Board ───────────────────────────────────────────────────────────────────

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

/**
 * The empty throne at the centre.
 *
 * Left standing after the crown is taken, rather than unmounted with it. A
 * plinth that vanishes turns a theft into a scene change; a plinth that stays
 * empty is a permanent reminder of where the crown started and what everyone is
 * circling.
 */
function Throne({empty}: {empty: boolean}) {
    const glow = useRef<Mesh>(null);
    const mat = useRef<MeshBasicMaterial>(null);

    useFrame((state) => {
        const m = glow.current;
        const mt = mat.current;
        if (!m || !mt) return;
        m.visible = !empty;
        if (empty) return;
        const t = state.clock.elapsedTime;
        m.scale.setScalar(1 + Math.sin(t * 2.2) * 0.09);
        mt.opacity = 0.4 + Math.sin(t * 2.2) * 0.16;
    });

    return (
        <group>
            <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.1, 0.7, 1.1]} />
                <meshLambertMaterial color={empty ? "#2a2158" : "#3b2f78"} />
            </mesh>
            <mesh ref={glow} position={[0, 0.73, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
                <ringGeometry args={[0.5, 0.72, 24]} />
                <meshBasicMaterial ref={mat} color="#ffd23f" transparent opacity={0.5} depthWrite={false} />
            </mesh>
        </group>
    );
}

/** Pulsing ring marking grab range, parked on the crown so "close enough" is
 *  never a guess — and so it visibly travels when the crown changes hands. */
function GrabZone({active, hidden}: {active: boolean; hidden: boolean}) {
    const {fx} = useScene();
    const ref = useRef<Mesh>(null);
    const mat = useRef<MeshBasicMaterial>(null);

    useFrame((state) => {
        const m = ref.current;
        const mt = mat.current;
        if (!m || !mt) return;
        m.visible = !hidden;
        if (hidden) return;
        m.position.set(fx.crownPos.x, 0.09, fx.crownPos.z);
        m.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 4) * 0.05);
        mt.color.set(active ? "#ffd23f" : "#836ef9");
        mt.opacity = active ? 0.85 : 0.3;
    });

    return (
        <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[GRAB_RANGE - 0.14, GRAB_RANGE, 40]} />
            <meshBasicMaterial ref={mat} color="#836ef9" transparent opacity={0.3} depthWrite={false} />
        </mesh>
    );
}

/**
 * The camera: follows the player, and takes the hit when the crown lands.
 *
 * Owns the shake so it survives a handover happening while nobody is driving —
 * spectators and players see the same impact.
 */
function CameraRig({follow}: {follow: boolean}) {
    const {anchors, fx} = useScene();
    const {camera} = useThree();
    const base = useMemo(() => new Vector3(11, 11, 11), []);
    const look = useMemo(() => new Vector3(), []);
    const want = useMemo(() => new Vector3(), []);

    useFrame((_, delta) => {
        const p = follow ? anchors.get(PLAYER) : undefined;

        // Drifts toward the player instead of cutting — a hard-locked isometric
        // camera makes small movements feel like the world is sliding.
        base.x += (11 + (p ? p.x * 0.35 : 0) - base.x) * 0.05;
        base.z += (11 + (p ? p.z * 0.35 : 0) - base.z) * 0.05;

        fx.shake = Math.max(0, fx.shake - delta * 2.8);
        const kick = fx.shake * fx.shake * 0.55;

        camera.position.set(
            base.x + (Math.random() - 0.5) * kick,
            11 + (Math.random() - 0.5) * kick,
            base.z + (Math.random() - 0.5) * kick,
        );

        want.set(p ? p.x * 0.3 : 0, 0, p ? p.z * 0.3 : 0);
        look.lerp(want, 0.06);
        camera.lookAt(look);
    });

    return null;
}

// ─── Arena ───────────────────────────────────────────────────────────────────

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
    /** Seat wearing the crown, or -1 while it is still on the plinth. */
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
    const scene = useMemo(() => createScene(), []);
    const occupied = useMemo(() => new Set(occupiedSeats ?? []), [occupiedSeats]);
    // The one piece of React state in the scene. It flips only when you cross
    // the grab ring, so it cannot re-render on a frame cadence.
    const [ringHot, setRingHot] = useState(false);

    // Where the crown belongs right now. The single input that drives the whole
    // handover: change it, and the crown flies there.
    const targetKey =
        interactive && isHolder ? PLAYER : holderSeat >= 0 ? seatKey(holderSeat) : THRONE;

    return (
        <div className={className}>
            <Canvas
                orthographic
                shadows
                camera={{position: [11, 11, 11], zoom: 44, near: -100, far: 200}}
                dpr={[1, 1.6]} // capped: phones throttle hard in a warm hall
            >
                <SceneCtx.Provider value={scene}>
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
                    <Throne empty={targetKey !== THRONE} />

                    {/* Fighters first: they publish the head anchors the crown
                        flies between, and useFrame runs in mount order. */}
                    {FIGHTERS.map((f, i) => {
                        if (interactive && i === playerSeat) return null;
                        return (
                            <SeatedFighter
                                key={f.name}
                                seat={i}
                                isHolder={i === holderSeat && !(interactive && isHolder)}
                                occupied={occupied.size === 0 || occupied.has(i)}
                            />
                        );
                    })}

                    {interactive ? (
                        <PlayerFighter
                            seat={playerSeat}
                            isHolder={isHolder}
                            canGrab={canGrab}
                            onGrab={() => onGrab?.()}
                            onRangeChange={setRingHot}
                        />
                    ) : null}

                    <CrownRig targetKey={targetKey} />
                    <CrownTrail />
                    <CrownBeacon />

                    <GrabZone active={ringHot && canGrab} hidden={!interactive || isHolder} />
                    {RIPPLE_SLOTS.map((i) => (
                        <Ripple key={`ripple-${i}`} index={i} />
                    ))}
                    <SparkBurst />

                    <CameraRig follow={interactive} />
                </SceneCtx.Provider>
            </Canvas>
        </div>
    );
}

export default VoxelArena;
