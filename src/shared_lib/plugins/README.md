# Plugins Folder

Plugins define behavior that is common to all the routes in the
application.

Authentication, caching, templates, and all the other cross cutting concerns should be handled by plugins placed in this folder.

Files in this folder are typically defined through the
[`fastify-plugin`](https://github.com/fastify/fastify-plugin) module,
making them non-encapsulated (encapsulation in the sense explained [here](https://github.com/fastify/fastify/blob/HEAD/docs/Reference/Encapsulation.md)).

They can optionally define decorators and set hooks
that will then be used in the rest of the application.

Resources:

* [The hitchhiker's guide to plugins](https://fastify.dev/docs/latest/Guides/Plugins-Guide/)
* [Fastify decorators](https://fastify.dev/docs/latest/Reference/Decorators/).
* [Fastify lifecycle](https://fastify.dev/docs/latest/Reference/Lifecycle/).
