#!/bin/sh
set -e

if [ -f knexfile.ts ]; then
  yarn migrate:latest
fi

exec "$@"
