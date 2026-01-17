#!/bin/bash
set -e

echo "Preparing data directory..."
mkdir -p ../docker/dynamodb && chmod 777 ../docker/dynamodb

echo "Starting Local DynamoDB..."
docker-compose up -d

echo "Waiting for DynamoDB to be ready..."
sleep 2

echo "Installing dependencies..."
npm install --silent

echo "Creating tables..."
node scripts/create-tables.mjs

echo "Linking handler dependencies..."
for dir in ../auth/*/ ../posts/*/ ../comments/*/ ../users/*/; do
  [ -d "$dir" ] && [ ! -e "${dir}node_modules" ] && ln -s "$(pwd)/node_modules" "${dir}node_modules"
done

echo "Ready! Start server with: bun run server"
