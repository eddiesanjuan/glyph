#!/bin/bash
#
# Ralph Perfection Loop - Relentless Score Chaser
#
# Runs /performance-sprint in cycles until composite score hits 99/100
# or max cycles reached. Be creative. Be bold. Don't break things.
#
# Usage:
#   ./ralph-performance.sh                    # Default: target 99, max 40 cycles
#   ./ralph-performance.sh --target 95        # Lower target
#   ./ralph-performance.sh --cycles 20        # Fewer cycles
#   ./ralph-performance.sh --timeout 60       # 60 min per cycle
#

cd /Users/eddiesanjuan/Projects/glyph

# IMPORTANT: Unset API key to use subscription instead of API credits
unset ANTHROPIC_API_KEY

# Ambitious defaults
TARGET_SCORE=99
MAX_CYCLES=40
CYCLE_TIMEOUT="45m"
FOCUS_PRIORITY=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --target|-t)
            TARGET_SCORE="$2"
            shift 2
            ;;
        --cycles|-c)
            MAX_CYCLES="$2"
            shift 2
            ;;
        --timeout)
            CYCLE_TIMEOUT="${2}m"
            shift 2
            ;;
        --priority|-p)
            FOCUS_PRIORITY="$2"
            shift 2
            ;;
        --help|-h)
            echo "Ralph Perfection Loop - Relentless Score Chaser"
            echo ""
            echo "Usage: ./ralph-performance.sh [options]"
            echo ""
            echo "Options:"
            echo "  --target, -t N     Target composite score (default: 99)"
            echo "  --cycles, -c N     Max cycles to run (default: 40)"
            echo "  --timeout N        Timeout per cycle in minutes (default: 45)"
            echo "  --priority, -p N   Focus on specific dimension (1-6)"
            echo "  --help, -h         Show this help"
            echo ""
            echo "Dimensions:"
            echo "  1. UX (25%)"
            echo "  2. Performance (15%)"
            echo "  3. Code Quality (10%)"
            echo "  4. Competitive (20%)"
            echo "  5. Polish (15%)"
            echo "  6. Documentation (15%)"
            echo ""
            echo "Philosophy:"
            echo "  - Be creative and bold"
            echo "  - Don't break core features"
            echo "  - Speed > fancy animations"
            echo "  - Most users are AI/MCP anyway"
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

CLAUDE_BIN="/Users/eddiesanjuan/.npm-global/bin/claude"
LOGFILE="plans/perfection-loop.log"
STATE_FILE=".claude/perfection-state.md"
FEEDBACK_FILE=".claude/CYCLE_FEEDBACK.md"
TIMEOUT_CMD="/opt/homebrew/opt/coreutils/libexec/gnubin/timeout"

# Ensure plans directory exists
mkdir -p plans

log() {
    echo "[$(TZ='America/Chicago' date '+%Y-%m-%d %H:%M:%S CST')] $1" | tee -a "$LOGFILE"
}

# Extract composite score from perfection-state.md
get_composite_score() {
    if [ -f "$STATE_FILE" ]; then
        # Look for COMPOSITE row in the scores table
        local score=$(grep -i "COMPOSITE" "$STATE_FILE" | grep -oE '[0-9]+\.?[0-9]*' | head -1)
        if [[ "$score" =~ ^[0-9]+\.?[0-9]*$ ]]; then
            echo "$score"
            return
        fi
    fi
    echo "0"
}

# Extract blockers from state file
get_blockers() {
    if [ -f "$STATE_FILE" ]; then
        blockers=$(sed -n '/## Blockers\|## Improvement Backlog/,/^##/p' "$STATE_FILE" | grep -E '^-|\| [0-9]' | head -10)
        if [ -n "$blockers" ]; then
            echo "$blockers"
            return
        fi
    fi
    echo "No specific blockers identified."
}

# Extract feedback from CYCLE_FEEDBACK.md
get_feedback() {
    if [ -f "$FEEDBACK_FILE" ]; then
        feedback=$(sed -n '/^---$/,$ p' "$FEEDBACK_FILE" | tail -n +2)
        if [ -n "$feedback" ] && ! echo "$feedback" | grep -q "No pending feedback"; then
            echo "$feedback"
            return
        fi
    fi
    echo ""
}

# Extract forbidden items from USER_DECISIONS.md
get_forbidden() {
    if [ -f ".claude/USER_DECISIONS.md" ]; then
        sed -n '/DO NOT ADD/,/^###/p' ".claude/USER_DECISIONS.md" | grep -E '^\| \*\*' | head -5
    else
        echo "| **Confetti animation** | NO CONFETTI EVER |"
        echo "| **Stripe styling button** | Too slow |"
        echo "| **Dishonest time estimates** | Trust > comfort |"
    fi
}

# Check if we should continue
should_continue() {
    local current_score=$1
    local iteration=$2

    # Check iteration limit
    if [ "$iteration" -ge "$MAX_CYCLES" ]; then
        return 1
    fi

    # Check if target reached
    if [[ "$current_score" =~ ^[0-9]+\.?[0-9]*$ ]]; then
        result=$(echo "$current_score >= $TARGET_SCORE" | bc -l 2>/dev/null)
        if [ "$result" = "1" ]; then
            return 1
        fi
    fi

    return 0
}

log ""
log "=============================================="
log "RALPH PERFECTION LOOP"
log "=============================================="
log "Mission: Push Glyph to $TARGET_SCORE/100"
log "Max Cycles: $MAX_CYCLES (~$((MAX_CYCLES * 45 / 60)) hours max)"
log "Philosophy: Be creative. Be bold. Don't break things."
log "Stop: Ctrl+\\ (backslash)"
log ""
log "Target: Every developer who tries Glyph becomes an advocate."
log ""

# Get initial score
current_score=$(get_composite_score)
log "Starting composite score: $current_score/100"
log "Gap to target: $(echo "$TARGET_SCORE - $current_score" | bc -l 2>/dev/null) points"
log ""

cycle=0
consecutive_no_improvement=0
last_score=$current_score

while should_continue "$current_score" "$cycle"; do
    cycle=$((cycle + 1))

    blockers=$(get_blockers)
    feedback=$(get_feedback)
    forbidden=$(get_forbidden)

    log ""
    log "=============================================="
    log "CYCLE $cycle of $MAX_CYCLES"
    log "=============================================="
    log "Current: $current_score/100 | Target: $TARGET_SCORE/100"
    log "Gap: $(echo "$TARGET_SCORE - $current_score" | bc -l 2>/dev/null) points"
    log "Started: $(TZ='America/Chicago' date '+%Y-%m-%d %H:%M CST')"
    if [ -n "$feedback" ]; then
        log "Feedback: YES (from Eddie)"
    fi
    log ""

    # Build feedback section
    FEEDBACK_SECTION=""
    if [ -n "$feedback" ]; then
        FEEDBACK_SECTION="
## FEEDBACK FROM EDDIE (READ FIRST)
$feedback

^^^ This feedback may override priorities. Pay attention.
"
    fi

    # Build the prompt
    PROMPT="/performance-sprint --creative

## CYCLE CONTEXT
- Cycle: $cycle of $MAX_CYCLES
- Current Score: $current_score/100
- Target Score: $TARGET_SCORE/100
- Gap: $(echo "$TARGET_SCORE - $current_score" | bc -l 2>/dev/null) points
- Consecutive cycles without improvement: $consecutive_no_improvement
$FEEDBACK_SECTION
## FORBIDDEN - ABSOLUTE (from USER_DECISIONS.md)
$forbidden

VIOLATION = IMMEDIATE REVERT. No exceptions.

## BLOCKERS FROM PREVIOUS CYCLE
$blockers

## PHILOSOPHY FOR THIS SESSION

You are not here to make safe, incremental changes. You are here to make Glyph
so good that every developer who tries it becomes an advocate.

BE CREATIVE:
- Add features competitors don't have
- Find hidden friction and eliminate it
- Create surprise-and-delight moments
- Think like a developer who just discovered Glyph

BE BOLD:
- Big improvements are fine if they don't break things
- Don't artificially constrain to small changes
- Revolutionary features > incremental polish

DON'T BREAK THINGS:
- Core demo flow must always work
- Instant actions must stay instant (<500ms)
- Mobile must remain usable
- No regressions on existing features

SPEED > FANCY:
- Fast completion beats pretty progress animations
- Most users are API/MCP anyway
- Simple progress steps are fine

## SUCCESS CRITERIA

This cycle succeeds if:
1. Composite score improves (or stays same if blocked)
2. No core features broken
3. All changes verified on production
4. Learnings documented for next cycle

After completing, output CYCLE_COMPLETE with score delta and STOP."

    # Run claude
    "$TIMEOUT_CMD" --kill-after=1m "$CYCLE_TIMEOUT" \
    "$CLAUDE_BIN" -p --dangerously-skip-permissions "$PROMPT" 2>&1 \
        | grep -v "This error originated either by throwing" \
        | grep -v "Error: No messages returned" \
        | grep -v "at hvK" \
        | grep -v "at process.processTicksAndRejections" \
        | grep -v "^$" \
        | tee -a "$LOGFILE"

    exit_code=${PIPESTATUS[0]}

    # Handle exit codes
    if [ $exit_code -eq 124 ]; then
        log ""
        log ">>> Cycle $cycle timed out after $CYCLE_TIMEOUT"
        log ">>> Checking results..."
    elif [ $exit_code -ne 0 ]; then
        log ""
        log ">>> Cycle $cycle ended (exit code: $exit_code)"
        log ">>> Checking results..."
    fi

    # Get updated score
    previous_score=$current_score
    current_score=$(get_composite_score)

    # Calculate delta
    if [[ "$current_score" =~ ^[0-9]+\.?[0-9]*$ ]] && [[ "$previous_score" =~ ^[0-9]+\.?[0-9]*$ ]]; then
        delta=$(echo "$current_score - $previous_score" | bc -l 2>/dev/null)
        if (( $(echo "$delta > 0" | bc -l 2>/dev/null) )); then
            delta_sign="+"
            consecutive_no_improvement=0
        elif (( $(echo "$delta == 0" | bc -l 2>/dev/null) )); then
            delta_sign=""
            consecutive_no_improvement=$((consecutive_no_improvement + 1))
        else
            delta_sign=""
            consecutive_no_improvement=$((consecutive_no_improvement + 1))
        fi
    else
        delta="?"
        delta_sign=""
    fi

    log ""
    log "=============================================="
    log "CYCLE $cycle COMPLETE"
    log "Score: $previous_score → $current_score (${delta_sign}${delta})"
    log "Gap remaining: $(echo "$TARGET_SCORE - $current_score" | bc -l 2>/dev/null)"
    log "=============================================="

    # Check for stagnation
    if [ $consecutive_no_improvement -ge 5 ]; then
        log ""
        log "WARNING: 5 consecutive cycles without improvement"
        log "Consider reviewing blockers or adjusting approach"
    fi

    # Check if target reached
    if [[ "$current_score" =~ ^[0-9]+\.?[0-9]*$ ]]; then
        result=$(echo "$current_score >= $TARGET_SCORE" | bc -l 2>/dev/null)
        if [ "$result" = "1" ]; then
            log ""
            log "=============================================="
            log "TARGET REACHED!"
            log "=============================================="
            log "Final Score: $current_score/100"
            log "Target was: $TARGET_SCORE/100"
            log "Total Cycles: $cycle"
            log ""
            log "Glyph is now world-class."
            break
        fi
    fi

    # Brief pause before next cycle
    if should_continue "$current_score" "$cycle"; then
        log ""
        log "Next cycle in 30 seconds... (Ctrl+C to stop)"
        sleep 30
    fi
done

# Final summary
log ""
log "=============================================="
log "RALPH PERFECTION LOOP FINISHED"
log "=============================================="
log "Total Cycles: $cycle"
log "Final Score: $current_score/100"
log "Target was: $TARGET_SCORE/100"

if [[ "$current_score" =~ ^[0-9]+\.?[0-9]*$ ]]; then
    result=$(echo "$current_score >= $TARGET_SCORE" | bc -l 2>/dev/null)
    if [ "$result" = "1" ]; then
        log ""
        log "STATUS: SUCCESS - Target achieved!"
    else
        log ""
        log "STATUS: Stopped at $cycle cycles"
        log "Gap: $(echo "$TARGET_SCORE - $current_score" | bc -l 2>/dev/null) points remaining"
    fi
fi

log ""
log "Full log: plans/perfection-loop.log"
log "State: .claude/perfection-state.md"
log ""
