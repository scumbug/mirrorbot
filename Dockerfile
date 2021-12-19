FROM node:lts-alpine3.14 as ts-compiler
WORKDIR /app
COPY package*.json /app
RUN npm install
COPY . /app
RUN npm run build

FROM node:lts-alpine3.14 as ts-remover
WORKDIR /app
COPY --from=ts-compiler /app/package*.json /app
COPY --from=ts-compiler /app/dist /app
RUN npm ci --only=production && npm cache clean --force

FROM gcr.io/distroless/nodejs:16
WORKDIR /app
COPY --from=ts-remover /app /app
USER 1000
CMD ["main.js"]