FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        curl \
        build-essential \
        python3 \
        postgresql \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

USER ubuntu
