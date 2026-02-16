#!/usr/bin/env bash

set -euo pipefail
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Building TypeScript pages..."

# build status
build_failed=0
pages=(asgn3 asgn4 asgn5)

build_page() {
	local page=$1

	if [ -d "$page" ] && [ -f "$page/package.json" ]; then
		echo -e "${YELLOW}Building $page...${NC}"
		cd "$page"

		# install dependencies if node_modules doesn't exist
		if [ ! -d "node_modules" ]; then
			npm install
		fi

		# build TS
		if npm run build; then
			if [ -d "dist" ]; then
				echo -e "${GREEN}✓ $page compiled successfully${NC}"
				find dist -maxdepth 1 -name '*.js' -printf '  %f (%s bytes)\n'
			else
				echo -e "${RED}✗ $page build failed - no dist/ directory${NC}"
				return 1
			fi
		else
			echo -e "${RED}✗ $page build failed${NC}"
			return 1
		fi
		cd ..
	else
		echo -e "${YELLOW}⊘ $page does not exist yet, skipping${NC}"
	fi

	return 0
}

# build pages in parallel
pids=()
for page in "${pages[@]}"; do
	build_page "$page" &
	pids+=($!)
done

# wait for builds to complete
for pid in "${pids[@]}"; do
	if ! wait "$pid"; then
		build_failed=1
	fi
done

if [ $build_failed -eq 1 ]; then
	echo -e "${RED}Some builds failed${NC}"
	exit 1
fi

echo -e "${GREEN}All pages built successfully${NC}"
