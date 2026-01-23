#!/bin/bash
#
# Ralph Wiggum Addiction Audit Loop - Score-Driven Version
#
# Runs autonomously until addiction score reaches target or max cycles hit.
# Passes blockers between iterations for laser focus.
#
# Usage:
#   ./ralph-addiction.sh                    # Default: target 9.85, max 10 cycles
#   ./ralph-addiction.sh --cycles 5         # Run exactly 5 cycles
#   ./ralph-addiction.sh --target 9.5       # Run until score hits 9.5
#   ./ralph-addiction.sh --cycles 3 --target 9.0  # Combine both
#

cd /Users/eddiesanjuan/Projects/glyph

# IMPORTANT: Unset API key to use subscription instead of API credits
unset ANTHROPIC_API_KEY

# Defaults
TARGET_SCORE=9.85
MAX_ITERATIONS=10

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --cycles|-c)
            MAX_ITERATIONS="$2"
            shift 2
            ;;
        --target|-t)
            TARGET_SCORE="$2"
            shift 2
            ;;
        *)
            # Legacy positional args: first is target, second is max
            if [[ "$1" =~ ^[0-9]+\.?[0-9]*$ ]]; then
                TARGET_SCORE="$1"
                if [[ -n "$2" && "$2" =~ ^[0-9]+$ ]]; then
                    MAX_ITERATIONS="$2"
                    shift
                fi
            fi
            shift
            ;;
    esac
done

CLAUDE_BIN="/Users/eddiesanjuan/.npm-global/bin/claude"
LOGFILE="plans/ralph-loop.log"
STATE_FILE=".claude/VERIFIED_STATE.md"
TIMEOUT_CMD="/opt/homebrew/opt/coreutils/libexec/gnubin/timeout"
CYCLE_TIMEOUT="30m"  # Kill cycle after 30 minutes

# Ensure plans directory exists
mkdir -p plans

log() {
    echo "[$(TZ='America/Chicago' date '+%Y-%m-%d %H:%M:%S CST')] $1" | tee -a "$LOGFILE"
}

# Extract current addiction score from VERIFIED_STATE.md
# Looks for "| **Overall Addiction** | X.X/10 |" pattern (column 3 in pipe-delimited table)
get_score() {
    if [ -f "$STATE_FILE" ]; then
        # Extract second data column (index 3 with awk -F'|')
        raw=$(grep "Overall Addiction" "$STATE_FILE" | awk -F'|' '{print $3}' | sed 's/\/10.*//' | tr -d ' ')
        # Validate it's actually a number
        if [[ "$raw" =~ ^[0-9]+\.?[0-9]*$ ]]; then
            echo "$raw"
            return
        fi
    fi
    echo "0.0"  # Default if no valid score found
}

# Extract blockers/known gaps from VERIFIED_STATE.md
get_blockers() {
    if [ -f "$STATE_FILE" ]; then
        # Look for "Must Fix" section and extract numbered items
        blockers=$(sed -n '/Must Fix/,/^##/p' "$STATE_FILE" | grep -E '^[0-9]+\.' | head -5)
        if [ -n "$blockers" ]; then
            echo "$blockers"
            return
        fi
    fi
    echo "No specific blockers identified yet."
}

# Check if we should continue (score < target and iterations < max)
should_continue() {
    local current_score=$1
    local iteration=$2

    # Check iteration limit first (no bc needed)
    if [ "$iteration" -ge "$MAX_ITERATIONS" ]; then
        return 1  # Stop - max iterations reached
    fi

    # Validate score is numeric before bc comparison
    if ! [[ "$current_score" =~ ^[0-9]+\.?[0-9]*$ ]]; then
        log "Warning: Invalid score '$current_score', continuing..."
        return 0  # Continue if score is invalid
    fi

    # Use bc for floating point comparison (with error suppression)
    result=$(echo "$current_score >= $TARGET_SCORE" | bc -l 2>/dev/null)
    if [ "$result" = "1" ]; then
        return 1  # Stop - target reached
    fi

    return 0  # Continue
}

log "=== RALPH WIGGUM ADDICTION AUDIT v2.0 ==="
log "Goal: Make alternatives feel like punishment"
log "Target Score: $TARGET_SCORE/10"
log "Max Iterations: $MAX_ITERATIONS (safety cap)"
log ""

iteration=0
current_score=$(get_score)
log "Starting score: $current_score/10"

while should_continue "$current_score" "$iteration"; do
    iteration=$((iteration + 1))
    blockers=$(get_blockers)

    log ""
    log "=== CYCLE $iteration ==="
    log "Current Score: $current_score/10 (Target: $TARGET_SCORE)"
    log "Started: $(date)"
    log ""

    # Run claude with /self-improve command
    # The command file at .claude/commands/self-improve.md contains all instructions
    "$TIMEOUT_CMD" --kill-after=1m "$CYCLE_TIMEOUT" \
    "$CLAUDE_BIN" -p --dangerously-skip-permissions "
/self-improve

CYCLE CONTEXT:
- Cycle: $iteration of $MAX_ITERATIONS max
- Target: $TARGET_SCORE/10
- Current: $current_score/10
- Gap: $(echo "$TARGET_SCORE - $current_score" | bc) points needed

BLOCKERS FROM PREVIOUS CYCLE:
$blockers

CRITICAL: After completing the cycle, output CYCLE_COMPLETE and STOP IMMEDIATELY.
" 2>&1 | grep -v "This error originated either by throwing" \
       | grep -v "Error: No messages returned" \
       | grep -v "at hvK" \
       | grep -v "at process.processTicksAndRejections" \
       | grep -v "^$" \
       | tee -a "$LOGFILE"

    exit_code=${PIPESTATUS[0]}

    # Handle exit codes
    if [ $exit_code -eq 124 ]; then
        log ""
        log ">>> Cycle $iteration timed out after $CYCLE_TIMEOUT"
        log ">>> Work likely completed - checking results..."
        log ""
    elif [ $exit_code -ne 0 ]; then
        log ""
        log ">>> Cycle $iteration session ended (exit code: $exit_code)"
        log ">>> Checking results..."
        log ""
    fi

    # Get updated score
    previous_score=$current_score
    current_score=$(get_score)

    # Calculate delta
    if [[ "$current_score" =~ ^[0-9]+\.?[0-9]*$ ]] && [[ "$previous_score" =~ ^[0-9]+\.?[0-9]*$ ]]; then
        delta=$(echo "$current_score - $previous_score" | bc -l 2>/dev/null)
        delta_sign=""
        if (( $(echo "$delta > 0" | bc -l 2>/dev/null) )); then
            delta_sign="+"
        fi
    else
        delta="?"
        delta_sign=""
    fi

    log ""
    log "=========================================="
    log "CYCLE $iteration COMPLETE"
    log "Score: $previous_score → $current_score (${delta_sign}${delta})"
    log "Target: $TARGET_SCORE | Gap: $(echo "$TARGET_SCORE - $current_score" | bc -l 2>/dev/null)"
    log "=========================================="

    # Check if we've reached the target
    if [[ "$current_score" =~ ^[0-9]+\.?[0-9]*$ ]]; then
        result=$(echo "$current_score >= $TARGET_SCORE" | bc -l 2>/dev/null)
        if [ "$result" = "1" ]; then
            log ""
            log "=== TARGET REACHED! ==="
            log "Final Score: $current_score/10 (Target was $TARGET_SCORE)"
            log "Total Cycles: $iteration"
            break
        fi
    fi

    # Only wait if we're continuing
    log "Waiting 60 seconds before next cycle..."
    sleep 60
done

log ""
# Final status check
target_reached=0
if [[ "$current_score" =~ ^[0-9]+\.?[0-9]*$ ]]; then
    result=$(echo "$current_score >= $TARGET_SCORE" | bc -l 2>/dev/null)
    [ "$result" = "1" ] && target_reached=1
fi

if [ "$target_reached" = "1" ]; then
    log "=== SUCCESS: TARGET SCORE ACHIEVED ==="
    log "Final Score: $current_score/10"
else
    log "=== STOPPED: MAX ITERATIONS REACHED ==="
    log "Final Score: $current_score/10 (Target was $TARGET_SCORE)"
fi
log "Total Cycles: $iteration"
log "Check plans/addiction-audit-progress.txt for full results"
log "Check plans/ralph-loop.log for execution log"
