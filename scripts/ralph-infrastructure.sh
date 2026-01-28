#!/bin/bash
#
# Ralph Infrastructure Blitz Loop - Making Glyph The Standard
#
# Runs /infrastructure-blitz in cycles until composite score hits target
# or max cycles reached. Distribution > Polish. Everywhere > Perfect.
#
# Usage:
#   ./ralph-infrastructure.sh                    # Default: target 100, max 40 cycles
#   ./ralph-infrastructure.sh --target 80        # Lower target
#   ./ralph-infrastructure.sh --cycles 20        # Fewer cycles
#   ./ralph-infrastructure.sh --timeout 60       # 60 min per cycle (default: 90)
#   ./ralph-infrastructure.sh --priority 1       # Focus on One-Call API
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
            echo "Ralph Infrastructure Blitz Loop - Making Glyph The Standard"
            echo ""
            echo "Usage: ./ralph-infrastructure.sh [options]"
            echo ""
            echo "Options:"
            echo "  --target, -t N     Target composite score (default: 100)"
            echo "  --cycles, -c N     Max cycles to run (default: 40)"
            echo "  --timeout N        Timeout per cycle in minutes (default: 90)"
            echo "  --priority, -p N   Focus on specific pillar (1-6)"
            echo "  --help, -h         Show this help"
            echo ""
            echo "Infrastructure Pillars:"
            echo "  1. One-Call API (30%) - POST /v1/create -> data in, PDF URL out"
            echo "  2. SDK Distribution (20%) - npm/pip packages with one-line usage"
            echo "  3. Agent Frameworks (20%) - OpenAI, LangChain, Vercel AI tool definitions"
            echo "  4. Template Network (15%) - Community templates, raw HTML, URL->PDF"
            echo "  5. Hosted Output (10%) - CDN URLs for generated PDFs"
            echo "  6. SEO & Discovery (5%) - Search rankings, package descriptions"
            echo ""
            echo "Mission: Make Glyph the thing every AI uses to generate PDFs."
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

CLAUDE_BIN="/Users/eddiesanjuan/.npm-global/bin/claude"
LOGFILE="plans/infrastructure-loop.log"
STATE_FILE=".claude/infrastructure-blitz-state.md"
FEEDBACK_FILE=".claude/CYCLE_FEEDBACK.md"
TIMEOUT_CMD="/opt/homebrew/opt/coreutils/libexec/gnubin/timeout"

# Ensure plans directory exists
mkdir -p plans

log() {
    echo "[$(TZ='America/Chicago' date '+%Y-%m-%d %H:%M:%S CST')] $1" | tee -a "$LOGFILE"
}

# Extract composite score from infrastructure-blitz-state.md
get_composite_score() {
    if [ -f "$STATE_FILE" ]; then
        # Check for COMPOSITE table row (pipe-delimited markdown table)
        local composite_line=$(grep -i "COMPOSITE" "$STATE_FILE" | head -1)
        if [ -n "$composite_line" ]; then
            local score=$(echo "$composite_line" | awk -F'|' '{print $3}' | grep -oE '[0-9]+\.?[0-9]*' | head -1)
            if [[ "$score" =~ ^[0-9]+\.?[0-9]*$ ]]; then
                echo "$score"
                return
            fi
        fi
        # Fallback: look for "Composite Score: XX/100" pattern
        local score_line=$(grep -i "Composite Score:" "$STATE_FILE" | tail -1)
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
        blockers=$(sed -n '/## Blockers\|## Improvement Backlog\|## Next Steps/,/^##/p' "$STATE_FILE" | grep -E '^-|\| [0-9]' | head -10)
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
log "RALPH INFRASTRUCTURE BLITZ"
log "=============================================="
log "Mission: Make Glyph the standard for AI PDF generation"
log "Max Cycles: $MAX_CYCLES (~$((MAX_CYCLES * 90 / 60)) hours max)"
log "Philosophy: Distribution > Polish. Everywhere > Perfect."
log "Stop: Ctrl+\\ (backslash)"
log ""
log "The product is built. Now make it EVERYWHERE."
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

    # Build priority focus section
    PRIORITY_SECTION=""
    if [ -n "$FOCUS_PRIORITY" ]; then
        case $FOCUS_PRIORITY in
            1) PRIORITY_SECTION="PRIORITY FOCUS: One-Call API (Pillar 1, 30%) - POST /v1/create must work end-to-end." ;;
            2) PRIORITY_SECTION="PRIORITY FOCUS: SDK Distribution (Pillar 2, 20%) - npm/pip packages with one-line usage." ;;
            3) PRIORITY_SECTION="PRIORITY FOCUS: Agent Frameworks (Pillar 3, 20%) - OpenAI, LangChain, Vercel AI tool definitions." ;;
            4) PRIORITY_SECTION="PRIORITY FOCUS: Template Network (Pillar 4, 15%) - Community templates, raw HTML, URL->PDF." ;;
            5) PRIORITY_SECTION="PRIORITY FOCUS: Hosted Output (Pillar 5, 10%) - CDN URLs for generated PDFs." ;;
            6) PRIORITY_SECTION="PRIORITY FOCUS: SEO & Discovery (Pillar 6, 5%) - Search rankings, package descriptions." ;;
        esac
    fi

    # Build the prompt
    PROMPT="/infrastructure-blitz

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

## PRIORITY
$PRIORITY_SECTION

## STRATEGIC DIRECTION

The product is built. Distribution is the mission now.

INFRASTRUCTURE PILLARS (weighted composite):
1. One-Call API (30%) - POST /v1/create: data in, PDF URL out. Zero config.
2. SDK Distribution (20%) - npm install glyph-sdk, pip install glyph. One line.
3. Agent Frameworks (20%) - OpenAI function calling, LangChain tools, Vercel AI SDK.
4. Template Network (15%) - Community templates, raw HTML support, URL-to-PDF.
5. Hosted Output (10%) - CDN-hosted PDF URLs, no file management needed.
6. SEO & Discovery (5%) - npm/pip descriptions, docs SEO, search rankings.

DISTRIBUTION > POLISH:
- Every AI agent should be able to generate a PDF with one tool call
- Every framework should have a Glyph integration
- Every package manager should list Glyph
- Make it easier to use Glyph than to NOT use Glyph

EVERYWHERE > PERFECT:
- Ship integrations even if 80% polished
- Presence in every ecosystem beats perfection in one
- A working npm package beats a perfect API docs page
- An OpenAI function definition beats a beautiful playground

DON'T BREAK EXISTING:
- API endpoints must stay stable
- Existing templates must keep working
- MCP server must remain functional
- No regressions on core PDF generation

## SUCCESS CRITERIA

This cycle succeeds if:
1. Composite score improves (weighted by pillar weights above)
2. No existing features broken
3. Distribution surface area increases
4. All changes verified and documented
5. Learnings documented for next cycle

After completing, output CYCLE_COMPLETE with score delta and STOP."

    # Run claude (track wall-clock time to detect quick exits)
    cycle_start_ts=$(date +%s)

    "$TIMEOUT_CMD" --kill-after=1m "$CYCLE_TIMEOUT" \
    "$CLAUDE_BIN" -p --dangerously-skip-permissions "$PROMPT" 2>&1 \
        | grep -v "This error originated either by throwing" \
        | grep -v "Error: No messages returned" \
        | grep -v "at hvK" \
        | grep -v 'at \$bK' \
        | grep -v "at process.processTicksAndRejections" \
        | grep -v "Output blocked by content filtering" \
        | grep -v "^$" \
        | tee -a "$LOGFILE"

    exit_code=${PIPESTATUS[0]}
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

    # Detect quick exits (< 3 min) -- likely a failed/empty run
    if [ $cycle_duration -lt 180 ] && [ $exit_code -ne 124 ]; then
        log ""
        log ">>> Cycle $cycle finished in ${cycle_duration}s (< 3 min) -- likely a failed run"
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
    log "Score: $previous_score -> $current_score (${delta_sign}${delta})"
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
            log "Glyph is now the standard."
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
log "RALPH INFRASTRUCTURE BLITZ FINISHED"
log "=============================================="
log "Total Cycles: $cycle"
log "Final Score: $current_score/100"
log "Target was: $TARGET_SCORE/100"

if [[ "$current_score" =~ ^[0-9]+\.?[0-9]*$ ]]; then
    result=$(echo "$current_score >= $TARGET_SCORE" | bc -l 2>/dev/null)
    if [ "$result" = "1" ]; then
        log ""
        log "STATUS: SUCCESS - Target achieved! Glyph is everywhere."
    else
        log ""
        log "STATUS: Stopped at $cycle cycles"
        log "Gap: $(echo "$TARGET_SCORE - $current_score" | bc -l 2>/dev/null) points remaining"
    fi
fi

log ""
log "Full log: plans/infrastructure-loop.log"
log "State: .claude/infrastructure-blitz-state.md"
log ""
