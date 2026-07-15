{
  description = "Scaffolder Rust and Node development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    rust-overlay.url = "github:oxalica/rust-overlay";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      rust-overlay,
      flake-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs { inherit system overlays; };

        rustVersion = "1.88.0";
        nodejs = pkgs.nodejs_22;
        pnpmPackage = pkgs.pnpm_10;

        rustToolchain = pkgs.rust-bin.stable.${rustVersion}.default.override {
          extensions = [
            "rust-src"
            "rust-analyzer"
            "clippy"
            "rustfmt"
          ];

          # targets = [ "wasm32-unknown-unknown" ];  # Uncomment if needed
        };

        nightlyToolchain = pkgs.rust-bin.selectLatestNightlyWith (
          toolchain:
          toolchain.default.override {
            extensions = [ "rust-src" ];
          }
        );

        udeps-run = pkgs.writeShellApplication {
          name = "udeps-run";

          runtimeInputs = with pkgs; [
            nightlyToolchain
            cargo-udeps
            pkg-config
            gcc
          ];
          text = ''
            cargo udeps "$@"
          '';
        };
      in
      {
        apps = {
          udeps = {
            program = "${udeps-run}/bin/udeps-run";
            type = "app";
            meta.description = "Run cargo udeps with the nightly Rust toolchain";
          };
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Rust
            rustToolchain
            nightlyToolchain

            # Node/Turbo workspace
            nodejs
            pnpmPackage

            # Build essentials
            pkg-config
            cargo-sort

            # Repository workflow
            git
            python312
            pre-commit

            # Optional: sccache for faster builds
            # sccache
          ];

          shellHook = ''
            echo "Rust stable: $(rustc --version)"
            echo "Rust nightly: $(${nightlyToolchain}/bin/rustc --version)"
            echo "Cargo: $(cargo --version)"
            echo "Node: $(node --version)"
            echo "pnpm: $(pnpm --version)"
          '';
        };
      }
    );
}
