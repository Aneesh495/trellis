.PHONY: all bootstrap build test verify bench clean audit help

all: verify build

bootstrap:
	npm install

build:
	npm run build

test:
	npm test

verify:
	npm run verify

bench:
	npm run bench

audit:
	npm run audit:emdash

clean:
	rm -rf dist build coverage *.tsbuildinfo
	rm -rf c/build
	find . -name "*.pyc" -delete
	find . -name "__pycache__" -delete

help:
	@echo "Trellis build targets:"
	@echo "  bootstrap : Install all project dependencies"
	@echo "  build     : Compile TypeScript workspace packages"
	@echo "  test      : Execute full test suite"
	@echo "  verify    : Audit em dashes, run typecheck, and execute tests"
	@echo "  bench     : Run performance microbenchmarks"
	@echo "  audit     : Run zero-defect em dash audit"
	@echo "  clean     : Purge compiled artifacts and cache files"
