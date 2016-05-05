Opengamebox 2 Server
====================

This is the official server implementation for Opengamebox 2 made with
NodeJS.

Running
-------

If you didn't clone this Git repository recursively, you need to initialize
the submodules:

	$ git submodule init

After you checkout a new commit, you need to update the submodules and npm
dependencies:

	$ git submodule update
	$ npm install

The server can be started with:

	$ npm start
