stack build
cd scripts
browserify index.js -o ../static/index.js
cd ..
stack exec celeste rebuild
