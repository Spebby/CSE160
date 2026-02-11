#!/usr/bin/env bash
# Development mode: Watch TypeScript changes and serve Jekyll site

set -euo pipefail
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the page to watch (if specified)
WATCH_PAGE=${1:-""}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}CSE160 Development Server${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# Check if bundle is available
if ! command -v bundle &>/dev/null; then
	echo -e "${RED}Error: bundler not found${NC}"
	echo "Please run one of:"
	echo "  - 'nix develop' (if using Nix)"
	echo "  - 'gem install bundler && bundle install' (if using system Ruby)"
	exit 1
fi

# Check if we need to build TypeScript first
echo -e "${YELLOW}Initial TypeScript build...${NC}"
./scripts/build-typescript.sh
echo

# Function to cleanup background processes on exit
cleanup() {
	echo -e "\n${YELLOW}Shutting down development server...${NC}"
	jobs -p | xargs -r kill 2>/dev/null || true
	exit 0
}

trap cleanup SIGINT SIGTERM EXIT

if [ -n "$WATCH_PAGE" ]; then
	# Watch a specific page
	if [ -d "$WATCH_PAGE" ] && [ -f "$WATCH_PAGE/package.json" ]; then
		echo -e "${BLUE}Starting development mode for ${YELLOW}$WATCH_PAGE${NC}"
		echo -e "${BLUE}========================================${NC}"
		echo

		# Start TypeScript watch mode for the specific page
		echo -e "${GREEN}Starting TypeScript watch mode for $WATCH_PAGE...${NC}"
		(cd "$WATCH_PAGE" && npm run watch) &

		# Give TypeScript a moment to start
		sleep 2

		# Start Jekyll server
		echo -e "${GREEN}Starting Jekyll server with live reload...${NC}"
		echo
		echo -e "${YELLOW}Server will be available at: http://localhost:4000${NC}"
		echo -e "${YELLOW}Your page: http://localhost:4000/$WATCH_PAGE/${NC}"
		echo
		JEKYLL_ENV=production bundle exec jekyll serve --livereload --incremental
	else
		echo -e "${RED}Error: Assignment '$WATCH_PAGE' not found or has no package.json${NC}"
		exit 1
	fi
else
	# Watch all pages
	echo -e "${BLUE}Starting development mode for all pages${NC}"
	echo -e "${BLUE}========================================${NC}"
	echo

	# Start TypeScript watch mode for all pages
	for page in asgn3 asgn4 asgn5; do
		if [ -d "$page" ] && [ -f "$page/package.json" ]; then
			echo -e "${GREEN}Starting TypeScript watch mode for $page...${NC}"
			(cd "$page" && npm run watch) &
		fi
	done

	# Give TypeScript a moment to start
	sleep 2

	# Start Jekyll server
	echo -e "${GREEN}Starting Jekyll server with live reload...${NC}"
	echo
	echo -e "${YELLOW}Server will be available at: http://localhost:4000${NC}"
	echo
	JEKYLL_ENV=production bundle exec jekyll serve --livereload --incremental
fi
