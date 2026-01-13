#!/bin/bash
set -e

echo "Preparing data directory..."
mkdir -p data/dynamodb && chmod 777 data/dynamodb

echo "Starting Local DynamoDB..."
docker-compose up -d

echo "Waiting for DynamoDB to be ready..."
sleep 2

echo "Installing dependencies..."
npm install --silent

echo "Creating tables..."
node scripts/create-tables.mjs

echo "Database is ready at http://127.0.0.1:8000"
