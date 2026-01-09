#!/bin/bash
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install from https://nodejs.org/"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

node ml-scraper.js "$@"