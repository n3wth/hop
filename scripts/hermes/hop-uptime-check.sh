#!/bin/bash
# hop watchdog: silent when healthy, prints a line per failing path when not.
# hermes cron runs this with --no-agent, so stdout is delivered verbatim and
# empty stdout means no message is sent at all.
set -u
for path in '/' '/sweet-spots'; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "https://hop.flights${path}")
  if [ "$code" != "200" ]; then
    echo "hop.flights${path} returned HTTP ${code:-timeout/no-response} (expected 200)"
  fi
done
