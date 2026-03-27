#!/bin/bash
# uninstall_extension.command
# Double-click to remove Aide extension from System CEP folder (Requires Password)

cd "$(dirname "$0")"

# Both old and new extension IDs
AIDE_DIR="/Library/Application Support/Adobe/CEP/extensions/com.aide.ai"
OLD_DIR="/Library/Application Support/Adobe/CEP/extensions/com.autoartboard"

echo "Uninstalling Aide extension..."
echo "🔒 This requires Administrator privileges. Please enter password when prompted."
echo ""

removed=0

if [ -d "$AIDE_DIR" ]; then
    echo "Removing: $AIDE_DIR"
    sudo rm -rf "$AIDE_DIR"
    removed=1
fi

if [ -d "$OLD_DIR" ]; then
    echo "Removing old AutoArtboard: $OLD_DIR"
    sudo rm -rf "$OLD_DIR"
    removed=1
fi

if [ $removed -eq 1 ]; then
    echo "----------------------------------------"
    echo "✅ Success: Extension removed."
    echo "----------------------------------------"
else
    echo "⚠️ Warning: Extension folder not found."
fi

echo "Press [Enter] to close..."
read
