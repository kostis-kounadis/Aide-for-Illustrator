#!/bin/bash
# enable_debug_mode.command
# Enables PlayerDebugMode for CEP in MacOS and creates a backup script to reverse it.
# Double-click to execute.

cd "$(dirname "$0")"

BACKUP_FILE="restore_debug_mode.command"

echo "#!/bin/bash" > "$BACKUP_FILE"
echo "# Revert CEP Debug Mode to previous state" >> "$BACKUP_FILE"
echo "cd \"\$(dirname \"\$0\")\"" >> "$BACKUP_FILE"

for v in 9 10 11 12 13 14 15; do
    # Read current value
    current=$(defaults read com.adobe.CSXS.$v PlayerDebugMode 2>/dev/null)
    
    if [ $? -eq 0 ] && [ ! -z "$current" ]; then
        # Back up existing value
        echo "defaults write com.adobe.CSXS.$v PlayerDebugMode $current" >> "$BACKUP_FILE"
    else
        # No value existed, so delete it to restore empty state
        echo "defaults delete com.adobe.CSXS.$v PlayerDebugMode 2>/dev/null" >> "$BACKUP_FILE"
    fi
    
    # Set to 1 (Enable)
    defaults write com.adobe.CSXS.$v PlayerDebugMode 1
    echo "Enabled PlayerDebugMode for com.adobe.CSXS.$v"
    echo "echo \"Restored PlayerDebugMode for com.adobe.CSXS.$v\"" >> "$BACKUP_FILE"
done

# Add double-click close pauses
echo "echo \"----------------------------------------\"" >> "$BACKUP_FILE"
echo "echo \"✅ Reverted debug mode settings successfully!\"" >> "$BACKUP_FILE"
echo "echo \"Press [Enter] to close...\"" >> "$BACKUP_FILE"
echo "read" >> "$BACKUP_FILE"

chmod +x "$BACKUP_FILE"

echo "----------------------------------------"
echo "✅ Success: Debug Mode enabled. Double-click '$BACKUP_FILE' to revert."
echo "Press [Enter] to close..."
read
