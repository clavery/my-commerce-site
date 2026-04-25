'use strict';

/**
 * Foo Controller
 *
 * @module controllers/Foo
 */

var server = require('server');

var cache = require('*/cartridge/scripts/middleware/cache');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');
var pageMetaData = require('*/cartridge/scripts/middleware/pageMetaData');



/**
 * Foo-Show : Renders the foo page
 * @name Foo-Show
 * @function
 * @memberof Foo
 * @param {middleware} - server.middleware.https
 * @param {middleware} - consentTracking.consent
 * @param {middleware} - cache.applyDefaultCache
 * @param {category} - sensitive
 * @param {renders} - isml
 * @param {serverfunction} - get
 */
server.get(
    'Show',
    server.middleware.https,
    consentTracking.consent,
    cache.applyDefaultCache,
    function (req, res, next) {
        var customerProfile = req.currentCustomer && req.currentCustomer.profile;
        var viewData = {
            title: 'Foo',
            message: 'Hello from test!',
            innerObject: {

                key1: 'Value 1',
                arr: ['Item 1', 'Item 2', 'Item 3']
            },
            customerNo: customerProfile ? customerProfile.customerNo : null
        };

        res.json(viewData);
        next();
    }
);

server.append('Show', pageMetaData.computedPageMetaData);



/**
 * Foo-Submit : Handles form submission for foo
 * @name Foo-Submit
 * @function
 * @memberof Foo
 * @param {middleware} - server.middleware.https
 * @param {httpparameter} - csrf_token - CSRF token
 * @param {category} - sensitive
 * @param {returns} - json
 * @param {serverfunction} - post
 */
server.post(
    'Submit',
    server.middleware.https,
    function (req, res, next) {
        var form = req.form;

        // TODO: Process form data
        var result = {
            success: true,
            message: 'Form submitted successfully'
        };

        res.json(result);
        next();
    }
);


/**
 * Foo-JSON : Returns JSON data for foo
 * @name Foo-JSON
 * @function
 * @memberof Foo
 * @param {middleware} - cache.applyDefaultCache
 * @param {category} - non-sensitive
 * @param {returns} - json
 * @param {serverfunction} - get
 */
server.get(
    'JSON',
    cache.applyDefaultCache,
    function (req, res, next) {
        var data = {
            success: true,
            data: {
                // TODO: Add your data here
            }
        };

        res.json(data);
        next();
    }
);


/**
 * Foo-SubmitJSON : Handles AJAX form submission for foo
 * @name Foo-SubmitJSON
 * @function
 * @memberof Foo
 * @param {middleware} - server.middleware.https
 * @param {httpparameter} - csrf_token - CSRF token
 * @param {category} - sensitive
 * @param {returns} - json
 * @param {serverfunction} - post
 */
server.post(
    'SubmitJSON',
    server.middleware.https,
    function (req, res, next) {
        var form = req.form;

        // TODO: Validate and process form data
        var result = {
            success: true,
            redirectUrl: null
        };

        res.json(result);
        next();
    }
);


module.exports = server.exports();
