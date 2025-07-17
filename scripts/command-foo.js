/**
 * Example b2c-tools extension command
 */
const { Environment } = require("@SalesforceCommerceCloud/b2c-tools");

async function foo(vars = {}) {
    const env = new Environment();

    console.log(`Running in environment: ${env.server}`);

    const sites = await env.ocapi.get("/sites?select=(**)");
    for (const site of sites.data.data) {
        console.log(`Site ID: ${site.id}`);
    }
}

module.exports = {
    command: "foo",
    desc: "do something special",
    builder: (yargs) => yargs,
    handler: async (argv) => {
        const { vars } = argv;
        await foo({ vars });
    },
};
