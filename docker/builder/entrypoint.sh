#!/usr/bin/env bash
set -euo pipefail

TASK="${1:-build}"
cd /workspace

case "$TASK" in
  build)
    gradle --no-daemon build
    ;;
  genSources)
    gradle --no-daemon genSources
    mkdir -p /workspace/output
    # Loom's exact cache layout varies by version; search broadly for the
    # named (Yarn-mapped) decompiled sources jar it produces.
    SOURCES_JAR=$(find "$HOME/.gradle/caches/fabric-loom" -iname "*-sources.jar" 2>/dev/null | grep -i minecraft | head -n1 || true)
    if [ -z "$SOURCES_JAR" ]; then
      echo "error: could not locate Fabric Loom's decompiled sources jar under \$HOME/.gradle/caches/fabric-loom" >&2
      exit 1
    fi
    unzip -q -o "$SOURCES_JAR" -d /workspace/output
    ;;
  *)
    echo "unknown command: $TASK (expected 'build' or 'genSources')" >&2
    exit 1
    ;;
esac
