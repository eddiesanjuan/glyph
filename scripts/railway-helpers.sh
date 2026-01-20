#!/bin/bash
# Railway Helper Scripts for Glyph Project
# These automate what CAN be done via CLI

PROJECT_ID="76d95905-de59-4475-8d26-7179f8244510"
PROJECT_DIR="/Users/eddiesanjuan/Projects/glyph"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check all services
check_services() {
    echo -e "${YELLOW}=== Checking Glyph Services ===${NC}\n"

    # API service - check multiple possible domains
    echo -e "${GREEN}glyph-api:${NC}"
    API_HEALTH=$(curl -s https://glyph-api-production-3f73.up.railway.app/health 2>/dev/null)
    if echo "$API_HEALTH" | grep -q '"status":"ok"'; then
        echo -e "  ${GREEN}Status: OK${NC}"
        echo "  $API_HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Version: {d.get(\"version\", \"unknown\")}')" 2>/dev/null || echo "  $API_HEALTH"
    else
        echo -e "  ${RED}Status: Cannot reach API${NC}"
        echo "  Response: $API_HEALTH"
    fi
    echo ""

    # WWW service - should serve HTML
    echo -e "${GREEN}glyph-www:${NC}"
    CONTENT_TYPE=$(curl -s -I https://glyph-www-production.up.railway.app/ 2>/dev/null | grep -i content-type | head -1)
    echo "  Content-Type: $CONTENT_TYPE"
    if echo "$CONTENT_TYPE" | grep -q "text/html"; then
        echo -e "  ${GREEN}Status: OK (serving HTML)${NC}"
    else
        echo -e "  ${RED}Status: BROKEN (not serving HTML - likely wrong root directory)${NC}"
        echo -e "  ${YELLOW}Fix: Set Root Directory to 'www' in Railway dashboard${NC}"
    fi
    echo ""

    # SDK service - should serve JavaScript files
    echo -e "${GREEN}glyph-sdk:${NC}"
    SDK_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null https://glyph-sdk-production.up.railway.app/glyph.min.js 2>/dev/null)
    SDK_CONTENT_TYPE=$(curl -s -I https://glyph-sdk-production.up.railway.app/glyph.min.js 2>/dev/null | grep -i content-type | head -1)
    if [ "$SDK_RESPONSE" = "200" ] && echo "$SDK_CONTENT_TYPE" | grep -q "javascript"; then
        echo -e "  ${GREEN}Status: OK (glyph.min.js accessible)${NC}"
    else
        echo -e "  ${RED}Status: BROKEN (HTTP $SDK_RESPONSE for glyph.min.js)${NC}"
        echo -e "  ${YELLOW}Fix: Set Root Directory to 'sdk' in Railway dashboard${NC}"
    fi
    echo ""

    echo -e "${YELLOW}Dashboard URL:${NC} https://railway.com/project/$PROJECT_ID"
}

# Function to view logs for a service
view_logs() {
    SERVICE=$1
    if [ -z "$SERVICE" ]; then
        echo "Usage: $0 logs <service-name>"
        echo "Services: glyph-api, glyph-www, glyph-sdk"
        exit 1
    fi

    cd "$PROJECT_DIR"
    railway link -p "$PROJECT_ID" -s "$SERVICE"
    railway logs -n 50
}

# Function to set environment variables
set_var() {
    SERVICE=$1
    KEY=$2
    VALUE=$3

    if [ -z "$SERVICE" ] || [ -z "$KEY" ] || [ -z "$VALUE" ]; then
        echo "Usage: $0 setvar <service-name> <KEY> <VALUE>"
        exit 1
    fi

    cd "$PROJECT_DIR"
    railway link -p "$PROJECT_ID" -s "$SERVICE"
    railway variables --set "$KEY=$VALUE"
}

# Function to get all variables for a service
get_vars() {
    SERVICE=$1
    if [ -z "$SERVICE" ]; then
        echo "Usage: $0 vars <service-name>"
        exit 1
    fi

    cd "$PROJECT_DIR"
    railway link -p "$PROJECT_ID" -s "$SERVICE"
    railway variables --kv
}

# Function to redeploy a service
redeploy() {
    SERVICE=$1
    if [ -z "$SERVICE" ]; then
        echo "Usage: $0 redeploy <service-name>"
        exit 1
    fi

    cd "$PROJECT_DIR"
    railway link -p "$PROJECT_ID" -s "$SERVICE"
    railway redeploy
}

# Function to open dashboard
open_dashboard() {
    echo "Opening Railway dashboard..."
    open "https://railway.com/project/$PROJECT_ID"
}

# Main command router
case "$1" in
    check|status)
        check_services
        ;;
    logs)
        view_logs "$2"
        ;;
    setvar)
        set_var "$2" "$3" "$4"
        ;;
    vars)
        get_vars "$2"
        ;;
    redeploy)
        redeploy "$2"
        ;;
    dashboard|open)
        open_dashboard
        ;;
    *)
        echo "Glyph Railway Helper Scripts"
        echo ""
        echo "Usage: $0 <command> [args]"
        echo ""
        echo "Commands:"
        echo "  check, status    - Check health of all services"
        echo "  logs <service>   - View logs for a service"
        echo "  vars <service>   - Show environment variables"
        echo "  setvar <service> <key> <value> - Set an environment variable"
        echo "  redeploy <service> - Trigger a redeploy"
        echo "  dashboard, open  - Open Railway dashboard"
        echo ""
        echo "Services: glyph-api, glyph-www, glyph-sdk"
        echo ""
        echo -e "${YELLOW}Note: Root directory and GitHub settings require dashboard access.${NC}"
        echo "See docs/RAILWAY_GITHUB_SETUP.md for full setup instructions."
        ;;
esac
