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
#   ./ralph-performance.sh --timeout 60       # 60 min per cycle (default: 90)
#

cd /Users/eddiesanjuan/Projects/glyph

# IMPORTANT: Unset API key to use subscription instead of API credits
unset ANTHROPIC_API_KEY

# Ambitious defaults
TARGET_SCORE=100
MAX_CYCLES=40
CYCLE_TIMEOUT="90m"
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
            echo "  --timeout N        Timeout per cycle in minutes (default: 90)"
            echo "  --priority, -p N   Focus on specific dimension (1-6)"
            echo "  --help, -h         Show this help"
            echo ""
            echo "Legacy Dimensions (pre-Cycle 29):"
            echo "  1. UX (25%) - now Playground/UX (10%)"
            echo "  2. Performance (15%)"
            echo "  3. Code Quality (10%) - folded into API/MCP"
            echo "  4. Competitive (20%) - now Airtable (20%)"
            echo "  5. Polish (15%) - folded into Playground/UX"
            echo "  6. Documentation (15%)"
            echo ""
            echo "Dimensions:"
            echo "  1. API/MCP Excellence (25%)"
            echo "  2. Airtable Integration (20%)"
            echo "  3. Template Ecosystem (15%)"
            echo "  4. Documentation (15%)"
            echo "  5. Performance (15%)"
            echo "  6. Playground/UX (10%)"
            echo ""
            echo "Philosophy:"
            echo "  - AI agents are the primary user"
            echo "  - Airtable integration is a key ecosystem play"
            echo "  - More templates > more playground polish"
            echo "  - Speed and reliability above all"
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
LEGACY_STATE_FILE=".claude/performance-sprint-state.md"
FEEDBACK_FILE=".claude/CYCLE_FEEDBACK.md"
TIMEOUT_CMD="/opt/homebrew/opt/coreutils/libexec/gnubin/timeout"
NUDGE_FILE="plans/.nudge-performance"

# Ensure plans directory exists
mkdir -p plans

log() {
    echo "[$(TZ='America/Chicago' date '+%Y-%m-%d %H:%M:%S CST')] $1" | tee -a "$LOGFILE"
}

# Extract composite score from perfection-state.md (primary) or performance-sprint-state.md (fallback)
get_composite_score() {
    # Primary: check perfection-state.md COMPOSITE table row
    if [ -f "$STATE_FILE" ]; then
        local composite_line=$(grep -i "COMPOSITE" "$STATE_FILE" | head -1)
        if [ -n "$composite_line" ]; then
            local score=$(echo "$composite_line" | awk -F'|' '{print $3}' | grep -oE '[0-9]+\.?[0-9]*' | head -1)
            if [[ "$score" =~ ^[0-9]+\.?[0-9]*$ ]]; then
                echo "$score"
                return
            fi
        fi
    fi
    # Fallback: check performance-sprint-state.md for "Composite Score: XX/100" pattern
    if [ -f "$LEGACY_STATE_FILE" ]; then
        local score_line=$(grep -i "Composite Score:" "$LEGACY_STATE_FILE" | tail -1)
        if [ -n "$score_line" ]; then
            local score=$(echo "$score_line" | grep -oE '[0-9]+\.?[0-9]*' | head -1)
            if [[ "$score" =~ ^[0-9]+\.?[0-9]*$ ]]; then
                echo "$score"
                return
            fi
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
log "Max Cycles: $MAX_CYCLES (~$((MAX_CYCLES * 90 / 60)) hours max)"
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

## STRATEGIC DIRECTION

AI agents are the primary user. The API and MCP server ARE the product.
Airtable integration is a key ecosystem play. The playground is marketing.

AGENTS ARE THE USER:
- Every feature must work perfectly via API/MCP
- Schema-first: agents discover templates, fill data, get PDFs
- Airtable power users and Omni AI should work seamlessly with Glyph
- More templates = faster adoption = less reason to look elsewhere

BE BOLD:
- More templates > more playground polish
- Airtable integration depth > browser UI features
- API reliability > animation smoothness

DON'T BREAK THINGS:
- API endpoints must always work — agents depend on reliability
- Template rendering must be consistent
- No regressions on existing features

SPEED > FANCY:
- Fast API responses beat pretty browser animations
- Most users are API/MCP anyway
- Simple progress steps are fine

NO SCOPE CREEP:
- NO visual drag-and-drop editor
- NO design tools for designers
- Focus: API, MCP, Airtable, templates, schemas, speed

## SUCCESS CRITERIA

This cycle succeeds if:
1. Composite score improves (or stays same if blocked)
2. No core features broken
3. All changes verified on production
4. Learnings documented for next cycle

After completing, output CYCLE_COMPLETE with score delta and STOP."

    # Run claude (track wall-clock time to detect quick exits)
    cycle_start_ts=$(date +%s)

    # Remove stale nudge file and record state file timestamp
    rm -f "$NUDGE_FILE"
    state_mtime_before=$(stat -f %m "$STATE_FILE" 2>/dev/null || echo "0")

    # Run Claude in background so we can monitor for completion signals
    "$TIMEOUT_CMD" --kill-after=1m "$CYCLE_TIMEOUT" \
    "$CLAUDE_BIN" -p --dangerously-skip-permissions --debug-file "plans/performance-debug-cycle-${cycle}.log" "$PROMPT" 2>&1 \
        | grep -v "This error originated either by throwing" \
        | grep -v "Error: No messages returned" \
        | grep -v "at hvK" \
        | grep -v 'at \$bK' \
        | grep -v "at process.processTicksAndRejections" \
        | grep -v "Output blocked by content filtering" \
        | grep -v "^$" \
        | tee -a "$LOGFILE" &

    CLAUDE_PID=$!
    state_changed_at=0

    # Watch for: manual nudge OR state file change (work done)
    while kill -0 $CLAUDE_PID 2>/dev/null; do
        # Manual nudge
        if [ -f "$NUDGE_FILE" ]; then
            log ""
            log ">>> NUDGE received - advancing to next cycle"
            rm -f "$NUDGE_FILE"
            kill $CLAUDE_PID 2>/dev/null
            break
        fi

        # Auto-detect: state file changed = work is done
        state_mtime_now=$(stat -f %m "$STATE_FILE" 2>/dev/null || echo "0")
        if [ "$state_mtime_now" != "$state_mtime_before" ] && [ "$state_changed_at" = "0" ]; then
            state_changed_at=$(date +%s)
            log ""
            log ">>> State file updated - work complete, waiting 60s grace period..."
        fi

        # Grace period: 60s after state change, auto-advance
        if [ "$state_changed_at" != "0" ]; then
            elapsed=$(($(date +%s) - state_changed_at))
            if [ $elapsed -ge 60 ]; then
                log ">>> Grace period done - advancing to next cycle"
                kill $CLAUDE_PID 2>/dev/null
                break
            fi
        fi

        sleep 5
    done

    # Wait for Claude to finish and get exit code
    wait $CLAUDE_PID 2>/dev/null
    exit_code=$?
    cycle_end_ts=$(date +%s)
    cycle_duration=$((cycle_end_ts - cycle_start_ts))

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

    # Detect quick exits (< 3 min) — likely a failed/empty run
    if [ $cycle_duration -lt 180 ] && [ $exit_code -ne 124 ]; then
        log ""
        log ">>> Cycle $cycle finished in ${cycle_duration}s (< 3 min) — likely a failed run"
        log ">>> NOT counting as a real cycle. Retrying in 15 seconds..."
        cycle=$((cycle - 1))  # Don't count this cycle
        sleep 15
        continue
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
