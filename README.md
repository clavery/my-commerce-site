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
- You want to have some form of configuration available so you don't have to provide arguments all on the command line. In most cases a standard `dw.json` will be best.
- We support multiple instances in one file using a `configs` array (this comes from the original intellij plugin). This is ignored by other tools that don't support it like prophet (but see below for how to use it with prophet).
```json
{
  "name": "zzpq-011",
  "hostname": "zzpq-011.dx.commercecloud.salesforce.com",
  "username": "clavery@salesforce.com",
  "password": "webdavpass",
  "client-id": "...",
  "client-secret": "...",
  "code-version": "v25_6_0",
  "active": true,
  "secureHostname": "",
  "configs": [
    {
      "name": "abcd-1234",
      "hostname": "abcd-123.dx.commercecloud.salesforce.com",
      "username": "clavery@salesforce.com",
      "password": "webdavpass",
      "client-id": "...",
      "client-secret": "...",
      "scapi-shortcode": "xitgmcd3",
      "active": false
    }
  ]
}
```
- The `active` one is the instance that is used by default but you can specify the instance with the `-i instance-name` argument to any command.
- See [Configuration](https://github.com/SalesforceCommerceCloud/b2c-tools?tab=readme-ov-file#configuration-1) for details on how you can use a `dw.js` file to provide your own configuration loading and how prophet uses this. So you can add multi-instance support to prophet.
- Client ID and secret are optional but very likely needed for anything that uses OCAPI. If a secret is not provided we will use implicit auth and open a browser. If a client ID is not provided we will use the `defaultClientId` in package.json if it's provide and implicit auth with that.
  - Note that implicit auth has some limitations so for full functionality you should provide a client ID and secret and client_credentials auth will be used.


### Code Deployment

- The `code` subcommand provides some useful tools for working with code versions
- `code deploy` will deploy all cartridges (respecting both an allowlist and a denylist) to the instance
- `code reload` will reload the code version on the instance
- `code watch` will watch the cartridges and automatically deploy any changes to the instance
- `code download` will download the code version from the instance and save it to a local directory
  - There is a `--mirror` option that will attempt to mirror cartridges of the same name to the local project and also keep local permissions
  - This is useful for viewing changes made to the instance out of version control

### Migrations

#### Exporting Data

- `./cli.js export site` will perform a site export with interactive selection without needing to login to business manager
    - automatically extracts the zip file

#### Importing Data

- `./cli.js import run` will run a migration site export folder, zip file or [migration script](#migration-scripts) and import it to the instance


- History is stored in in logs
    - Credential redaction

#### Migration Scripts

- the `import run` subcommand will run a migration script as well
- it can even run via standard input or a shell HEREDOC script when the `-` argument is used as the file
  - We use this in a couple places in CI/CD where we don't have an official script written

```bash
b2c-tools import run - <<EOF
const sites = await env.ocapi.get('/sites');
for (const site of sites.data.data) {
  console.log(site.id);
}
EOF
```

- Migration scripts follow a standard signature found throughout b2c-tools

### Page Designer

- Specifying alternative static asset exports
    - For instance in my library export `d570c14bd8a1ec9d3fd9c914f8` component sets an `image` and a `mobImage`
    - `b2c-tools export page main -q image.path -q mobImage.path`
    - Recommend adding this to `b2c-tools.asset-query` in `package.json` per project
- You can specify the library and use site libraries or shared
    - Recommend setting the default library in package.json per-project
- Using the page designer walk API
    - First parse the library xml: `await Library.parse(libraryXML)`
    - Then we can use that `Library` object to walk the content tree
    - `library.filter` will filter (or really "hide") any content that doesn't match the test
    - with a filtered library we can use `library.traverse` to walk again but with the callback able to mutate the content
    - `library.reset()` resets the filter (meaning all become unhidden)
    - There are some non-default flags for certain use cases
    - Finally we can output the library to a new string with `await library.toXMLString()` and do whatever including importing back to the instance.

### Features

### Logs

- `tail` will tail the server logs for the current instance
  - Use the `--normalize` flag to rewrite any paths that match local cartridges to the local path
  - This is useful for IDES and AI tools to find the files.
  - Here is an example of integrating this with [VSCode Tasks](https://github.com/SalesforceCommerceCloud/b2c-tools/blob/main/docs/TASKS.md)

### MCP

- There is a minimal MCP server implementation using the `mcp` subcommand
- One of the tools is `get-error-logs` which will get the error logs for the current instance
  - Any file path in the server error log that matches a cartridge locally will be rewritten to the local path like tail can do.

