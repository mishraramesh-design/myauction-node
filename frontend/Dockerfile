# ---------- Build stage ----------
FROM node:20 AS build

WORKDIR /app

COPY package*.json ./

# Fix CRA + CRACO + AJV incompatibility
RUN npm install --legacy-peer-deps \
  && npm install ajv@8 ajv-keywords@5 --legacy-peer-deps

COPY . .

# CRA / CRACO build
ENV CI=false
RUN npm run build

# ---------- Runtime stage ----------
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
