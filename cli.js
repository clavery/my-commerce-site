#!/usr/bin/env node
/**
 * B2C Industries Toolkit CLI Entry Point
 *
 * This script can be used for many/most of the industries toolkit instead of (and
 * serves as the entry point for) most of the npm "run" scripts
 */

const {cli, commands, logger} = require('@SalesforceCommerceCloud/b2c-tools');

require('dotenv').config({ override: true })

// extend b2c-tools cli
cli
    .epilogue('For more information, read our manual')
    .commandDir('./scripts', {
        include: /command.*/
    })
    .command(commands)
    .fail(function (msg, err, yargs) {
        if (err) {
            logger.error(err.message);
            logger.debug(err.stack);
        } else {
            console.error(yargs.help());
            console.error();
            console.error(msg);
        }
        process.exit(1);
    })
    .demandCommand()
    .help()
    .parse()
