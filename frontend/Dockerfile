# ---------- Build stage ----------
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json yarn.lock ./

# Use Yarn (matches packageManager)
RUN corepack enable && yarn install --frozen-lockfile

COPY . .

ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV CI=false

RUN yarn build

# ---------- Runtime stage ----------
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
