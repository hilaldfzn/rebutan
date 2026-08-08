/**
 * The battle arena — the page's thesis, drawn.
 *
 * A visitor should understand the game before reading a word: one crown at the
 * centre, contenders ringed around it, everyone pointing inward. The three
 * concentric zones are the stage multipliers, so the scoring rule is visible as
 * geometry rather than explained in a paragraph.
 *
 * Hand-drawn as inline SVG rather than sourced from an icon set. Stock game art
 * would look bought; this looks made, it costs no network request on shared
 * venue wifi, and it scales to a projector without artefacts.
 */

const CENTER = 200;

/** Six contender seats, evenly spaced on a ring. */
const SEATS = [0, 60, 120, 180, 240, 300].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return {
        deg,
        x: CENTER + 150 * Math.cos(rad),
        y: CENTER + 150 * Math.sin(rad),
    };
});

const HEX = [0, 60, 120, 180, 240, 300]
    .map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return `${CENTER + 190 * Math.cos(rad)},${CENTER + 190 * Math.sin(rad)}`;
    })
    .join(" ");

const COLORS = [
    "var(--magenta)",
    "var(--cyan)",
    "var(--violet)",
    "var(--crown)",
    "var(--danger)",
    "var(--ink-muted)",
];

export function Arena({
    holderSeat = 0,
    className = "",
    animate = true,
}: {
    holderSeat?: number;
    className?: string;
    animate?: boolean;
}) {
    return (
        <svg viewBox="0 0 400 400" className={className} role="img" aria-label="Battle arena: one crown at the centre, six contenders around it">
            {/* Arena floor, three stage zones. Outer is 1x, inner rings pay more. */}
            <polygon points={HEX} fill="var(--arena)" stroke="var(--outline)" strokeWidth="6" />
            <circle cx={CENTER} cy={CENTER} r="130" fill="none" stroke="var(--violet)" strokeWidth="2" strokeDasharray="6 8" opacity="0.5" />
            <circle cx={CENTER} cy={CENTER} r="78" fill="var(--surface)" stroke="var(--danger)" strokeWidth="3" strokeDasharray="10 6" opacity="0.75" />

            {/* Zone labels — the scoring rule, stated on the board itself. */}
            <text x={CENTER} y="52" textAnchor="middle" className="display" fontSize="15" fill="var(--violet)">1×</text>
            <text x={CENTER} y="98" textAnchor="middle" className="display" fontSize="15" fill="var(--crown)">2×</text>
            <text x={CENTER} y="146" textAnchor="middle" className="display" fontSize="15" fill="var(--danger)">3×</text>

            {/* Attack vectors: everyone is coming for the middle. */}
            {SEATS.map((seat, i) =>
                i === holderSeat ? null : (
                    <line
                        key={seat.deg}
                        x1={seat.x}
                        y1={seat.y}
                        x2={CENTER + (seat.x - CENTER) * 0.32}
                        y2={CENTER + (seat.y - CENTER) * 0.32}
                        stroke="var(--magenta)"
                        strokeWidth="3"
                        strokeDasharray="8 6"
                        opacity="0.65"
                        className={animate ? "orbit-dash" : undefined}
                    />
                ),
            )}

            {/* The crown, on its plinth. */}
            <g className={animate ? "pulse-crown" : undefined} style={{transformOrigin: "200px 200px"}}>
                <circle cx={CENTER} cy={CENTER} r="42" fill="var(--crown)" stroke="var(--outline)" strokeWidth="5" />
                <path
                    d="M180 208 L184 186 L192 197 L200 180 L208 197 L216 186 L220 208 Z"
                    fill="var(--outline)"
                />
                <rect x="180" y="212" width="40" height="6" rx="1" fill="var(--outline)" />
            </g>

            {/* Contenders. The holder is scaled up, crowned, and ringed. */}
            {SEATS.map((seat, i) => (
                <Contender
                    key={seat.deg}
                    x={seat.x}
                    y={seat.y}
                    color={COLORS[i]}
                    isHolder={i === holderSeat}
                />
            ))}
        </svg>
    );
}

function Contender({
    x,
    y,
    color,
    isHolder,
}: {
    x: number;
    y: number;
    color: string;
    isHolder: boolean;
}) {
    const size = isHolder ? 30 : 24;

    return (
        <g transform={`translate(${x} ${y})`}>
            {isHolder ? (
                <circle r={size + 10} fill="none" stroke="var(--crown)" strokeWidth="3" strokeDasharray="5 5" />
            ) : null}

            {/* Body — a rounded slab, deliberately simple so six of them read as a cast */}
            <rect
                x={-size / 2}
                y={-size / 2}
                width={size}
                height={size}
                rx={size / 3}
                fill={color}
                stroke="var(--outline)"
                strokeWidth="3.5"
            />

            {/* Eyes. The holder's are wide; everyone else is squinting at them. */}
            <circle cx={-size / 5} cy={-size / 12} r={isHolder ? 3.2 : 2.6} fill="var(--outline)" />
            <circle cx={size / 5} cy={-size / 12} r={isHolder ? 3.2 : 2.6} fill="var(--outline)" />

            {isHolder ? (
                <>
                    {/* Grin */}
                    <path d={`M${-size / 4} ${size / 6} Q0 ${size / 3} ${size / 4} ${size / 6}`} stroke="var(--outline)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    {/* Tiny crown on the head */}
                    <path
                        d={`M${-size / 2.4} ${-size / 1.6} l${size / 5} ${-size / 5} l${size / 5} ${size / 8} l${size / 5} ${-size / 4} l${size / 5} ${size / 5} Z`}
                        fill="var(--crown)"
                        stroke="var(--outline)"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                    />
                </>
            ) : (
                /* Flat mouth: unamused, plotting */
                <path d={`M${-size / 5} ${size / 5} L${size / 5} ${size / 5}`} stroke="var(--outline)" strokeWidth="2.5" strokeLinecap="round" />
            )}
        </g>
    );
}

/** A chunky crown mark for the wordmark and nav. */
export function CrownMark({className = ""}: {className?: string}) {
    return (
        <svg viewBox="0 0 48 40" className={className} aria-hidden="true">
            <path
                d="M6 12 11 32h26l5-20-9 8.5L24 6 15 20.5z"
                fill="currentColor"
                stroke="var(--outline)"
                strokeWidth="3.5"
                strokeLinejoin="round"
            />
            <rect x="10" y="33" width="28" height="5" rx="1.5" fill="currentColor" stroke="var(--outline)" strokeWidth="3" />
        </svg>
    );
}
