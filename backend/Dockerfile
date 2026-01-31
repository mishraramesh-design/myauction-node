# Node.js Backend Dockerfile with Auto Setup
FROM node:20-alpine

# Install postgresql-client for database operations
RUN apk add --no-cache postgresql-client

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production && npm install -g nodemon

# Copy application code
COPY . .

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Expose port
EXPOSE 8001

# Use entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]
