# Research: Page Direction Detection Fix

## T001 — Live geometry capture (thread `100092115712908`)

Captured via `computeHorizontalMidpoint()`-equivalent script run in the live Business Suite tab (all 28 currently-mounted `[data-message-id]` elements):

```
minLeft: 579, maxRight: 1150, midpoint: 864.5
```

Two distinct groups of messages appeared, geometrically separated:
- **Older window** (rows 4-14): "lo a" (left=1100.20), "1"/"2"/"3"/"m" (mix of left=579 and left=1117.09) — spans the early Aug 7 conversation.
- **Newer window** (rows 21-27): "lo a" (left=1100.20, identical to the older window's copy), "what" (left=1092.20), "ok không" (left≈1061.06), "123456" (left=1072.61), "31321" (left=1081.5), "dâdadadada" (left=1037.02), "khoai quá" (left=1041.61).

"lo a" appears twice with *identical* geometry across both groups — the two groups are overlapping virtualization windows, not 28 independent messages with no structure. In this full snapshot (both windows mounted together), `minLeft=579` comes from a genuinely-incoming bubble ("alo"/"m"), so the midpoint (864.5) correctly splits everything: all 6 previously-misjudged messages compute `computedOutgoing: true` here — correct.

## T002 — Reproducing the bug from the newer window alone

Recomputing `minLeft`/`maxRight`/`midpoint` using *only* the newer window's own 7 values (as would happen if that's all that were mounted at scan time, e.g. right after opening the thread before scroll-back reveals older history):

```
minLeft = 1037.02 ("dâdadadada" - itself an OUTGOING message, not a genuine incoming anchor)
maxRight = 1150
midpoint = (1037.02 + 1150) / 2 = 1093.51
```

Testing each message's `left` against this contaminated midpoint:

| text | left | vs midpoint 1093.51 | computed | actual (Business Suite) |
|---|---|---|---|---|
| lo a | 1100.20 | > | outgoing (true) | outgoing — **correct** |
| what | 1092.20 | < | incoming (false) | outgoing — **wrong, matches bug** |
| ok không | ~1061.06 | < | incoming (false) | outgoing — **wrong, matches bug** |
| 123456 | 1072.61 | < | incoming (false) | outgoing — **wrong, matches bug** |
| 31321 | 1081.50 | < | incoming (false) | outgoing — **wrong, matches bug** |
| dâdadadada | 1037.02 | < (it IS minLeft) | incoming (false) | outgoing — **wrong, matches bug** |
| khoai quá | 1041.61 | < | incoming (false) | outgoing — **wrong, matches bug** |

This exactly reproduces the observed pattern from the backend logs — "lo a" always correct, all 6 others always wrong — with no other assumption needed.

## T003 — Root cause

`computeHorizontalMidpoint()` (`src/extension/page_content.js`) computes `minLeft`/`maxRight` fresh every scan tick from whatever `[data-message-id]` elements happen to be mounted *right now*. The formula implicitly assumes the mounted set always includes at least one genuinely-incoming bubble to anchor `minLeft` at the true left edge (~579 in this thread). Business Suite virtualizes the message list into scroll windows (confirmed by the duplicate "lo a" appearing identically in two overlapping windows above); a freshly-opened tab — or one whose `scrollBackForHistory()` hasn't yet revealed older history — can have only a *recent* window mounted. If that window happens to contain no genuinely-incoming message (plausible in a burst of consecutive outgoing replies, exactly this thread's shape), `minLeft` gets contaminated by the window's own leftmost *outgoing* bubble instead of a real incoming one. This collapses the incoming/outgoing split and pushes the midpoint far enough right that outgoing messages sitting toward the left of that (already right-shifted) outgoing cluster get classified as incoming.

This condition is transient (self-corrects once more history mounts, e.g. via scroll-back) but the extension has no memory across ticks — every tick recomputes from scratch, so a transient bad reading is just as "confident" as a correct one to the backend's hysteresis. During the tab-storm period (many tabs opening in quick succession, each starting in the "just opened, narrow window mounted" state), this bad-reading condition recurred often enough to trip `shouldCommitDirectionFlip()`'s two-consistent-observations threshold and commit the wrong value to the database.

## Superseded Conclusion (historical)

Fix: give `computeHorizontalMidpoint()` cross-tick memory, mirroring the existing `knownMessageTimestamps` pattern already used elsewhere in the same file for the identical class of problem ("this tick's mounted set is a subset of the truth, remember the widest range ever observed instead of trusting only the current tick"). Track the widest `minLeft`/`maxRight` ever observed for the current thread and use *that* remembered range for the midpoint, only narrowing it if a tick's genuinely wider observation appears (never letting a narrower/subset tick shrink the known range). Reset when the thread changes (same lifecycle as other per-thread state in this file).

This directly closes the reproduced gap without reintroducing the container/absolute-position approach the original code deliberately avoided (per its own comment, container-based detection "always fail[ed] closed to incoming" for this Business Suite layout).

Given the fix addresses the underlying measurement (not just the hysteresis symptom), Phase 2 (hysteresis defense, FR-004) is likely unnecessary once Phase 1 lands — the bad reading itself stops recurring, so hysteresis has nothing wrong left to (mis)confirm. Task list updated accordingly; T006 is deferred pending Phase 3 validation confirming no further flips occur.


## Revised Design Conclusion

The earlier conclusion that rememberedHorizontalRange was sufficient is superseded by the current reproduction and code review. That change helps only after a wider two-sided observation has already been observed. A first scan with only outgoing bubbles can still produce a wrong midpoint, and isMessageOutgoing also defaults a missing midpoint to false.

The implementation must therefore use container-relative edge evidence as the primary classifier and represent unknown explicitly in transport. Because the SQLite column is is_outgoing BOOLEAN NOT NULL DEFAULT 0, unknown cannot be represented by making that column nullable without a migration. The selected design is to add direction_status with confirmed and pending values. Pending rows retain identity/content and use is_outgoing=0 only as a storage placeholder; the UI and reconciliation logic must honor direction_status and never treat pending as confirmed incoming.

The pending state is required for retention. Dropping an unknown message would risk permanent loss when Business Suite unmounts the bubble before a later scan. Repeated observations must be idempotent by fb_message_id, and high-confidence evidence must promote or reconcile the same row in place.
