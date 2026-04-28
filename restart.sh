#!/bin/bash

# Writer Tracker - Process Manager
# Only kills THIS project's processes, never touches other projects

PROJECT_DIR="/Users/af/cpro01/ksamint999/writerbench01"
MAIN_PORT=3000
MCP_PORT=3111

# Git settings
GIT_REMOTE_URL="${GIT_REMOTE_URL:-}"
GIT_BRANCH="${GIT_BRANCH:-main}"
AUTO_PUSH="${AUTO_PUSH:-true}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

show_banner() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  ✦  Writer Tracker - Process Manager  ✦${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Check if THIS project's processes are running
check_our_processes() {
    echo -e "${BLUE}Checking for running processes...${NC}"
    echo ""

    local our_running=0

    if [ -f "$PROJECT_DIR/.main.pid" ]; then
        MAIN_PID=$(cat "$PROJECT_DIR/.main.pid")
        if kill -0 $MAIN_PID 2>/dev/null; then
            echo -e "  ${YELLOW}▸${NC} Main Server is running (PID: $MAIN_PID)"
            our_running=1
        else
            echo -e "  ${GREEN}✓${NC} Main Server not running (stale PID file)"
            rm -f "$PROJECT_DIR/.main.pid"
        fi
    fi

    if [ -f "$PROJECT_DIR/.mcp.pid" ]; then
        MCP_PID=$(cat "$PROJECT_DIR/.mcp.pid")
        if kill -0 $MCP_PID 2>/dev/null; then
            echo -e "  ${YELLOW}▸${NC} MCP Server is running (PID: $MCP_PID)"
            our_running=1
        else
            echo -e "  ${GREEN}✓${NC} MCP Server not running (stale PID file)"
            rm -f "$PROJECT_DIR/.mcp.pid"
        fi
    fi

    if [ $our_running -eq 0 ]; then
        echo -e "  ${GREEN}✓${NC} No ${PROJECT_DIR} processes running"
    fi

    echo ""
    return $our_running
}

# Kill ONLY our project's processes
kill_our_processes() {
    echo -e "${YELLOW}Stopping our project's processes...${NC}"
    echo ""

    if [ -f "$PROJECT_DIR/.main.pid" ]; then
        MAIN_PID=$(cat "$PROJECT_DIR/.main.pid")
        if kill -0 $MAIN_PID 2>/dev/null; then
            echo -e "  ${YELLOW}▸${NC} Stopping Main Server (PID: $MAIN_PID)"
            kill -9 $MAIN_PID 2>/dev/null
            echo -e "    ${GREEN}✓${NC} Main Server stopped"
        fi
        rm -f "$PROJECT_DIR/.main.pid"
    fi

    if [ -f "$PROJECT_DIR/.mcp.pid" ]; then
        MCP_PID=$(cat "$PROJECT_DIR/.mcp.pid")
        if kill -0 $MCP_PID 2>/dev/null; then
            echo -e "  ${YELLOW}▸${NC} Stopping MCP Server (PID: $MCP_PID)"
            kill -9 $MCP_PID 2>/dev/null
            echo -e "    ${GREEN}✓${NC} MCP Server stopped"
        fi
        rm -f "$PROJECT_DIR/.mcp.pid"
    fi

    for pid in $(pgrep -f "node.*writerbench01.*server.js" 2>/dev/null); do
        echo -e "  ${YELLOW}▸${NC} Stopping orphaned server.js (PID: $pid)"
        kill -9 $pid 2>/dev/null
        echo -e "    ${GREEN}✓${NC} Stopped"
    done

    for pid in $(pgrep -f "node.*writerbench01.*mcp-writer-tracker" 2>/dev/null); do
        echo -e "  ${YELLOW}▸${NC} Stopping orphaned MCP server (PID: $pid)"
        kill -9 $pid 2>/dev/null
        echo -e "    ${GREEN}✓${NC} Stopped"
    done

    echo ""
    echo -e "${GREEN}All project processes stopped.${NC}"
}

# Git operations
git_commit_push() {
    if [ -z "$GIT_REMOTE_URL" ]; then
        echo -e "${YELLOW}▸ Git remote not configured (set GIT_REMOTE_URL)${NC}"
        return 0
    fi

    if [ "$AUTO_PUSH" != "true" ]; then
        echo -e "${YELLOW}▸ Auto-push disabled (AUTO_PUSH=false)${NC}"
        return 0
    fi

    cd "$PROJECT_DIR" || return 1

    echo ""
    echo -e "${BLUE}Git Operations...${NC}"
    echo ""

    # Check if git repo exists
    if [ ! -d ".git" ]; then
        echo -e "${YELLOW}▸ Initializing git repository...${NC}"
        git init
        git remote add origin "$GIT_REMOTE_URL"
        git checkout -b "$GIT_BRANCH"
    fi

    # Configure git if needed
    if [ -n "$GIT_EMAIL" ]; then
        git config user.email "$GIT_EMAIL"
    fi
    if [ -n "$GIT_USERNAME" ]; then
        git config user.name "$GIT_USERNAME"
    fi

    # Check for changes
    if git diff --quiet && git diff --cached --quiet; then
        echo -e "  ${YELLOW}▸${NC} No changes to commit"
        return 0
    fi

    # Add all files except .env, node_modules, logs, .pid, .port files
    echo -e "  ${YELLOW}▸${NC} Staging files..."
    git add -A
    git reset -- .env node_modules/ logs/ .main.pid .mcp.pid .main.port .mcp.port 2>/dev/null || true

    # Commit
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "  ${YELLOW}▸${NC} Committing changes..."
    git commit -m "Update: $timestamp" || echo -e "    ${YELLOW}Nothing to commit${NC}"

    # Push
    echo -e "  ${YELLOW}▸${NC} Pushing to origin/$GIT_BRANCH..."
    if git push -u origin "$GIT_BRANCH" 2>&1; then
        echo -e "    ${GREEN}✓${NC} Pushed successfully"
    else
        echo -e "    ${RED}✗${NC} Push failed - you may need to set up authentication"
    fi
}

# Find an available port
find_available_port() {
    local port=$1
    local original_port=$port
    while lsof -ti :$port >/dev/null 2>&1; do
        port=$((port + 1))
        if [ $port -gt $((original_port + 100)) ]; then
            echo "$port"
            return 1
        fi
    done
    echo "$port"
    return 0
}

start_services() {
    show_banner

    if check_our_processes; then
        echo -e "${YELLOW}Project already running. Stopping first...${NC}"
        echo ""
        kill_our_processes
        sleep 1
    fi

    # Git commit & push BEFORE starting
    git_commit_push

    # Check port availability
    echo -e "${BLUE}Checking ports...${NC}"
    echo ""

    echo -e "  Main Server:  Port $MAIN_PORT "
    if lsof -ti :$MAIN_PORT >/dev/null 2>&1; then
        echo -e "    ${YELLOW}Port $MAIN_PORT is occupied by another project${NC}"
        ACTUAL_MAIN_PORT=$(find_available_port $MAIN_PORT)
        echo -e "    ${GREEN}→ Will use port $ACTUAL_MAIN_PORT instead${NC}"
    else
        echo -e "    ${GREEN}✓ Available${NC}"
        ACTUAL_MAIN_PORT=$MAIN_PORT
    fi

    echo ""
    echo -e "  MCP Server:  Port $MCP_PORT "
    if lsof -ti :$MCP_PORT >/dev/null 2>&1; then
        echo -e "    ${YELLOW}Port $MCP_PORT is occupied by another project${NC}"
        ACTUAL_MCP_PORT=$(find_available_port $MCP_PORT)
        echo -e "    ${GREEN}→ Will use port $ACTUAL_MCP_PORT instead${NC}"
    else
        echo -e "    ${GREEN}✓ Available${NC}"
        ACTUAL_MCP_PORT=$MCP_PORT
    fi

    echo ""
    echo -e "${BLUE}Starting services...${NC}"
    echo ""

    cd "$PROJECT_DIR"

    # Start main server with API key
    echo -e "  ${YELLOW}▸${NC} Launching Main Server on port $ACTUAL_MAIN_PORT..."
    WRITER_TRACKER_API_KEY="${WRITER_TRACKER_API_KEY:-}" \
    PORT=$ACTUAL_MAIN_PORT node server.js > "$PROJECT_DIR/logs/main.log" 2>&1 &
    MAIN_PID=$!
    echo $MAIN_PID > "$PROJECT_DIR/.main.pid"
    echo -e "    ${GREEN}✓${NC} PID: $MAIN_PID"

    # Start MCP server with API key
    echo -e "  ${YELLOW}▸${NC} Launching MCP Server on port $ACTUAL_MCP_PORT..."
    cd "$PROJECT_DIR/mcp-writer-tracker"
    WRITER_TRACKER_API_KEY="${WRITER_TRACKER_API_KEY:-}" \
    PORT=$ACTUAL_MCP_PORT node index.js > "$PROJECT_DIR/logs/mcp.log" 2>&1 &
    MCP_PID=$!
    echo $MCP_PID > "$PROJECT_DIR/.mcp.pid"
    echo -e "    ${GREEN}✓${NC} PID: $MCP_PID"

    cd "$PROJECT_DIR"

    sleep 1

    # Verify
    echo ""
    echo -e "${BLUE}Verifying...${NC}"

    if kill -0 $MAIN_PID 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Main Server is running (PID: $MAIN_PID)"
    else
        echo -e "  ${RED}✗${NC} Main Server failed to start"
        echo -e "      Check logs: tail -f $PROJECT_DIR/logs/main.log"
    fi

    if kill -0 $MCP_PID 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} MCP Server is running (PID: $MCP_PID)"
    else
        echo -e "  ${RED}✗${NC} MCP Server failed to start"
        echo -e "      Check logs: tail -f $PROJECT_DIR/logs/mcp.log"
    fi

    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo -e "  ${GREEN}✓ All services started!${NC}"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo -e "  ${BLUE}Main Server:${NC}  http://localhost:$ACTUAL_MAIN_PORT"
    echo -e "  ${BLUE}MCP Server:${NC}   http://localhost:$ACTUAL_MCP_PORT"
    echo -e "  ${BLUE}API Key:${NC}      ${WRITER_TRACKER_API_KEY:+Set ✓}${WRITER_TRACKER_API_KEY:-Not set (optional)}"
    echo ""

    echo "$ACTUAL_MAIN_PORT" > "$PROJECT_DIR/.main.port"
    echo "$ACTUAL_MCP_PORT" > "$PROJECT_DIR/.mcp.port"
}

stop_services() {
    show_banner
    kill_our_processes
    show_status
}

show_status() {
    show_banner

    echo -e "${BLUE}Port Status:${NC}"
    echo ""

    echo -e "  Main Server:  Port $MAIN_PORT"
    if lsof -ti :$MAIN_PORT >/dev/null 2>&1; then
        pid=$(lsof -ti :$MAIN_PORT | head -1)
        path=$(ps -p $pid -o args= 2>/dev/null | grep -o "writerbench01[^ ]*" | head -1)
        if [ -n "$path" ]; then
            echo -e "    ${GREEN}Running${NC} (PID: $pid)"
        else
            echo -e "    ${YELLOW}Occupied by another project${NC} (PID: $pid)"
        fi
    else
        echo -e "    ${RED}Available${NC}"
    fi

    echo -e "  MCP Server:   Port $MCP_PORT"
    if lsof -ti :$MCP_PORT >/dev/null 2>&1; then
        pid=$(lsof -ti :$MCP_PORT | head -1)
        path=$(ps -p $pid -o args= 2>/dev/null | grep -o "writerbench01[^ ]*" | head -1)
        if [ -n "$path" ]; then
            echo -e "    ${GREEN}Running${NC} (PID: $pid)"
        else
            echo -e "    ${YELLOW}Occupied by another project${NC} (PID: $pid)"
        fi
    else
        echo -e "    ${RED}Available${NC}"
    fi

    echo ""
    echo -e "${BLUE}Our Project Status:${NC}"
    echo ""

    if [ -f "$PROJECT_DIR/.main.pid" ]; then
        pid=$(cat "$PROJECT_DIR/.main.pid")
        if kill -0 $pid 2>/dev/null; then
            port=${ACTUAL_MAIN_PORT:-$MAIN_PORT}
            echo -e "  Main Server:  ${GREEN}Running${NC} on port $port (PID: $pid)"
        else
            echo -e "  Main Server:  ${RED}Not running${NC} (stale PID)"
        fi
    else
        echo -e "  Main Server:  ${RED}Not running${NC}"
    fi

    if [ -f "$PROJECT_DIR/.mcp.pid" ]; then
        pid=$(cat "$PROJECT_DIR/.mcp.pid")
        if kill -0 $pid 2>/dev/null; then
            port=${ACTUAL_MCP_PORT:-$MCP_PORT}
            echo -e "  MCP Server:   ${GREEN}Running${NC} on port $port (PID: $pid)"
        else
            echo -e "  MCP Server:   ${RED}Not running${NC} (stale PID)"
        fi
    else
        echo -e "  MCP Server:   ${RED}Not running${NC}"
    fi

    echo ""
}

show_logs() {
    show_banner
    echo -e "${BLUE}Recent Logs:${NC}"
    echo ""

    if [ -f "$PROJECT_DIR/logs/main.log" ]; then
        echo -e "${YELLOW}--- Main Server (last 15 lines) ---${NC}"
        tail -15 "$PROJECT_DIR/logs/main.log"
        echo ""
    fi

    if [ -f "$PROJECT_DIR/logs/mcp.log" ]; then
        echo -e "${YELLOW}--- MCP Server (last 15 lines) ---${NC}"
        tail -15 "$PROJECT_DIR/logs/mcp.log"
    fi

    if [ ! -f "$PROJECT_DIR/logs/main.log" ] && [ ! -f "$PROJECT_DIR/logs/mcp.log" ]; then
        echo -e "${YELLOW}No logs yet. Run './restart.sh start' first.${NC}"
    fi
    echo ""
}

# Git only commands
git_status() {
    show_banner
    echo -e "${BLUE}Git Status:${NC}"
    echo ""

    cd "$PROJECT_DIR"

    if [ ! -d ".git" ]; then
        echo -e "${YELLOW}Not a git repository. Run 'start' to initialize.${NC}"
        return
    fi

    git status
    echo ""

    if [ -n "$GIT_REMOTE_URL" ]; then
        echo -e "Remote: ${CYAN}$GIT_REMOTE_URL${NC}"
        echo -e "Branch: ${CYAN}$GIT_BRANCH${NC}"
    else
        echo -e "${YELLOW}Remote not configured. Set GIT_REMOTE_URL environment variable.${NC}"
    fi
    echo ""
}

git_push() {
    show_banner
    git_commit_push
}

# Create logs directory
mkdir -p "$PROJECT_DIR/logs"

# Load saved ports if they exist
if [ -f "$PROJECT_DIR/.main.port" ]; then
    ACTUAL_MAIN_PORT=$(cat "$PROJECT_DIR/.main.port")
fi
if [ -f "$PROJECT_DIR/.mcp.port" ]; then
    ACTUAL_MCP_PORT=$(cat "$PROJECT_DIR/.mcp.port")
fi

# Parse arguments
case "${1:-start}" in
    --stop|-s|stop)
        stop_services
        ;;
    --restart|-r|restart)
        show_banner
        echo -e "${YELLOW}Restarting...${NC}"
        echo ""
        kill_our_processes
        sleep 1
        start_services
        ;;
    --status|status)
        show_status
        ;;
    --logs|-l|logs)
        show_logs
        ;;
    --git|git)
        git_status
        ;;
    --push|push)
        git_push
        ;;
    --start|start)
        start_services
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|git|push}"
        echo ""
        echo "  start   - Start services + git push (default)"
        echo "  stop    - Stop our project services"
        echo "  restart - Restart services + git push"
        echo "  status  - Show service status"
        echo "  logs    - Show log output"
        echo "  git     - Show git status"
        echo "  push    - Git commit & push only"
        echo ""
        echo "Environment Variables:"
        echo "  WRITER_TRACKER_API_KEY - API key for content management"
        echo "  GIT_REMOTE_URL          - Git remote repository URL"
        echo "  GIT_BRANCH              - Git branch (default: main)"
        echo "  AUTO_PUSH               - Auto push on start (default: true)"
        exit 1
        ;;
esac