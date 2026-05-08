#!/usr/bin/env bash
# install.sh — symlink each skills/* directory into ~/.claude/skills/
# Idempotent: safe to re-run after git pull.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$REPO_ROOT/skills"
DEST_DIR="$HOME/.claude/skills"

if [ ! -d "$SRC_DIR" ]; then
  echo "ERROR: skills/ directory not found at $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

echo "Installing skills from $SRC_DIR → $DEST_DIR"
echo

linked=0
skipped=0
replaced=0

for skill_path in "$SRC_DIR"/*/; do
  skill_name="$(basename "$skill_path")"
  target="$DEST_DIR/$skill_name"

  if [ -L "$target" ]; then
    # already a symlink
    current_target="$(readlink "$target")"
    if [ "$current_target" = "${skill_path%/}" ]; then
      echo "  ✓ $skill_name (already linked)"
      skipped=$((skipped + 1))
      continue
    else
      echo "  ↻ $skill_name (relinking — was pointing to $current_target)"
      rm "$target"
      ln -s "${skill_path%/}" "$target"
      replaced=$((replaced + 1))
      continue
    fi
  fi

  if [ -e "$target" ]; then
    echo "  ⚠ $skill_name: a non-symlink already exists at $target"
    echo "    Skipping. Move/delete it manually if you want to replace it."
    continue
  fi

  ln -s "${skill_path%/}" "$target"
  echo "  + $skill_name"
  linked=$((linked + 1))
done

echo
echo "Result: $linked new, $replaced relinked, $skipped already linked."
echo
echo "Next steps:"
echo "  1. Set GRSAI_API_KEY (and any other provider keys) in ~/.baoyu-skills/.env"
echo "     mkdir -p ~/.baoyu-skills && chmod 700 ~/.baoyu-skills"
echo "     echo 'GRSAI_API_KEY=sk-your-key' >> ~/.baoyu-skills/.env"
echo "     chmod 600 ~/.baoyu-skills/.env"
echo "  2. Restart Claude Code (or run /reload-plugins) to pick up the new skills."
echo "  3. Try it: /image-cards <your-draft.md> --style notion --layout dense"
