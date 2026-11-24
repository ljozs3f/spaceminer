# Space Miner: every command runs in Docker. `make` lists the targets.

.DEFAULT_GOAL := help
SHELL         := /bin/bash

# Container user = host user, so files written into the bind-mounted source belong to you (never root).
HOST_UID := $(shell id -u)
HOST_GID := $(shell id -g)
ifeq ($(HOST_UID),0)
HOST_UID := 1000
HOST_GID := 1000
endif
export HOST_UID HOST_GID

COMPOSE := docker compose
RUN     := $(COMPOSE) run --rm client
# compose reads .env when it exists; these are the defaults otherwise
CLIENT_PORT  := $(or $(shell sed -n 's/^CLIENT_PORT=//p' .env 2>/dev/null),5173)
LOCAL_DOMAIN := $(or $(shell sed -n 's/^LOCAL_DOMAIN=//p' .env 2>/dev/null),spaceminer.localdev.hu)
HTTPS_PORT   := $(or $(shell sed -n 's/^HTTPS_PORT=//p' .env 2>/dev/null),443)

.PHONY: help install deps up down restart logs shell test test-watch lint format typecheck build sprites check clean urls

help: ## Show this help
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z_-]+:.*## / {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install the dependencies (updates the lockfile after package.json changes)
	$(RUN) pnpm install

deps:
	@$(RUN) pnpm install --frozen-lockfile --reporter=silent

up: ## Start the dev server and the HTTPS proxy in the background
	$(COMPOSE) up --detach --build --remove-orphans
	@$(MAKE) --no-print-directory urls

down: ## Stop and remove the containers (dependency volumes are kept)
	$(COMPOSE) down --remove-orphans

restart: down up ## Restart everything

logs: ## Follow the logs
	$(COMPOSE) logs --follow --tail=200

shell: ## Open a shell in a new client container
	$(RUN) bash

test: deps ## Run the sim tests
	$(RUN) pnpm test

test-watch: deps ## Run the sim tests in watch mode
	$(RUN) pnpm test:watch

lint: deps ## ESLint + Prettier check
	$(RUN) pnpm lint

format: deps ## Format every file with Prettier
	$(RUN) pnpm format

typecheck: deps ## Type check sim (tsc) and client (vue-tsc)
	$(RUN) pnpm typecheck

build: deps ## Production build of the client (packages/client/dist)
	$(RUN) pnpm build

sprites: deps ## Cut the sprite sheets in packages/client/art into src/assets/sprites
	$(RUN) pnpm sprites

check: deps ## lint + typecheck + test + build
	$(RUN) pnpm check

clean: ## Remove containers, images, dependency volumes and build output
	$(COMPOSE) down --remove-orphans --volumes --rmi local
	rm -rf packages/client/dist

urls:
	@echo
	@echo "  Game  http://localhost:$(CLIENT_PORT)"
	@echo "        https://$(LOCAL_DOMAIN)$(if $(filter 443,$(HTTPS_PORT)),,:$(HTTPS_PORT))"
	@echo
