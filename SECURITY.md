# Security Policy

## Reporting a vulnerability

If you believe you've found a security issue in the Site Kit, please report it privately.

Email: **security@ops42.org**

Please include:

- A description of the issue and its impact
- Steps to reproduce, ideally a minimal example
- The kit version (`@hostsmith/site-kit-astro` in `package.json`) and Node.js version

We aim to acknowledge reports within 5 business days and to give a status update within 14 days. Please give us reasonable time to ship a fix before publishing details.

## Scope

The kit builds static sites. The built output has no server code and loads nothing from third-party hosts. Reports about the kit's build tooling, its dependencies or the HTML it produces are in scope. Issues in the Hostsmith platform itself go to the same address, marked as platform-related.

## Supported versions

Security fixes go into the latest kit release. Sites take a fix by installing that release of `@hostsmith/site-kit-astro`, as the README's "Kit updates" describes.
