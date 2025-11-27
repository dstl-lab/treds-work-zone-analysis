TODAY := $(shell date +"%m-%d")

.PHONY: help
help:
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: build-sparklines-v2
build-sparklines-v2: ## builds the sparklines-v2 project
	cd docs/sparklines-v2 && npm run build

.PHONY: build-8-18_9-18
build-8-18_9-18: ## builds the 8-18_9-18 project
	cd docs/8-18_9-18 && npm run build

.PHONY: push
push: build-8-18_9-18 ## pushes changes
	git add -A
	git commit -m "Update $(TODAY)" --allow-empty
	git pull origin main
	git push origin main

.PHONY: lab
lab: ## runs jupyterlab
	uv run jupyter lab
