#! /usr/bin/env bash

# Run tests against the local .env database (Postgres or sqlite) instead of
# forcing a throwaway test DB. Used for quick smoke runs.
set -e

pytest --exitfirst --verbose