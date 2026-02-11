#!/usr/bin/env bash
# Build the entire site: TypeScript + Jekyll

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Building CSE160 Site${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# build TS
echo -e "${BLUE}Building TypeScript pages${NC}"
./scripts/build-typescript.sh
echo

echo -e "${BLUE}Building Jekyll site${NC}"

# is bundle available?
if ! command -v bundle &>/dev/null; then
	echo -e "${RED}Error: bundler not found${NC}"
	echo "Please run one of:"
	echo "  - 'nix develop' (if using Nix)"
	echo "  - 'gem install bundler && bundle install' (if using system Ruby)"
	exit 1
fi

if JEKYLL_ENV=production bundle exec jekyll build; then
	echo -e "${GREEN}✓ Jekyll build successful${NC}"
	echo
	echo -e "${GREEN}Site built successfully!${NC}"
	echo -e "Output directory: ${BLUE}_site/${NC}"
else
	echo -e "${RED}✗ Jekyll build failed${NC}"
	exit 1
fi
