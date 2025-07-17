# my commerce site

This is a sample b2c commerce site used strictly to demonstration `b2c-tools` features.

## Installation

```bash
npm install
./cli.js instance debug
```

## Guide

### Install and Extensions

- See [installation](https://github.com/SalesforceCommerceCloud/b2c-tools?tab=readme-ov-file#installation) for the many ways to install
- My recommendation is to both install globally by simply `npm install -g .` in the project checkout *and* to install locally per-project ussing the git subtree method and added as a file: dependecy in `package.json`:
    - This keeps is always available and the per-project install allows for easy extension
    - making it available using the [./cli.js](./cli.js) script means that any of your projects users always have it available without installing it globally or even understand what b2c-tools is. It just becomes a part of your project.

### Configuration loading

- See how a `./scripts/command-foo.js` implements an extension to the `b2c-tools` CLI for just this project
    - Notice how it initializs an `Environment` but does not need to specify arguments, as they will be provided by b2c-tools normal configuration loading procedures

### Code Deployment

- deploy script
- `code watch`

### Migrations

- History in logs
    - Credential redaction

### Page Designer

- Specifying alternative static asset exports
    - For instance in my library export `d570c14bd8a1ec9d3fd9c914f8` component sets an `image` and a `mobImage`
    - `b2c-tools export page main -q image.path -q mobImage.path`
    - Recommend adding this to `b2c-tools.asset-query` in `package.json` per project

### Features

### MCP


