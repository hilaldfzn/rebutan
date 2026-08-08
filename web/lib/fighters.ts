/**
 * The cast.
 *
 * Six fighters, and the only thing that matters about them is that you can tell
 * them apart from the back of a room. Colour alone does not survive a projector
 * or a colour-blind judge, so every fighter also has a distinct *silhouette* —
 * the headgear is the real identifier and the colour is the confirmation.
 *
 * Lives here rather than in `VoxelArena.tsx` on purpose: the 3D scene is
 * `ssr: false` and code-split, and the HUD needs these names and colours for the
 * seat chips. Importing them from the arena would drag ~600kb of three.js back
 * into the first load.
 *
 * The gold `--crown` is deliberately absent from this palette. Exactly one thing
 * in the scene is gold, and it is the thing everyone is fighting over.
 */

export type GearKind = "horns" | "antenna" | "visor" | "mohawk" | "blade" | "tophat";

export type Fighter = {
    /** Shown in the HUD next to the address, so "who holds it" is a name. */
    name: string;
    /** Torso and head. */
    color: string;
    /** Headgear and chest emblem — the readable second tone. */
    accent: string;
    gear: GearKind;
};

export const FIGHTERS: readonly Fighter[] = [
    {name: "HORNS", color: "#ff3d9a", accent: "#ffd9ec", gear: "horns"},
    {name: "SPARK", color: "#24e0c5", accent: "#d6fff8", gear: "antenna"},
    {name: "VISOR", color: "#836ef9", accent: "#cfc4ff", gear: "visor"},
    {name: "CREST", color: "#ff8a3d", accent: "#ffd9bd", gear: "mohawk"},
    {name: "BLADE", color: "#ff4b3e", accent: "#ffd3d0", gear: "blade"},
    {name: "DUKE", color: "#7fd45a", accent: "#e0ffd2", gear: "tophat"},
] as const;

export const SEAT_COUNT = FIGHTERS.length;

export const fighterAt = (seat: number): Fighter => FIGHTERS[((seat % SEAT_COUNT) + SEAT_COUNT) % SEAT_COUNT];
