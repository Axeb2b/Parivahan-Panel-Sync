#!/bin/bash
# Install apktool + Java (jarsigner) for APK building on Render
# Uses /tmp which is always writable

APKTOOL_JAR="/tmp/apktool.jar"
APKTOOL_BIN="/tmp/apktool"

echo "[setup] Checking for Java / jarsigner..."
if command -v jarsigner &>/dev/null; then
  echo "[setup] jarsigner found: $(which jarsigner)"
else
  echo "[setup] jarsigner not found — Java may be missing. APK signing will fail at runtime."
fi

echo "[setup] Checking for apktool..."
if [ -f "$APKTOOL_JAR" ]; then
  echo "[setup] apktool.jar already at $APKTOOL_JAR"
else
  echo "[setup] Downloading apktool 2.11.1 to /tmp..."
  wget -q "https://github.com/iBotPeaches/Apktool/releases/download/v2.11.1/apktool_2.11.1.jar" \
    -O "$APKTOOL_JAR" && echo "[setup] apktool.jar downloaded." || echo "[setup] wget failed."
fi

# Write wrapper script to /tmp
cat > "$APKTOOL_BIN" <<'EOF'
#!/bin/bash
exec java -jar /tmp/apktool.jar "$@"
EOF
chmod +x "$APKTOOL_BIN"

echo "[setup] Done. apktool at $APKTOOL_BIN"
