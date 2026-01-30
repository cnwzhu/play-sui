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

# Publish the contract (requires active environment)
publish:
    cd contracts/polymarket && sui client publish --gas-budget 100000000

# --- Frontend ---

# Install frontend dependencies
install-frontend:
    cd frontend && pnpm install

# Run frontend dev server
dev-frontend:
    cd frontend && pnpm dev

# --- Oracle / Backend ---

# Run the Rust backend
backend-run:
    cd backend && cargo run

# Check the Rust backend code
backend-check:
    cd backend && cargo check

# Build the Rust backend (Release)
backend-build:
    cd backend && cargo build --release

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

