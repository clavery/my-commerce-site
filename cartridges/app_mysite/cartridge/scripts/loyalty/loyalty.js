
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
    var result = loyaltyService.call(customer.profile.customerNo);
    if (result.ok && result.object && result.object.points != null) {
        return result.object.points;
    }

    return customer.profile.custom.loyaltyPoints || 0;
}
