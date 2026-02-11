{
  description = "Dev environment for website development";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    pre-commit-hooks = {
      url = "github:cachix/pre-commit-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      pre-commit-hooks,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        checks = {
          pre-commit-check = pre-commit-hooks.lib.${system}.run {
            src = ./.;
            excludes = [
              ".*/submodules/.*"
              "^submodules/.*"
            ];
            hooks = {
              flake-checker.enable = true;
              nixfmt-rfc-style = {
                enable = true;
                settings.width = 100;
              };
              statix = {
                enable = true;
                settings.ignore = [ "flake.lock" ];
              };
              deadnix.enable = true;
              nil.enable = true;
              shellcheck.enable = true;
              shfmt.enable = true;
              typos.enable = true;
            };
          };
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            git
            act

            # Ruby
            ruby_3_3
            bundler
            nodejs_20
          ];

          shellHook = ''
            export JEKYLL_ENV="production"
            echo "Dev Env loaded."
            echo ""
            echo "Build commands:"
            echo "  npm run build     - Build entire site (TypeScript + Jekyll)"
            echo "  npm run dev       - Start development server with live reload"
            echo "  npm run dev:asgn# - Dev mode for specific assignment"
            echo ""
            ${self.checks.${system}.pre-commit-check.shellHook}
            bundle install
          '';
        };
      }
    );
}
