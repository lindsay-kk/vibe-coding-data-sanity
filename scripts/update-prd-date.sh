#!/bin/bash

# Script to automatically update the PRD last updated date
# Usage: ./update-prd-date.sh

# Get current date in YYYY-MM-DD format
current_date=$(date +"%Y-%m-%d")

# Update the PRD.md file with current date
sed -i '' "s/- \*\*Last Updated\*\*:.*/- **Last Updated**: $current_date/" PRD.md

echo "PRD.md updated with date: $current_date"