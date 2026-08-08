// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title  Rebutan — one crown, and you are paid by the block for holding it
 * @notice A contested single-holder position on Monad. Players stake a fixed
 *         entry, fight over one crown, and earn a share of the pot for every
 *         block they hold it. Blocks inside the later stages are worth more.
 *
 * @dev WHY BLOCKS AND NEVER TIMESTAMPS
 *      Monad produces a block roughly every 400ms, so two or three consecutive
 *      blocks share the same `block.timestamp` (which has one-second
 *      resolution). Metering this game in seconds would collapse most reigns to
 *      zero and tie the rest. Every clock here is `block.number`. That is not a
 *      stylistic choice — it is the only unit fine enough to express the game,
 *      and it is why the design does not transfer to a slower chain.
 *
 * @dev NO OWNER, NO ADMIN, NO PRIVILEGED PATH
 *      There is no function only one address may call. Nothing can be paused,
 *      drained, or reconfigured. `startSession` is permissionless and bounded.
 *
 * @dev SESSIONS
 *      One deployment hosts many sessions. Per-session state is namespaced by
 *      `sessionId` so a new round needs no redeploy — during an event you call
 *      `startSession` instead of shipping a new contract under time pressure.
 *      `reignRecord` deliberately sits outside that namespace: it is the only
 *      thing that survives a session, and it is non-transferable.
 */
contract Rebutan {
    // ─── Economics ───────────────────────────────────────────────────────────

    /// @notice Fixed entry stake. Never escalates — an escalating price would
    ///         make MON a consumable and strand players behind a rate-limited
    ///         faucet mid-game.
    uint256 public constant STAKE = 0.1 ether;

    /// @notice Pot split in basis points: pro-rata endurance vs single longest reign.
    uint256 public constant ENDURANCE_BPS = 7_000;
    uint256 public constant LONG_REIGN_BPS = 3_000;
    uint256 private constant BPS = 10_000;

    // ─── Tempo ───────────────────────────────────────────────────────────────

    /// @notice Blocks a freshly taken crown cannot be stolen (~1.2s).
    ///         Deliberately equal to Monad's reserve-balance throttle: an account
    ///         under 10 MON may only transact once every 3 blocks, so this caps
    ///         churn at the same rate the chain already caps it, and it holds
    ///         even against an attacker spreading steals across many addresses.
    uint64 public constant MIN_REIGN = 3;

    /// @notice Each steal you make adds this to *your own* cooldown: 3, 6, 9…
    ///         Steals are rationed by time, not money.
    uint64 public constant COOLDOWN_STEP = 3;

    /// @notice FORTIFY buys this many blocks of protection…
    uint64 public constant FORTIFY_PROTECT = 8;
    /// @notice …and costs this many blocks of earnings.
    uint64 public constant FORTIFY_COST = 4;

    /// @notice Bounds on `startSession`, so permissionless cannot mean absurd.
    uint64 public constant MIN_SESSION_BLOCKS = 150; // ~60s
    uint64 public constant MAX_SESSION_BLOCKS = 27_000; // ~3h

    // ─── State ───────────────────────────────────────────────────────────────

    struct Session {
        uint64 startBlock;
        uint64 stage2At;
        uint64 stage3At;
        uint64 endsAt;
        address holder;
        /// @dev Earnings clock. FORTIFY pushes this *forward*, which is how
        ///      forfeiting income is expressed. It may legitimately exceed the
        ///      current block; weighting treats an inverted range as zero.
        uint64 since;
        /// @dev Raw unbroken-reign clock, untouched by FORTIFY. Separate from
        ///      `since` so defending never costs you the long-reign bonus.
        uint64 reignStart;
        uint64 protectedUntil;
        bool fortified;
        bool settled;
        uint256 pot;
        uint64 totalWeighted;
        uint64 bestReign;
        address bestReignHolder;
        uint32 players;
    }

    uint32 public sessionId;

    /// @dev Internal, not public. Solidity's auto-generated getter destructures
    ///      all 15 fields onto the stack and overflows it with the optimizer
    ///      disabled — and the optimizer stays disabled because enabling it (or
    ///      via-IR) is what reintroduces MCOPY, which Monad cannot execute.
    ///      `session()` below returns the struct by memory pointer instead.
    mapping(uint32 => Session) internal sessions;

    mapping(uint32 => mapping(address => bool)) public joined;
    mapping(uint32 => mapping(address => uint64)) public weightedHeld;
    mapping(uint32 => mapping(address => uint64)) public nextStealAllowed;
    mapping(uint32 => mapping(address => uint32)) public stealCount;
    mapping(uint32 => mapping(address => bool)) public claimed;

    /// @notice Cumulative weighted blocks across every session. Soulbound:
    ///         no transfer, no approval, no way to move it between addresses.
    mapping(address => uint64) public reignRecord;

    // ─── Events ──────────────────────────────────────────────────────────────

    event SessionStarted(uint32 indexed session, uint64 startBlock, uint64 endsAt);
    event Joined(uint32 indexed session, address indexed player, uint256 pot, uint32 players);
    event Stolen(
        uint32 indexed session,
        address indexed from,
        address indexed to,
        uint64 atBlock,
        uint64 weightedCredited
    );
    event Fortified(uint32 indexed session, address indexed holder, uint64 protectedUntil);
    event Settled(uint32 indexed session, address finalHolder, uint64 totalWeighted, address bestReignHolder);
    event Claimed(uint32 indexed session, address indexed player, uint256 amount);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error SessionRunning();
    error SessionClosed();
    error SessionLive();
    error BadSessionLength();
    error AlreadyJoined();
    error NotJoined();
    error WrongStake();
    error CrownProtected();
    error CoolingDown();
    error AlreadyYours();
    error NotHolder();
    error AlreadyFortified();
    error NotSettled();
    error AlreadyClaimed();
    error TransferFailed();

    // ─── Lifecycle ───────────────────────────────────────────────────────────

    constructor(uint64 sessionBlocks) {
        _startSession(sessionBlocks);
    }

    /// @notice Open the next session. Permissionless by design — there is no
    ///         owner — but bounded in length and blocked while one is live.
    function startSession(uint64 sessionBlocks) external {
        Session storage s = sessions[sessionId];
        if (!s.settled) revert SessionLive();
        _startSession(sessionBlocks);
    }

    function _startSession(uint64 sessionBlocks) private {
        if (sessionBlocks < MIN_SESSION_BLOCKS || sessionBlocks > MAX_SESSION_BLOCKS) {
            revert BadSessionLength();
        }

        uint32 id = ++sessionId;
        uint64 start = uint64(block.number);
        uint64 third = sessionBlocks / 3;

        Session storage s = sessions[id];
        s.startBlock = start;
        s.stage2At = start + third;
        s.stage3At = start + (third * 2);
        s.endsAt = start + sessionBlocks;
        s.since = start;
        s.reignStart = start;
        // holder stays address(0): blocks before the first steal belong to nobody
        // and must never enter `totalWeighted`, or that share of the pot is
        // permanently unclaimable.

        emit SessionStarted(id, start, s.endsAt);
    }

    // ─── Playing ─────────────────────────────────────────────────────────────

    /// @notice Enter the current session. One stake, once, never escalating.
    function join() external payable {
        uint32 id = sessionId;
        Session storage s = sessions[id];

        if (block.number >= s.endsAt) revert SessionClosed();
        if (joined[id][msg.sender]) revert AlreadyJoined();
        if (msg.value != STAKE) revert WrongStake();

        joined[id][msg.sender] = true;
        s.pot += msg.value;
        unchecked {
            s.players += 1;
        }

        emit Joined(id, msg.sender, s.pot, s.players);
    }

    /// @notice Take the crown. Costs gas only — the price of stealing is paid in
    ///         cooldown, which is why running out of MON can never eliminate you.
    function steal() external {
        uint32 id = sessionId;
        Session storage s = sessions[id];

        if (block.number >= s.endsAt) revert SessionClosed();
        if (!joined[id][msg.sender]) revert NotJoined();
        if (msg.sender == s.holder) revert AlreadyYours();
        if (block.number < s.protectedUntil) revert CrownProtected();
        if (block.number < nextStealAllowed[id][msg.sender]) revert CoolingDown();

        address previous = s.holder;
        uint64 credited = _credit(id, s, uint64(block.number));

        uint64 nowBlock = uint64(block.number);
        s.holder = msg.sender;
        s.since = nowBlock;
        s.reignStart = nowBlock;
        s.protectedUntil = nowBlock + MIN_REIGN;
        s.fortified = false;

        unchecked {
            stealCount[id][msg.sender] += 1;
        }
        nextStealAllowed[id][msg.sender] = nowBlock + (COOLDOWN_STEP * stealCount[id][msg.sender]);

        emit Stolen(id, previous, msg.sender, nowBlock, credited);
    }

    /// @notice Defend the crown: buy protection, pay for it in earnings.
    /// @dev The cost is applied by pushing the earnings clock forward, which may
    ///      move it past the current block. That is intentional — it means
    ///      fortifying the instant you steal still costs a full 4 blocks rather
    ///      than being free, which a clamp to `block.number` would have allowed.
    function fortify() external {
        uint32 id = sessionId;
        Session storage s = sessions[id];

        if (block.number >= s.endsAt) revert SessionClosed();
        if (msg.sender != s.holder) revert NotHolder();
        if (s.fortified) revert AlreadyFortified();

        s.fortified = true;
        s.protectedUntil = uint64(block.number) + FORTIFY_PROTECT;
        s.since += FORTIFY_COST;

        emit Fortified(id, msg.sender, s.protectedUntil);
    }

    /// @notice Close the session and bank the final reign. Anyone may call it;
    ///         nothing is claimable until someone does.
    function settle() external {
        uint32 id = sessionId;
        Session storage s = sessions[id];

        if (block.number < s.endsAt) revert SessionRunning();
        if (s.settled) revert SessionClosed();

        // Earnings stop at endsAt, not at whenever settle happens to be called,
        // so a late settle cannot inflate the last holder's take.
        _credit(id, s, s.endsAt);
        s.settled = true;

        emit Settled(id, s.holder, s.totalWeighted, s.bestReignHolder);
    }

    /// @notice Take your payout. Pull-based: the contract never pushes funds.
    function claim(uint32 id) external {
        Session storage s = sessions[id];

        if (!s.settled) revert NotSettled();
        if (!joined[id][msg.sender]) revert NotJoined();
        if (claimed[id][msg.sender]) revert AlreadyClaimed();

        // Effects before interaction — the reentrancy guard is the ordering,
        // not a modifier.
        claimed[id][msg.sender] = true;

        uint256 amount;
        if (s.totalWeighted == 0) {
            // Nobody ever held the crown, so there is nothing to divide by.
            // Refund rather than strand the pot.
            amount = STAKE;
        } else {
            // Multiply before dividing: dividing first would round the endurance
            // pool down before it is split, losing precision on every share.
            amount = (s.pot * ENDURANCE_BPS * weightedHeld[id][msg.sender])
                / (BPS * s.totalWeighted);
            if (msg.sender == s.bestReignHolder) {
                amount += (s.pot * LONG_REIGN_BPS) / BPS;
            }
        }

        if (amount > 0) {
            (bool ok,) = msg.sender.call{value: amount}("");
            if (!ok) revert TransferFailed();
        }

        emit Claimed(id, msg.sender, amount);
    }

    // ─── Scoring ─────────────────────────────────────────────────────────────

    /// @dev Bank the outgoing holder's reign. Returns the weighted blocks added.
    function _credit(uint32 id, Session storage s, uint64 upTo) private returns (uint64 weighted) {
        address h = s.holder;
        if (h == address(0)) return 0;

        weighted = _weightedBlocks(s, s.since, upTo);
        if (weighted > 0) {
            weightedHeld[id][h] += weighted;
            s.totalWeighted += weighted;
            reignRecord[h] += weighted;
        }

        // Raw, unweighted, and unaffected by FORTIFY: the long-reign bonus
        // rewards holding on, not holding at a lucrative moment.
        uint64 raw = upTo > s.reignStart ? upTo - s.reignStart : 0;
        if (raw > s.bestReign) {
            s.bestReign = raw;
            s.bestReignHolder = h;
        }
    }

    /// @dev Blocks in [from, to) weighted 1x / 2x / 3x by stage. Three fixed
    ///      interval intersections — no loop, no unbounded work.
    function _weightedBlocks(Session storage s, uint64 from, uint64 to)
        private
        view
        returns (uint64)
    {
        if (to <= from) return 0; // inverted range (post-FORTIFY) earns nothing

        return _overlap(from, to, s.startBlock, s.stage2At)
            + (_overlap(from, to, s.stage2At, s.stage3At) * 2)
            + (_overlap(from, to, s.stage3At, s.endsAt) * 3);
    }

    function _overlap(uint64 a0, uint64 a1, uint64 b0, uint64 b1) private pure returns (uint64) {
        uint64 lo = a0 > b0 ? a0 : b0;
        uint64 hi = a1 < b1 ? a1 : b1;
        return hi > lo ? hi - lo : 0;
    }

    // ─── Views (display only) ────────────────────────────────────────────────

    /// @notice Full state of a session, returned by memory pointer.
    function session(uint32 id) external view returns (Session memory) {
        return sessions[id];
    }

    /// @notice Full state of the session currently in play.
    function current() external view returns (Session memory) {
        return sessions[sessionId];
    }

    /// @notice 1, 2, or 3 — the multiplier blocks are currently earning at.
    function currentStage() external view returns (uint8) {
        Session storage s = sessions[sessionId];
        if (block.number >= s.endsAt) return 0;
        if (block.number >= s.stage3At) return 3;
        if (block.number >= s.stage2At) return 2;
        return 1;
    }

    /// @notice Weighted blocks the current holder would bank if dethroned now.
    function pendingWeighted() external view returns (uint64) {
        Session storage s = sessions[sessionId];
        if (s.holder == address(0)) return 0;
        uint64 upTo = uint64(block.number) < s.endsAt ? uint64(block.number) : s.endsAt;
        return _weightedBlocks(s, s.since, upTo);
    }

    /// @notice Blocks until the caller may steal again. Zero means ready.
    function cooldownRemaining(address player) external view returns (uint64) {
        uint64 ready = nextStealAllowed[sessionId][player];
        return ready > block.number ? ready - uint64(block.number) : 0;
    }

    /// @notice Blocks until the crown may be taken. Zero means exposed.
    function protectionRemaining() external view returns (uint64) {
        uint64 until = sessions[sessionId].protectedUntil;
        return until > block.number ? until - uint64(block.number) : 0;
    }
}
