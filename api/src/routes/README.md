# Routes Folder

Routes define the pathways within your application.

Fastify's structure supports the modular monolith approach, where the
application is organized into distinct, self-contained modules.

This facilitates easier scaling and future transition to a microservice architecture.

In the future you might want to independently deploy pieces of it.

In this folder we should define all the routes that define the endpoints
of your web application.

Each service is a [Fastify plugin](https://fastify.dev/docs/latest/Reference/Plugins/), it is encapsulated (it can have its own independent plugins) and it is typically stored in a file;

Careful to group your routes logically, e.g. all `/users` routes in a `users.js` file.

There is a `root.js` file that defines the root route (`/`).

If a single file becomes too large, create a folder and add a `index.ts` file there:

* This file must be a Fastify plugin, and it will be loaded automatically by the application. You can now add as many files as you want inside that folder.

In this way you can create complex routes within a single monolith,
and eventually extract them.

If you need to share functionality between routes, place that
functionality into the `plugins` folder, and share it via
[decorators](https://fastify.dev/docs/latest/Reference/Decorators/).

If you're a bit confused about using `async/await` to write routes, you would better take a look at [Promise resolution](https://fastify.dev/docs/latest/Reference/Routes/#promise-resolution) for more details.
