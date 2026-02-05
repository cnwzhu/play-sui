#!/bin/bash
set -e

# ==============================================================================
# PlaySui Deployment Startup Script
# 
# This script is designed for the production environment.
# It handles:
# 1. Sui Keystore initialization
# 2. Account creation (if needed) & funding
# 3. Environment variable configuration
# 4. Launching the application binary
#
# PREREQUISITES:
# - 'sui' CLI must be installed and in PATH
# - The application binary (e.g., 'play-sui-backend') should be in the same directory
# ==============================================================================

# Configuration
BINARY_NAME=${BINARY_NAME:-"./play-sui"}
SUI_NETWORK=${SUI_NETWORK:-"https://fullnode.testnet.sui.io:443"}
FAUCET_URL=${FAUCET_URL:-"https://faucet.testnet.sui.io/gas"}
VITE_PACKAGE_ID=${VITE_PACKAGE_ID:-"0x5af9f88e5a943f85ff83ee3e27b6b64de83d0225e5a0d71d75221c19b7ce4c87"}

echo "🚀 Initializing Deployment..."

# ------------------------------------------------------------------------------
# 1. Check Prerequisities
# ------------------------------------------------------------------------------
if ! command -v sui &> /dev/null; then
    echo "⚠️  'sui' CLI not found. Starting automatic installation..."
    
    # Use a fixed stable version matching the project
    SUI_VERSION="mainnet-v1.64.2"
    echo "⬇️  Downloading Sui ($SUI_VERSION)..."
    
    # Download URL for Linux x86_64 (Common server arch)
    DOWNLOAD_URL="https://github.com/MystenLabs/sui/releases/download/${SUI_VERSION}/sui-${SUI_VERSION}-ubuntu-x86_64.tgz"
    
    # Create local bin dir
    mkdir -p bin
    
    if command -v curl &> /dev/null; then
        curl -L "$DOWNLOAD_URL" -o sui_install.tgz
    elif command -v wget &> /dev/null; then
        wget "$DOWNLOAD_URL" -O sui_install.tgz
    else
        echo "❌ Error: Neither 'curl' nor 'wget' found. Cannot auto-install."
        exit 1
    fi
    
    echo "📦 Extracting..."
    tar -xzf sui_install.tgz -C bin --strip-components=0
    
    # Cleanup
    rm sui_install.tgz
    
    # Add local bin to PATH for this session
    export PATH="$PWD/bin:$PATH"
    
    # Verify
    if command -v sui &> /dev/null; then
        echo "✅ Sui installed successfully: $(sui --version)"
    else
        echo "❌ Installation failed. Please install manually."
        exit 1
    fi
fi

if [ ! -f "$BINARY_NAME" ]; then
    echo "⚠️  Warning: Binary '$BINARY_NAME' not found in current directory."
    echo "   Ensure you have uploaded the binary and it matches BINARY_NAME."
    echo "   Continuing for now (maybe you just want to setup the account)..."
fi

# ------------------------------------------------------------------------------
# 2. Setup Sui Configuration (Keystore/Client.yaml)
# ------------------------------------------------------------------------------
echo "⚙️  Setting up Sui configuration..."
SUI_CONFIG_DIR="$HOME/.sui/sui_config"
mkdir -p "$SUI_CONFIG_DIR"

if [ ! -f "$SUI_CONFIG_DIR/client.yaml" ]; then
    echo "   Creating default client.yaml..."
    # Initialize basic config if missing
    cat > "$SUI_CONFIG_DIR/client.yaml" <<EOF
keystore:
  File: $SUI_CONFIG_DIR/sui.keystore
envs:
  - alias: testnet
    rpc: "$SUI_NETWORK"
    ws: null
active_env: testnet
active_address: null
EOF
fi

if [ ! -f "$SUI_CONFIG_DIR/sui.keystore" ]; then
    echo "   Creating empty keystore..."
    echo "[]" > "$SUI_CONFIG_DIR/sui.keystore"
fi

# ------------------------------------------------------------------------------
# 3. Account Management
# ------------------------------------------------------------------------------
echo "👤 Checking Sui Account..."

# Check active address
ACTIVE_ADDR=$(sui client active-address 2>/dev/null || true)

if [[ -z "$ACTIVE_ADDR" || "$ACTIVE_ADDR" == "null" ]]; then
    echo "🆕 No active address found. Generating new account..."
    # Create new address and capture output
    NEW_ADDR_OUTPUT=$(sui client new-address ed25519)
    # Extract address using grep (simple regex for hex string)
    ACTIVE_ADDR=$(echo "$NEW_ADDR_OUTPUT" | grep -o '0x[a-fA-F0-9]\{64\}' | head -n 1)
    
    if [ -z "$ACTIVE_ADDR" ]; then
        echo "❌ Failed to create/parse new address."
        echo "Output: $NEW_ADDR_OUTPUT"
        exit 1
    fi
    echo "✅ Created Account: $ACTIVE_ADDR"
    echo "⚠️  SAVE YOUR RECOVERY PHRASE (Output above) ⚠️"
else
    echo "✅ Using existing account: $ACTIVE_ADDR"
fi

# Ensure correct environment
sui client switch --env testnet >/dev/null 2>&1 || true

# ------------------------------------------------------------------------------
# 4. Funding (Testnet Faucet)
# ------------------------------------------------------------------------------
echo "💰 Checking Balance..."
# Get gas objects (json output)
GAS_OBJECTS=$(sui client gas --json 2>/dev/null || echo "[]")

# Simple check: if json array is empty "[]" or null, we need funds
if [ "$GAS_OBJECTS" == "[]" ] || [ "$GAS_OBJECTS" == "null" ]; then
    echo "🚰 Balance is empty. Requesting funds from Faucet..."
    sui client faucet --url "$FAUCET_URL" --recipient "$ACTIVE_ADDR"
    echo "   ...Request sent. Waiting 5s for network..."
    sleep 5
else
    echo "   Account has funds."
fi

# ------------------------------------------------------------------------------
# 5. Launch Application
# ------------------------------------------------------------------------------
echo "🚀 Starting Application..."

# Set Dynamic Environment Variables for the Backend
export VITE_PLATFORM_ADMIN_ADDRESS="$ACTIVE_ADDR"
export VITE_SUI_NETWORK="$SUI_NETWORK"

# VITE_PACKAGE_ID should be provided by the deployment environment (e.g. docker env or CI)
# If missing, warn the user
if [ -z "$VITE_PACKAGE_ID" ]; then
    echo "⚠️  WARNING: VITE_PACKAGE_ID is not set!"
    echo "   The application may not function correctly without a contract address."
    echo "   You can set it in this script (top of file) or via environment variable:"
    echo "   export VITE_PACKAGE_ID=0x..."
fi

echo "   Admin Address: $VITE_PLATFORM_ADMIN_ADDRESS"
echo "   Package ID:    $VITE_PACKAGE_ID"

# Run the binary
if [ -f "$BINARY_NAME" ]; then
    chmod +x "$BINARY_NAME"
    echo "   Executing $BINARY_NAME ..."
    exec "$BINARY_NAME"
else
    echo "❌ Binary '$BINARY_NAME' not found!"
    echo "   Required actions:"
    echo "   1. Rename your release binary to 'play-sui' (or set BINARY_NAME env var)"
    echo "   2. Place it in this directory: $(pwd)"
    exit 1
fi
