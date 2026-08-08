// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Rebutan} from "../src/Rebutan.sol";

/**
 * Ordered to match spec §F.7. The money tests are the ones that must never be
 * cut under time pressure: a bug in `claim` strands real stakes, and unlike a UI
 * bug it cannot be fixed after deployment.
 */
contract RebutanTest is Test {
    Rebutan game;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    uint64 constant SESSION = 300; // stages at +100 / +200
    uint256 constant STAKE = 0.1 ether;

    function setUp() public {
        vm.roll(1000); // start well clear of block 0
        game = new Rebutan(SESSION);
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(carol, 10 ether);
    }

    function _join(address who) internal {
        vm.prank(who);
        game.join{value: STAKE}();
    }

    function _joinAll() internal {
        _join(alice);
        _join(bob);
        _join(carol);
    }

    // ─── Core ────────────────────────────────────────────────────────────────

    /// 1. join registers the player and grows the pot
    function test_JoinRegistersAndGrowsPot() public {
        _join(alice);
        assertTrue(game.joined(1, alice));
        assertEq(game.current().pot, STAKE);
        assertEq(game.current().players, 1);
    }

    /// 2. join twice reverts; wrong value reverts
    function test_JoinTwiceReverts() public {
        _join(alice);
        vm.prank(alice);
        vm.expectRevert(Rebutan.AlreadyJoined.selector);
        game.join{value: STAKE}();
    }

    function test_JoinWrongStakeReverts() public {
        vm.prank(alice);
        vm.expectRevert(Rebutan.WrongStake.selector);
        game.join{value: 0.05 ether}();
    }

    /// 3. steal by a non-joined address reverts
    function test_StealWithoutJoiningReverts() public {
        vm.prank(alice);
        vm.expectRevert(Rebutan.NotJoined.selector);
        game.steal();
    }

    /// 4. first steal takes the crown and credits nothing to address(0)
    function test_FirstStealCreditsNobody() public {
        _join(alice);
        vm.roll(block.number + 20); // 20 blocks elapse with no holder
        vm.prank(alice);
        game.steal();

        assertEq(game.current().holder, alice);
        // The 20 ownerless blocks must not enter the pool, or that share of the
        // pot becomes permanently unclaimable.
        assertEq(game.current().totalWeighted, 0);
    }

    /// 5. steal inside MIN_REIGN reverts
    function test_StealInsideMinReignReverts() public {
        _joinAll();
        vm.prank(alice);
        game.steal();

        vm.roll(block.number + 1); // < MIN_REIGN (3)
        vm.prank(bob);
        vm.expectRevert(Rebutan.CrownProtected.selector);
        game.steal();
    }

    /// 6. steal inside personal cooldown reverts
    /// @dev Isolating CoolingDown needs a block where the crown is exposed but
    ///      the caller is not ready. Since cooldown grows 3/6/9 while protection
    ///      is always 3, alice must steal three times before her cooldown
    ///      outlasts the crown's protection.
    function test_StealInsideCooldownReverts() public {
        _joinAll();

        vm.roll(1000);
        vm.prank(alice);
        game.steal(); // alice cd -> 1003, protected to 1003
        vm.roll(1003);
        vm.prank(bob);
        game.steal(); // protected to 1006
        vm.roll(1006);
        vm.prank(alice);
        game.steal(); // alice cd -> 1012, protected to 1009
        vm.roll(1009);
        vm.prank(bob);
        game.steal(); // protected to 1012
        vm.roll(1012);
        vm.prank(alice);
        game.steal(); // alice cd -> 1021, protected to 1015
        vm.roll(1015);
        vm.prank(bob);
        game.steal(); // protected to 1018

        // At 1018 the crown is exposed but alice is cooling until 1021.
        vm.roll(1018);
        assertEq(game.protectionRemaining(), 0, "crown should be exposed");
        assertGt(game.cooldownRemaining(alice), 0, "alice should be cooling");

        vm.prank(alice);
        vm.expectRevert(Rebutan.CoolingDown.selector);
        game.steal();
    }

    /// 7. cooldown grows 3 -> 6 -> 9
    function test_CooldownGrowsPerSteal() public {
        _joinAll();

        vm.prank(alice);
        game.steal();
        assertEq(game.nextStealAllowed(1, alice), uint64(block.number) + 3);

        vm.roll(block.number + 3);
        vm.prank(bob);
        game.steal();
        vm.roll(block.number + 3);

        vm.prank(alice);
        game.steal();
        assertEq(game.nextStealAllowed(1, alice), uint64(block.number) + 6);

        vm.roll(block.number + 6);
        vm.prank(bob);
        game.steal();
        vm.roll(block.number + 3);

        vm.prank(alice);
        game.steal();
        assertEq(game.nextStealAllowed(1, alice), uint64(block.number) + 9);
    }

    /// 8. the holder cannot steal from themselves
    function test_HolderCannotSelfSteal() public {
        _joinAll();
        vm.prank(alice);
        game.steal();
        vm.roll(block.number + 5);

        vm.prank(alice);
        vm.expectRevert(Rebutan.AlreadyYours.selector);
        game.steal();
    }

    /// 9. settle credits the final holder once; a second call reverts
    function test_SettleCreditsFinalHolderOnce() public {
        _joinAll();
        vm.prank(alice);
        game.steal();

        vm.roll(1000 + SESSION);
        game.settle();

        uint64 held = game.weightedHeld(1, alice);
        assertGt(held, 0);

        vm.expectRevert(Rebutan.SessionClosed.selector);
        game.settle();

        assertEq(game.weightedHeld(1, alice), held);
    }

    function test_SettleBeforeEndReverts() public {
        vm.expectRevert(Rebutan.SessionRunning.selector);
        game.settle();
    }

    // ─── Money — never cut ───────────────────────────────────────────────────

    /// 10. claim pays the endurance share plus the long-reign bonus
    function test_ClaimPaysProRataPlusBonus() public {
        _joinAll();

        vm.prank(alice);
        game.steal();
        vm.roll(block.number + 10);

        vm.prank(bob);
        game.steal();
        vm.roll(1000 + SESSION);
        game.settle();

        uint256 pot = game.current().pot;
        uint64 total = game.current().totalWeighted;
        address best = game.current().bestReignHolder;

        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        game.claim(1);

        uint256 expected = (pot * 7000 * game.weightedHeld(1, alice)) / (10000 * total);
        if (best == alice) expected += (pot * 3000) / 10000;

        assertEq(alice.balance - aliceBefore, expected);
    }

    /// 11. claim twice reverts
    function test_ClaimTwiceReverts() public {
        _joinAll();
        vm.prank(alice);
        game.steal();
        vm.roll(1000 + SESSION);
        game.settle();

        vm.prank(alice);
        game.claim(1);

        vm.prank(alice);
        vm.expectRevert(Rebutan.AlreadyClaimed.selector);
        game.claim(1);
    }

    /// 12. total paid out never exceeds the pot, and the remainder is dust
    function test_ClaimsNeverExceedPot() public {
        _joinAll();

        vm.prank(alice);
        game.steal();
        vm.roll(block.number + 7);
        vm.prank(bob);
        game.steal();
        vm.roll(block.number + 11);
        vm.prank(carol);
        game.steal();

        vm.roll(1000 + SESSION);
        game.settle();

        uint256 pot = game.current().pot;
        uint256 paid;

        address[3] memory players = [alice, bob, carol];
        for (uint256 i = 0; i < players.length; i++) {
            uint256 before = players[i].balance;
            vm.prank(players[i]);
            game.claim(1);
            paid += players[i].balance - before;
        }

        assertLe(paid, pot, "paid out more than the pot");
        // Dust from integer division: at most a few wei, never a meaningful loss.
        assertLe(pot - paid, 10, "unexpectedly large remainder");
    }

    /// 13. if nobody ever held the crown, stakes are refunded rather than stranded
    function test_RefundsWhenNobodyHeldCrown() public {
        _join(alice);
        _join(bob);

        vm.roll(1000 + SESSION);
        game.settle();

        assertEq(game.current().totalWeighted, 0);

        uint256 before = alice.balance;
        vm.prank(alice);
        game.claim(1);
        assertEq(alice.balance - before, STAKE, "stake not refunded");
    }

    function test_ClaimBeforeSettleReverts() public {
        _join(alice);
        vm.prank(alice);
        vm.expectRevert(Rebutan.NotSettled.selector);
        game.claim(1);
    }

    // ─── Stages, fortify, record ─────────────────────────────────────────────

    /// 14. a reign straddling a stage boundary splits at the correct multiplier
    function test_StageWeightingSplitsAcrossBoundary() public {
        _joinAll();

        // Stage 1 spans [1000, 1100), stage 2 [1100, 1200), stage 3 [1200, 1300).
        vm.roll(1090);
        vm.prank(alice);
        game.steal(); // hold from 1090

        vm.roll(1110); // 10 blocks at 1x, 10 blocks at 2x = 30
        vm.prank(bob);
        game.steal();

        assertEq(game.weightedHeld(1, alice), 30, "boundary split incorrect");
    }

    function test_Stage3PaysTriple() public {
        _joinAll();

        vm.roll(1210); // inside stage 3
        vm.prank(alice);
        game.steal();
        vm.roll(1220); // 10 blocks at 3x
        vm.prank(bob);
        game.steal();

        assertEq(game.weightedHeld(1, alice), 30);
    }

    /// FORTIFY buys protection and costs earnings
    function test_FortifyProtectsAndCostsEarnings() public {
        _joinAll();

        vm.roll(1010);
        vm.prank(alice);
        game.steal();

        vm.roll(1015);
        vm.prank(alice);
        game.fortify(); // protection to 1023, earnings clock 1010 -> 1014

        // bob cannot take it while fortified
        vm.roll(1020);
        vm.prank(bob);
        vm.expectRevert(Rebutan.CrownProtected.selector);
        game.steal();

        vm.roll(1023);
        vm.prank(bob);
        game.steal();

        // held 1010..1023 = 13 raw, minus 4 forfeited = 9 (all stage 1)
        assertEq(game.weightedHeld(1, alice), 9, "fortify cost not applied");
    }

    /// Fortifying instantly must still cost a full 4 blocks, not be free.
    function test_InstantFortifyStillCostsFourBlocks() public {
        _joinAll();

        vm.roll(1010);
        vm.prank(alice);
        game.steal();

        vm.prank(alice);
        game.fortify(); // same block: earnings clock 1010 -> 1014

        vm.roll(1018);
        vm.prank(bob);
        game.steal();

        // 1010..1018 is 8 raw blocks, minus the 4 forfeited = 4
        assertEq(game.weightedHeld(1, alice), 4, "instant fortify was free");
    }

    function test_FortifyOnlyOncePerReign() public {
        _joinAll();
        vm.roll(1010);
        vm.prank(alice);
        game.steal();

        vm.prank(alice);
        game.fortify();

        vm.prank(alice);
        vm.expectRevert(Rebutan.AlreadyFortified.selector);
        game.fortify();
    }

    function test_NonHolderCannotFortify() public {
        _joinAll();
        vm.roll(1010);
        vm.prank(alice);
        game.steal();

        vm.prank(bob);
        vm.expectRevert(Rebutan.NotHolder.selector);
        game.fortify();
    }

    /// The long-reign bonus tracks raw blocks and ignores the fortify penalty.
    /// @dev The final holder accrues all the way to `endsAt`, so bob must take
    ///      the crown late — otherwise he wins the bonus legitimately by simply
    ///      being last, which tests nothing about fortify.
    function test_LongReignIgnoresFortifyPenalty() public {
        _joinAll();

        vm.roll(1010);
        vm.prank(alice);
        game.steal();
        vm.prank(alice);
        game.fortify(); // earnings clock 1010 -> 1014; raw reign clock untouched

        vm.roll(1290); // alice: 280 raw blocks
        vm.prank(bob);
        game.steal();

        vm.roll(1000 + SESSION); // bob: only 10 raw blocks
        game.settle();

        assertEq(game.current().bestReignHolder, alice, "fortify cost the bonus");
        assertEq(game.current().bestReign, 280, "raw reign should ignore fortify");

        // Earnings, unlike the bonus, DO carry the 4-block cost:
        // stage1 1014..1100 = 86, stage2 1100..1200 = 100*2, stage3 1200..1290 = 90*3
        assertEq(game.weightedHeld(1, alice), 86 + 200 + 270, "fortify cost misapplied");
    }

    /// 15. reignRecord accumulates across sessions and survives a new one
    function test_ReignRecordPersistsAcrossSessions() public {
        _joinAll();
        vm.roll(1010);
        vm.prank(alice);
        game.steal();

        vm.roll(1000 + SESSION);
        game.settle();

        uint64 first = game.reignRecord(alice);
        assertGt(first, 0);

        game.startSession(SESSION);
        assertEq(game.sessionId(), 2);
        // session-scoped state resets...
        assertEq(game.weightedHeld(2, alice), 0);
        assertEq(game.current().pot, 0);
        // ...but the record does not
        assertEq(game.reignRecord(alice), first);
    }

    function test_CannotStartSessionWhileLive() public {
        vm.expectRevert(Rebutan.SessionLive.selector);
        game.startSession(SESSION);
    }

    function test_SessionLengthBounds() public {
        vm.roll(1000 + SESSION);
        game.settle();

        vm.expectRevert(Rebutan.BadSessionLength.selector);
        game.startSession(10);

        vm.expectRevert(Rebutan.BadSessionLength.selector);
        game.startSession(100_000);
    }

    // ─── Invariant-ish ───────────────────────────────────────────────────────

    /// The contract must never hold less than it owes after a full settle.
    function testFuzz_PotAlwaysCoversClaims(uint8 rounds) public {
        rounds = uint8(bound(rounds, 1, 20));
        _joinAll();

        address[3] memory players = [alice, bob, carol];
        uint64 blockNo = 1005;

        for (uint256 i = 0; i < rounds; i++) {
            address who = players[i % 3];
            if (who == game.current().holder) continue;
            if (blockNo >= 1000 + SESSION - 5) break;

            vm.roll(blockNo);
            if (block.number < game.nextStealAllowed(1, who)) {
                blockNo += 5;
                continue;
            }
            vm.prank(who);
            game.steal();
            blockNo += 6;
        }

        vm.roll(1000 + SESSION);
        game.settle();

        uint256 pot = game.current().pot;
        uint256 paid;
        for (uint256 i = 0; i < players.length; i++) {
            uint256 before = players[i].balance;
            vm.prank(players[i]);
            game.claim(1);
            paid += players[i].balance - before;
        }

        assertLe(paid, pot);
        assertLe(address(game).balance, pot);
    }
}
