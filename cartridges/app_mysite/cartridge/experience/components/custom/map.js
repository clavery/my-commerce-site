const Template = require('dw/util/Template');
const HashMap = require('dw/util/HashMap');

/**
 * Render logic for the banner
 * @param {dw.experience.PageScriptContext} context The page context
 * @return {string} The rendered template
 */
module.exports.render = function (context) {
    const model = new HashMap();
    const { content } = context;

    model.latLong = content.latLong;

    return new Template('experience/components/custom/map').render(model).text;
};
