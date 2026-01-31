#!/bin/sh
set -e

echo "========================================"
echo "Reverse Auction Backend - Starting..."
echo "========================================"

# Wait for external database to be ready
echo "Waiting for external PostgreSQL database..."
until PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c '\q' 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "✓ PostgreSQL is ready!"

# Initialize database schema
echo "Initializing database schema..."
node /app/scripts/init-db.js

if [ $? -eq 0 ]; then
  echo "✓ Database initialized successfully"
else
  echo "✗ Database initialization failed"
  exit 1
fi

# Start the application
echo "Starting Node.js server..."
exec node server.js
