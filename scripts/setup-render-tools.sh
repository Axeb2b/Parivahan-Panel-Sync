#!/bin/bash
# Install apktool + Java (jarsigner) for APK building on Render
set -e

echo "[setup] Checking for Java..."
if ! command -v jarsigner &>/dev/null; then
  echo "[setup] Installing default-jdk..."
  apt-get install -y default-jdk-headless 2>/dev/null || true
fi

echo "[setup] Checking for apktool..."
if ! command -v apktool &>/dev/null; then
  echo "[setup] Downloading apktool 2.11.1..."
  wget -q "https://github.com/iBotPeaches/Apktool/releases/download/v2.11.1/apktool_2.11.1.jar" \
    -O /usr/local/bin/apktool.jar

  cat > /usr/local/bin/apktool <<'EOF'
#!/bin/bash
exec java -jar /usr/local/bin/apktool.jar "$@"
EOF
  chmod +x /usr/local/bin/apktool
  echo "[setup] apktool installed."
else
  echo "[setup] apktool already available."
fi

echo "[setup] Tools ready."
