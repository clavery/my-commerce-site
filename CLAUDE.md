- working with content / page designer: when asked to manage content pages and components use the b2c-cli:b2c-content skill to learn how to do it
- always use the b2c related skills to inform yourself on b2c cli syntax and conventions before attempting to run the b2c CLI. the skills include important idiomatic details about usage
- do not assume values like library IDs or tenant IDs. These are almost always already configured in the default configuration for the sandbox/instance. Just lets the b2c cli load the defaults. Only if we explicitly need to provide a flag provide one.
- when making metadata changes the user requests be sure to use the b2c job import (use the skill to learn) to reimport the changes if requested.
- remember that b2c metadata outputs in a directory structure of largely XML files. observe the output paths of commands

- use the b2c-logs skill to retrieve logs for troubleshooting and debugging. This will help you understand what went wrong and how to fix it.
