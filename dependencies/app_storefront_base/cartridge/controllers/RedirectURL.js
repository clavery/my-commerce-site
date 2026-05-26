'use strict';

/**
 * @namespace RedirectURL
 */

var server = require('server');

/**
 * RedirectURL-Start : The RedirectURL-Start endpoint handles URL redirects
 * @name Base/RedirectURL-Start
 * @function
 * @memberof RedirectURL
 * @param {category} - non-sensitive
 * @param {serverfunction} - get
 */
server.get('Start', function (req, res, next) {
    var URLRedirectMgr = require('dw/web/URLRedirectMgr');

    var redirect = URLRedirectMgr.redirect;
    var location = redirect ? redirect.location : null;
    var redirectStatus = redirect ? redirect.getStatus() : null;

    if (!location) {
        // New code (or add this to overlay cartridge)
        const originalPath = request.httpHeaders.get('x-is-path_info');
        if (originalPath) {
            const storeName = originalPath
                .replace(/^\/(?:s\/[^\/]+\/)?/, '')
                .split('/')[0];

            var t = request
            // only redirect if storeName contains uppercase letters and is valid
            if (storeName && /[A-Z]/.test(storeName)) {
                const store = dw.catalog.StoreMgr.getStore(
                    storeName.toLowerCase()
                );
                if (store) {
                    const newPath = originalPath.replace(storeName, store.ID);
                    res.redirect(newPath);
                    next();
                    return;
                }
            }
        }
        // end new code
        res.setStatusCode(404);
        res.render('error/notFound');
    } else {
        if (redirectStatus) {
            res.setRedirectStatus(redirectStatus);
        }
        res.redirect(location);
    }

    next();
});

/**
 * RedirectURL-Hostname : The RedirectURL-Hostname endpoint handles Hostname-only URL redirects
 * @name Base/RedirectURL-Hostname
 * @function
 * @memberof RedirectURL
 * @param {querystringparameter} - Location - optional parameter to provide a URL to redirect to
 * @param {category} - non-sensitive
 * @param {serverfunction} - get
 */
server.get('Hostname', function (req, res, next) {
    var URLUtils = require('dw/web/URLUtils');

    var url = req.querystring.Location.stringValue;
    var hostRegExp = new RegExp('^https?://' + req.httpHost + '(?=/|$)');
    var location;

    if (!url || !hostRegExp.test(url)) {
        location = URLUtils.httpHome().toString();
    } else {
        location = url;
    }

    res.redirect(location);
    next();
});

module.exports = server.exports();
