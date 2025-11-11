#!/bin/bash

# Create PR using GitHub CLI if available, otherwise open browser
if command -v gh &> /dev/null; then
  gh pr create \
    --title "feat: security hardening and release automation" \
    --body-file .pr-description.md \
    --base main \
    --head feature/security-hardening
else
  echo "GitHub CLI not found. Opening browser to create PR manually..."
  open "https://github.com/nicolasrestrepo/Ayllu/compare/main...feature/security-hardening?expand=1"
  echo ""
  echo "PR description has been saved to .pr-description.md"
  echo "Copy the contents and paste it into the PR description field."
fi

