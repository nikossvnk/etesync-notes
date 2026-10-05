#!/usr/bin/env bash
# Installs EteSync Notes as a web app that runs on this computer only, built from the repository
# this script is in, or updates it when it's installed already (it's safe to run again).
# See README.md in this directory.
#
#   ./install.sh                      # install, or update to what the repository has now
#   git pull && ./install.sh          # update to the latest version
#   PORT=8091 ./install.sh            # another port (default 8090)
#   BROWSER=chromium ./install.sh     # the browser the shortcut opens (default: found automatically)
#
# What it does:
#   1. Builds the web version of this repository into ~/.local/share/etesync-notes-web/site
#   2. Serves it on http://localhost:PORT with a systemd user service, etesync-notes-web.service,
#      which starts when you log in (only reachable from this computer)
#   3. Adds "EteSync Notes" to the applications menu, and a shortcut on the desktop
set -euo pipefail

PORT="${PORT:-8090}"
BASE="${XDG_DATA_HOME:-$HOME/.local/share}/etesync-notes-web"
SITE="$BASE/site"
URL="http://localhost:$PORT"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
APPS_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$(cd "$SCRIPT_DIR/.." && pwd)"

step() { printf '\n==> %s\n' "$*"; }
need() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "Missing $1. $2" >&2
        exit 1
    fi
}

need python3 "Install it, e.g. with: sudo dnf install python3"
need node "Install Node.js 20 or newer, e.g. with: sudo dnf install nodejs (or with nvm)"
need npm "It comes with Node.js"
need systemctl "This needs systemd"
if [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
    echo "Node.js $(node --version) is too old, version 20 or newer is needed" >&2
    exit 1
fi

if [ "$(node -p "require('$SRC/package.json').name" 2>/dev/null)" != "etesync-notes" ]; then
    echo "$SRC is not the etesync-notes repository, this script has to stay in its local-web directory" >&2
    exit 1
fi

step "Building the web version of $SRC"
mkdir -p "$BASE"
if command -v git >/dev/null 2>&1 && [ -d "$SRC/.git" ]; then
    echo "At $(git -C "$SRC" log -1 --format='%h %s')"
    if [ -n "$(git -C "$SRC" status --porcelain --untracked-files=no)" ]; then
        echo "Note: the repository has uncommitted changes, they are part of the build"
    fi
fi
(
    cd "$SRC"
    # The packages are only installed when they aren't there, and then removed again after the build
    # (a few hundred MB that are only needed to build). Existing ones, e.g. of a checkout that's used
    # for development, are used as they are.
    installed_here=""
    if [ ! -d node_modules ]; then
        echo "Installing the packages needed to build (this takes a few minutes)"
        npm ci --no-audit --no-fund --loglevel=error
        installed_here=1
    fi
    rm -rf "$BASE/site.new"
    status=0
    npx expo export --platform web --output-dir "$BASE/site.new" > "$BASE/build.log" 2>&1 || status=$?
    [ -n "$installed_here" ] && rm -rf node_modules
    if [ "$status" -ne 0 ]; then
        echo "The build failed, see $BASE/build.log" >&2
        exit 1
    fi
)
# (src: earlier versions of this script kept a clone of the repository there)
rm -rf "$BASE/site.old" "$BASE/src"
[ -d "$SITE" ] && mv "$SITE" "$BASE/site.old"
mv "$BASE/site.new" "$SITE"
rm -rf "$BASE/site.old"

step "Installing the service (etesync-notes-web.service on $URL)"
cp "$SCRIPT_DIR/serve.py" "$BASE/serve.py"
cp "$SRC/assets/icon.png" "$BASE/icon.png"
mkdir -p "$UNIT_DIR"
cat > "$UNIT_DIR/etesync-notes-web.service" <<UNIT
[Unit]
Description=EteSync Notes, served on $URL (this computer only)

[Service]
ExecStart=$(command -v python3) $BASE/serve.py --port $PORT --dir $SITE
Restart=on-failure

[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --quiet etesync-notes-web.service
systemctl --user restart etesync-notes-web.service
for _ in $(seq 1 20); do
    curl -fsS -o /dev/null "$URL/" 2>/dev/null && break
    sleep 0.5
done
curl -fsS -o /dev/null "$URL/" || { echo "The service doesn't answer on $URL, see: journalctl --user -u etesync-notes-web" >&2; exit 1; }

step "Adding the shortcut"
# A browser that can open it in its own window (an "app" window, without tabs and address bar)
browser="${BROWSER:-}"
if [ -z "$browser" ]; then
    for b in chromium-browser chromium google-chrome-stable google-chrome brave-browser microsoft-edge firefox; do
        if command -v "$b" >/dev/null 2>&1; then
            browser="$b"
            break
        fi
    done
fi
case "$(basename "${browser:-xdg-open}")" in
    chromium*|google-chrome*|brave*|microsoft-edge*) exec_line="$browser --app=$URL" ;;
    firefox*) exec_line="$browser --new-window $URL" ;;
    *) exec_line="xdg-open $URL" ;;
esac
mkdir -p "$APPS_DIR"
desktop_file="$APPS_DIR/etesync-notes-web.desktop"
cat > "$desktop_file" <<DESKTOP
[Desktop Entry]
Type=Application
Name=EteSync Notes
Comment=End-to-end encrypted notes (runs on this computer, $URL)
Exec=$exec_line
Icon=$BASE/icon.png
Categories=Office;
StartupNotify=true
DESKTOP
chmod +x "$desktop_file"
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database --quiet "$APPS_DIR" || true
desktop_dir="$(command -v xdg-user-dir >/dev/null 2>&1 && xdg-user-dir DESKTOP || echo "$HOME/Desktop")"
if [ -d "$desktop_dir" ]; then
    cp "$desktop_file" "$desktop_dir/etesync-notes-web.desktop"
    chmod +x "$desktop_dir/etesync-notes-web.desktop"
    # GNOME only starts desktop shortcuts that are marked as trusted
    command -v gio >/dev/null 2>&1 && gio set "$desktop_dir/etesync-notes-web.desktop" metadata::trusted true 2>/dev/null || true
fi

step "Done"
echo "EteSync Notes runs on $URL. Open it from the applications menu or the desktop (it opens with: $exec_line)."
echo "To update it later: git pull, then run this script again."
