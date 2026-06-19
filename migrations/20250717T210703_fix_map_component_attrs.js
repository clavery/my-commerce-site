#!/usr/bin/env node

const LIBRARY_ID = 'NTO-SiteSharedLibrary';

/**
 * Fixes the latLong attribute to be two attributes (lat, long) in the
 * custom.map component.
 *
 * @param {import('@SalesforceCommerceCloud/b2c-tools').MigrationScriptArguments} options
 * @return {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
module.exports = async function ({env, logger, helpers, vars}) {
    const {Library, siteArchiveExportText, siteArchiveImportText} = helpers;

    var archive = await siteArchiveExportText(env, {
        libraries: {
            [LIBRARY_ID]: true
        }
    })
    const libraryXML = archive.get(`libraries/${LIBRARY_ID}/library.xml`)
    if (!libraryXML) {
        throw new Error('No library found in archive');
    }
    const library = await Library.parse(libraryXML)

    // recursively filter for specific component and mutate it's data (i.e. set title to uppercase)
    library.filter((node) => node.typeID === 'component.custom.map', {
        recursive: true
    }).traverse(node => {
        if (node.data.latLong) {
            logger.info(`Fixing latLong for component ${node.ID}`);
            const [latitude, longitude] = node.data.latLong.split(',');
            node.data.latitude = latitude.trim();
            node.data.longitude = longitude.trim();
            delete node.data.latLong; // remove the old latLong attribute
        }
    })

    //library.outputLibraryTree(logger, {traverseHidden: true});
    //logger.info(await library.toXMLString())

    // import mutated components
    archive.set(`libraries/${LIBRARY_ID}/library.xml`, await library.toXMLString())
    await siteArchiveImportText(env, archive)
}

// Can also be awaited if using top level await supported node (>=14.8)
// require.main === module && require('@SalesforceCommerceCloud/b2c-tools').runAsScript()
require.main === module && require('@SalesforceCommerceCloud/b2c-tools').runAsScript()
