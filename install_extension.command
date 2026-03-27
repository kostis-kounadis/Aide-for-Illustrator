#!/bin/bash
# install_extension.command
# Double-click to install Aide extension to Adobe CEP folder.

cd "$(dirname "$0")"

SYSTEM_DIR="/Library/Application Support/Adobe/CEP/extensions/com.aide.ai"
USER_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions/com.aide.ai"
OLD_DIR="/Library/Application Support/Adobe/CEP/extensions/com.autoartboard"

echo "========================================"
echo "  Aide — Extension Installer"
echo "========================================"
echo ""

# --- Step 0: Remove OLD AutoArtboard installs ---
if [ -d "$OLD_DIR" ]; then
    echo "Removing old AutoArtboard install..."
    sudo rm -rf "$OLD_DIR"
fi

# --- Step 1: Remove any previous Aide installs ---
if [ -d "$SYSTEM_DIR" ]; then
    echo "Removing previous system install..."
    sudo rm -rf "$SYSTEM_DIR"
fi
if [ -d "$USER_DIR" ]; then
    echo "Removing previous user install..."
    rm -rf "$USER_DIR"
fi

# --- Step 2: Enable debug mode for unsigned extensions ---
echo ""
echo "Enabling CEP debug mode..."
defaults write com.adobe.CSXS.9 PlayerDebugMode 1
defaults write com.adobe.CSXS.10 PlayerDebugMode 1
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
defaults write com.adobe.CSXS.12 PlayerDebugMode 1
echo "✓ Debug mode enabled for CSXS 9-12"

# --- Step 3: Install to system-level ---
echo ""
echo "Installing to: $SYSTEM_DIR"
echo "🔒 Administrator password required."
echo ""

sudo mkdir -p "$SYSTEM_DIR"
sudo cp -R CSXS css js jsx index.html "$SYSTEM_DIR/"

# Strip macOS quarantine/extended attributes
sudo xattr -cr "$SYSTEM_DIR"

# Match ownership of other working extensions
sudo chown -R root:wheel "$SYSTEM_DIR"
sudo chmod -R 755 "$SYSTEM_DIR"

# --- Step 4: Create .debug file ---
DEBUG_FILE="$HOME/Library/Application Support/Adobe/CEP/extensions/.debug"
cat > "/tmp/aide_debug" << 'DEBUGEOF'
<?xml version="1.0" encoding="UTF-8"?>
<ExtensionList>
    <Extension Id="com.aide.ai.panel">
        <HostList>
            <Host Name="ILST" Port="8099"/>
        </HostList>
    </Extension>
</ExtensionList>
DEBUGEOF

if [ ! -f "$DEBUG_FILE" ]; then
    mkdir -p "$(dirname "$DEBUG_FILE")"
    cp "/tmp/aide_debug" "$DEBUG_FILE"
    echo "Created .debug file for remote debugging."
fi
rm -f "/tmp/aide_debug"

# --- Step 5: Verify ---
echo ""
if [ -f "$SYSTEM_DIR/CSXS/manifest.xml" ]; then
    echo "========================================"
    echo "✅ SUCCESS: Aide installed!"
    echo ""
    echo "Please FULLY QUIT (Cmd+Q) and restart"
    echo "Adobe Illustrator, then go to:"
    echo "  Window > Extensions > Aide"
    echo "========================================"
else
    echo "❌ ERROR: Installation failed."
fi

echo ""
echo "Press [Enter] to close..."
read
