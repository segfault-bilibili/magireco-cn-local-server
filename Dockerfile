FROM node:current-alpine3.15 as build

WORKDIR /build
ADD package*.json ./
RUN npm ci --ignore-scripts && npm cache clean --force
ADD . .
RUN npm run build && npm prune --omit=dev

FROM node:current-alpine3.15

WORKDIR /app
COPY --from=build /build/package.json ./
COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build/bin ./bin
COPY --from=build /build/out ./out
RUN chmod +x ./bin/magireco-cn-local-server
RUN ln -s /app/bin/magireco-cn-local-server /usr/local/bin/magireco-cn-local-server

WORKDIR /data
VOLUME /data
EXPOSE 10000 10001 10002

ENTRYPOINT [ "magireco-cn-local-server" ]
