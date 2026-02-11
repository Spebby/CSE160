# CSE160

[![wakatime](https://wakatime.com/badge/user/6c1b4d80-35ad-487a-a081-efc861c8d411/project/ad2d5d94-45ec-4866-b808-ccd338754e7f.svg)](https://wakatime.com/badge/user/6c1b4d80-35ad-487a-a081-efc861c8d411/project/ad2d5d94-45ec-4866-b808-ccd338754e7f)

My work for CSE160 @ UCSC Winter '26

## Building the Site

This is a mixed JavaScript and TypeScript project using Jekyll as the static
site generator.

### Quick Start

```bash
nix develop # if running nix
gem install bundler && bundle install # if not running nix
bundle install # (runs by default on nix)
npm run dev
```

### Build Commands

```bash
# Full site build (TypeScript + Jekyll)
npm run build

# Development mode with live reload
npm run dev

# Development mode for specific assignment
npm run dev:asgn#

# Clean build artifacts
npm run clean
```

### Dependencies

- **Node.js**: 20+
- **Ruby**: 3.3+
- **Jekyll**: 3.10+ (Nix provides 3.10)
- **TypeScript**: Installed per-assignment via npm

## Generative AI Acknowledgment

Generative AI was used during the writing of this project. Each sub-folder goes
into specifics on the usage. However, Generative AI was used in the workflow
writing process, writing the scripts in `scripts/` and the workflows in
`.github/workflows/`.
