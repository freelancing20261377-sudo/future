#!/bin/bash
# deploy.sh — One-command push to Vercel (futurespacesweb)
# Usage: ./deploy.sh "your commit message"
#        ./deploy.sh              (uses default message with timestamp)

MSG="${1:-"Update: $(date '+%b %d %H:%M')"}"

echo "📦 Staging all changes..."
git add -A

echo "✍️  Committing: $MSG"
git commit -m "$MSG" || { echo "Nothing to commit."; }

echo "🚀 Pushing to futurespacesweb (Vercel)..."
git push futurespacesweb main

echo "✅ Done! Live at https://futurespacesweb.vercel.app"
