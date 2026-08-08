"use client";

import {useEffect, useRef} from "react";

export type KeyState = {
    x: number; // -1 left, +1 right
    z: number; // -1 forward, +1 back
    grab: boolean;
};

const MOVE_KEYS: Record<string, [keyof KeyState, number]> = {
    KeyW: ["z", -1],
    ArrowUp: ["z", -1],
    KeyS: ["z", 1],
    ArrowDown: ["z", 1],
    KeyA: ["x", -1],
    ArrowLeft: ["x", -1],
    KeyD: ["x", 1],
    ArrowRight: ["x", 1],
};

/**
 * WASD / arrow input as a ref, not state.
 *
 * A ref rather than useState on purpose: this is read every frame inside
 * useFrame, and putting it in state would re-render the whole scene on every
 * keydown — which is exactly the wrong thing to do sixty times a second.
 *
 * Arrow keys scroll the page by default, so movement keys are prevented. Space
 * is the grab key and is also prevented, because a page that jumps down when you
 * try to take the crown feels broken.
 */
export function useKeys() {
    const keys = useRef<KeyState>({x: 0, z: 0, grab: false});
    const held = useRef<Set<string>>(new Set());

    useEffect(() => {
        const recompute = () => {
            let x = 0;
            let z = 0;
            for (const code of held.current) {
                const m = MOVE_KEYS[code];
                if (!m) continue;
                if (m[0] === "x") x += m[1];
                if (m[0] === "z") z += m[1];
            }
            keys.current.x = Math.max(-1, Math.min(1, x));
            keys.current.z = Math.max(-1, Math.min(1, z));
        };

        const down = (e: KeyboardEvent) => {
            // Never steal keys from a text field.
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
                return;
            }
            if (MOVE_KEYS[e.code]) {
                e.preventDefault();
                held.current.add(e.code);
                recompute();
            }
            if (e.code === "Space") {
                e.preventDefault();
                keys.current.grab = true;
            }
        };

        const up = (e: KeyboardEvent) => {
            if (MOVE_KEYS[e.code]) {
                held.current.delete(e.code);
                recompute();
            }
            if (e.code === "Space") keys.current.grab = false;
        };

        // Releasing focus mid-key would otherwise leave the player walking forever.
        const blur = () => {
            held.current.clear();
            keys.current.x = 0;
            keys.current.z = 0;
            keys.current.grab = false;
        };

        window.addEventListener("keydown", down, {passive: false});
        window.addEventListener("keyup", up);
        window.addEventListener("blur", blur);
        return () => {
            window.removeEventListener("keydown", down);
            window.removeEventListener("keyup", up);
            window.removeEventListener("blur", blur);
        };
    }, []);

    return keys;
}
