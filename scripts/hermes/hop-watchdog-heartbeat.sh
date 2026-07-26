#!/bin/bash
# Weekly proof-of-life for the hop uptime watchdog itself (silent-on-success
# jobs give no signal that the checker is still running at all).
echo "hop watchdog alive — $(date '+%Y-%m-%d') — uptime checks running daily at 08:00"
