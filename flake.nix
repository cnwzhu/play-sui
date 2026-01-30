{
  description = "Sui Vibe Hackathon Project - Polymarket-like App";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };
        
        # Define Rust toolchain
        rustToolchain = pkgs.rust-bin.stable.latest.default.override {
          extensions = [ "rust-src" "rust-analyzer" ];
        };

        # Define Sui package from binary
        sui = pkgs.stdenv.mkDerivation rec {
          pname = "sui";
          version = "mainnet-v1.64.2";
          
          src = pkgs.fetchurl {
            url = "https://github.com/MystenLabs/sui/releases/download/${version}/sui-${version}-ubuntu-x86_64.tgz";
            sha256 = "14kpaprzrigdn3m33zm4x39gvrzlxs3zza8sscs1h3db303gyxxc";
          };

          nativeBuildInputs = [ pkgs.autoPatchelfHook ];
          
          buildInputs = with pkgs; [
            zlib
            openssl
            stdenv.cc.cc.lib
          ];

          sourceRoot = ".";

          installPhase = ''
            mkdir -p $out/bin
            cp sui $out/bin/
            chmod +x $out/bin/sui
          '';
        };

      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Rust Environment
            rustToolchain
            pkg-config
            openssl
            
            # Sui
            sui
            
            # Command Runner
            just

            # Frontend
            nodejs_20
            nodePackages.pnpm
            nodePackages.typescript
            nodePackages.typescript-language-server
          ];

          shellHook = ''
            echo "🚀 Welcome to the Sui Vibe Hackathon Dev Environment!"
            echo "Tools available: sui, rustc, cargo, just, node, pnpm"
            
            sui --version
            
            echo "Run 'just' to see available commands."
          '';
        };
      }
    );
}
