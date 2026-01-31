# Node.js Backend Dockerfile
FROM node:20-alpine

# Install postgresql-client for database operations
RUN apk add --no-cache postgresql-client wget

# Set working directory
WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./

# Install dependencies
RUN npm install --production

# Copy backend application code
COPY backend/ ./

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Expose port
EXPOSE 8001

# Use entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]
