# Development image: Node + pnpm only. The source is bind-mounted and the dependencies live in volumes
# (see docker-compose.yml), so nothing from the project is copied into the image.
FROM node:26.13.1-trixie-slim

# Keep in sync with "packageManager" in package.json.
RUN npm install --global pnpm@12.23.0 && npm cache clean --force

# The Makefile passes the host user's ids, so the files the container writes into the bind-mounted source
# (lockfile, build output, formatted files) belong to the host user.
ARG UID=1000
ARG GID=1000

# The volume mount points are created here so that new volumes start out owned by the container user.
RUN groupmod --non-unique --gid "$GID" node \
    && usermod --non-unique --uid "$UID" --gid "$GID" node \
    && mkdir -p /app/node_modules /app/packages/sim/node_modules /app/packages/client/node_modules \
        /home/node/.pnpm-store \
    && chown -R node:node /app /home/node

# pnpm store on its own volume: it survives removing node_modules and is shared by every container run.
ENV pnpm_config_store_dir=/home/node/.pnpm-store

USER node
WORKDIR /app
