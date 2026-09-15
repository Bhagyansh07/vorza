#! /usr/bin/env bash

set -e

pytest --exitfirst --verbose --failed-first --cov=app --cov-report=term-missing