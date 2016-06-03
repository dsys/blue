# ==============================================================================
# config

.PHONY: all build clean install lint publish test

all: test

# ==============================================================================
# phony targets

build:
	./node_modules/.bin/babel src --ignore __tests__,__mocks__ --out-dir dist

clean:
	@- rm -rf node_modules

install:
	npm install

lint: | node_modules
	./node_modules/.bin/standard

publish: build
	npm publish

test: | node_modules
	./node_modules/.bin/jest --watch

# ==============================================================================
# file targets

node_modules:
	npm install
