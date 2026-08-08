/**
 * The crown mark.
 *
 * Drawn rather than sourced: an inline SVG has no CDN dependency (the venue wifi
 * is shared by the whole room), scales to a projector without artefacts, and can
 * take `currentColor` so the mark shifts with state instead of being a fixed
 * image. Five points, hard geometry, no gradients — it should read as a stamped
 * insignia, not a fantasy illustration.
 */
export function Crown({className = "", strokeWidth = 1.5}: {className?: string; strokeWidth?: number}) {
    return (
        <svg
            viewBox="0 0 48 40"
            fill="none"
            className={className}
            aria-hidden="true"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
        >
            {/* Band */}
            <path d="M9 31.5h30" strokeLinecap="round" />
            {/* Body: five points, outer pair lower so the silhouette reads at size */}
            <path d="M6 12.5 10.5 31.5h27L42 12.5 33 21 24 6.5 15 21z" />
            {/* Jewels — small, only visible up close, rewarding a second look */}
            <circle cx="24" cy="14.5" r="1.6" fill="currentColor" stroke="none" />
            <circle cx="10.5" cy="19" r="1.1" fill="currentColor" stroke="none" />
            <circle cx="37.5" cy="19" r="1.1" fill="currentColor" stroke="none" />
        </svg>
    );
}

/**
 * A grid of faint tick marks — a stadium scoreboard's dot matrix.
 * Used as a background texture so large dark areas are not dead flat.
 */
export function TickField({className = ""}: {className?: string}) {
    return (
        <svg className={className} aria-hidden="true">
            <defs>
                <pattern id="ticks" width="28" height="28" patternUnits="userSpaceOnUse">
                    <rect width="1.5" height="1.5" fill="currentColor" />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#ticks)" />
        </svg>
    );
}
