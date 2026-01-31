# ---------- Build stage ----------
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

# Clean, deterministic install
RUN npm install --legacy-peer-deps

# CRA + CRACO + AJV fix (pin once, not twice)
RUN npm install ajv@8 ajv-keywords@5 --save-exact --legacy-peer-deps

COPY . .

# Accept build-time args from GitHub Actions
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV CI=false

# Debug-friendly build
RUN npm run build --verbose

# ---------- Runtime stage ----------
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
