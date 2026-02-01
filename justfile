# Justfile for Sui Polymarket Project

# List available commands
default:
    @just --list

# --- Setup & Init ---

# Initialize the project structure
init:
    mkdir -p contracts
    mkdir -p frontend
    mkdir -p scripts
    @echo "Project structure created: contracts/, frontend/, scripts/"

# --- Smart Contracts (Sui Move) ---

# Build the Move contracts
build-contract:
    cd contracts/polymarket && sui move build

# Test the Move contracts
test-contract:
    cd contracts/polymarket && sui move test

# Publish the contract and update PACKAGE_ID in .env
publish:
    #!/usr/bin/env bash
    set -e
    echo "Publishing contract..."
    cd contracts/polymarket
    
    # Remove Published.toml if exists to allow republishing
    rm -f Published.toml
    
    # Publish and capture output
    OUTPUT=$(sui client publish --gas-budget 100000000 2>&1)
    echo "$OUTPUT"
    
    # Extract Package ID from output (handles box-drawing characters)
    PACKAGE_ID=$(echo "$OUTPUT" | grep "PackageID:" | sed 's/.*PackageID: \([0-9a-fx]*\).*/\1/')
    
    if [ -z "$PACKAGE_ID" ]; then
        echo "Error: Could not extract Package ID from output"
        exit 1
    fi
    
    echo ""
    echo "✅ Extracted Package ID: $PACKAGE_ID"
    
    # Update .env file in project root
    cd ../..
    if [ -f .env ]; then
        sed -i "s|^VITE_PACKAGE_ID=.*|VITE_PACKAGE_ID=$PACKAGE_ID|" .env
        echo "✅ Updated PACKAGE_ID in .env"
    else
        echo "VITE_PACKAGE_ID=$PACKAGE_ID" > .env
        echo "✅ Created .env with PACKAGE_ID"
    fi
    
    echo ""
    echo "🎉 Contract published successfully!"
    echo "   Frontend will pick up new PACKAGE_ID on next reload."
    echo "   Run 'just backend-run' to restart backend with new config."

# Upgrade the contract and update PACKAGE_ID in .env
upgrade:
    #!/usr/bin/env bash
    set -e
    echo "Upgrading contract..."
    cd contracts/polymarket

    # Check for UpgradeCap
    # In a real scenario, we'd need to find the UpgradeCap ID. 
    # For this dev setup, we assume the account used has it.
    
    # Run upgrade and capture output at gas budget 100M
    OUTPUT=$(sui client upgrade --gas-budget 100000000 2>&1)
    echo "$OUTPUT"

    # Extract Package ID from output (handles box-drawing characters)
    PACKAGE_ID=$(echo "$OUTPUT" | grep "PackageID:" | sed 's/.*PackageID: \([0-9a-fx]*\).*/\1/')

    if [ -z "$PACKAGE_ID" ]; then
        echo "Error: Could not extract Package ID from output"
        # If it failed because of "Upgraded package must be strictly greater", warn user
        if echo "$OUTPUT" | grep -q "strictly greater"; then
            echo "Tip: Increment version in Move.toml before upgrading."
        fi
        exit 1
    fi

    echo ""
    echo "✅ Extracted New Package ID: $PACKAGE_ID"

    # Update .env file in project root
    cd ../..
    if [ -f .env ]; then
        sed -i "s|^VITE_PACKAGE_ID=.*|VITE_PACKAGE_ID=$PACKAGE_ID|" .env
        echo "✅ Updated PACKAGE_ID in .env"
    else
        echo "VITE_PACKAGE_ID=$PACKAGE_ID" > .env
        echo "✅ Created .env with PACKAGE_ID"
    fi

    echo ""
    echo "🎉 Contract upgraded successfully!"
    echo "   Frontend will pick up new PACKAGE_ID on next reload."
    echo "   Restart backend if needed."

# --- Frontend ---

# Install frontend dependencies
install-ui:
    cd frontend && pnpm install

# Run frontend dev server
dev-ui:
    cd frontend && pnpm dev

# --- Oracle / Backend ---

# Run the Rust backend (loads config from root .env)
dev-run:
    #!/usr/bin/env bash
    set -a
    source .env 2>/dev/null || true
    export TMPDIR=/tmp
    export PACKAGE_ID="${VITE_PACKAGE_ID}"
    export PLATFORM_ADMIN_ADDRESS="${VITE_PLATFORM_ADMIN_ADDRESS}"
    set +a
    cd backend && cargo run

# Check the Rust backend code
dev-check:
    export TMPDIR=/tmp && cd backend && cargo check

# Build the Rust backend (Release)
dev-build:
    export TMPDIR=/tmp && cd backend && cargo build --release

# Build release binary with embedded frontend
release:
    #!/usr/bin/env bash
    set -e
    echo "📦 Building frontend..."
    cd frontend && pnpm build
    
    echo ""
    echo "🦀 Building backend (release mode with embedded frontend)..."
    export TMPDIR=/tmp
    cd ../backend && cargo build --release
    
    echo ""
    echo "✅ Release build complete!"
    echo "   Binary: backend/target/release/backend"
    echo ""
    echo "   Run with: ./backend/target/release/backend"
    echo "   Then visit: http://localhost:3000"

# --- Sui Account Management ---

# Create a new Sui testnet account and request faucet funding
sui-create-account:
    @echo "Creating new Sui testnet account..."
    sui client new-address ed25519
    @echo ""
    @echo "Requesting testnet SUI from faucet..."
    sui client faucet --url https://faucet.testnet.sui.io/gas
    @echo ""
    @echo "Account created! Check your active address:"
    sui client active-address
    @echo ""
    @echo "View your balance:"
    sui client gas


# Fund a specific address from faucet
sui-faucet address:
    @echo "Requesting testnet SUI for {{address}}..."
    sui client faucet --url https://faucet.testnet.sui.io/gas --recipient {{address}}
    @echo "Done!"
