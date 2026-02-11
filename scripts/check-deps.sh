#!/usr/bin/env bash
# Check if all build dependencies are available

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Checking build dependencies...${NC}"
echo

all_good=true

# nodejs?
if command -v node &>/dev/null; then
	node_version=$(node --version)
	echo -e "${GREEN}✓${NC} Node.js: $node_version"
else
	echo -e "${RED}✗${NC} Node.js: not found"
	all_good=false
fi

# Ruby?
if command -v ruby &>/dev/null; then
	ruby_version=$(ruby --version | awk '{print $2}')
	echo -e "${GREEN}✓${NC} Ruby: $ruby_version"
else
	echo -e "${RED}✗${NC} Ruby: not found"
	all_good=false
fi

# Bundler?
if command -v bundle &>/dev/null; then
	bundle_version=$(bundle --version | awk '{print $3}')
	echo -e "${GREEN}✓${NC} Bundler: $bundle_version"
else
	echo -e "${RED}✗${NC} Bundler: not found"
	all_good=false
fi

# Jekyll? (Optional)
if command -v jekyll &>/dev/null; then
	jekyll_version=$(jekyll --version | awk '{print $2}')
	echo -e "${GREEN}✓${NC} Jekyll: $jekyll_version"
else
	echo -e "${YELLOW}⚠${NC} Jekyll: not found (will use bundler)"
fi

# Gemfile.lock?
if [ -f Gemfile.lock ]; then
	echo -e "${GREEN}✓${NC} Bundle installed"
else
	echo -e "${YELLOW}⚠${NC} Gems not installed (please run 'bundle install')"
fi

# build ts pages
echo
echo -e "${BLUE}TypeScript pages:${NC}"
for page in asgn3 asgn4 asgn5; do
	if [ -d "$page" ] && [ -f "$page/package.json" ]; then
		if [ -d "$page/node_modules" ]; then
			if [ -d "$page/dist" ]; then
				echo -e "  ${GREEN}✓${NC} $page (dependencies installed, built)"
			else
				echo -e "  ${YELLOW}⚠${NC} $page (dependencies installed, not built)"
			fi
		else
			echo -e "  ${YELLOW}⚠${NC} $page (needs 'npm install')"
		fi
	else
		echo -e "  ${BLUE}○${NC} $page (not created yet)"
	fi
done

echo

if [ "$all_good" = true ]; then
	echo -e "${GREEN}All dependencies available!${NC}"
else
	echo -e "${RED}Some dependencies are missing.${NC}"
	echo
	echo "To fix:"
	echo "  - Run 'nix develop'"
	echo "  - Or install Ruby, Node.js, and Bundler manually"
fi
