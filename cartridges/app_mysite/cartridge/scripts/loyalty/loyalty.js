
var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');

var loyaltyService = LocalServiceRegistry.createService('loyalty.external.api', {
    createRequest: function (svc, customerNo) {
        svc.setRequestMethod('GET');
        svc.addHeader('Accept', 'application/json');
        svc.setURL(svc.getConfiguration().getCredential().getURL() + '/customers/' + customerNo + '/points');
        return null;
    },
    parseResponse: function (svc, client) {
        return JSON.parse(client.text);
    },
    filterLogMessage: function (msg) {
        return msg;
    }
});

module.exports.getLoyaltyPoints = function (customer) {
    if (!customer || !customer.profile) {
        return 0;
    }

    var fallbackPoints = customer.profile.custom && customer.profile.custom.loyaltyPoints
        ? customer.profile.custom.loyaltyPoints
        : 0;

    if (!customer.profile.customerNo) {
        return fallbackPoints;
    }

    var result = loyaltyService.call(customer.profile.customerNo);
    if (result.ok && result.object && result.object.points != null) {
        return result.object.points;
    }

    return fallbackPoints;
};
