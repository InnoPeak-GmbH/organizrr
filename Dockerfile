FROM golang:1.24-alpine AS wasm_builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY main.go ./
RUN GOOS="js" GOARCH="wasm" go build -o main.wasm

RUN cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" ./

FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=wasm_builder /app/main.wasm ./public/main.wasm
COPY --from=wasm_builder /app/wasm_exec.js ./src/wasm_exec.js
COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN npm run build

FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist

RUN npm i -g serve

EXPOSE 3000

CMD [ "serve", "-s", "dist" ]
