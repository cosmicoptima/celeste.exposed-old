build:
	stack build
	browserify scripts/index.js -o static/index.js
	stack exec celeste rebuild

dev: build
	stack exec celeste watch
