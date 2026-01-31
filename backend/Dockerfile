FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

# Backend port (change if your app uses a different one)
EXPOSE 8001

# Start backend
CMD ["npm", "start"]
