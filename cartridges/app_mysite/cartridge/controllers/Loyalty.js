const server = require("server");

server.get("GetCurrentPoints", function (req, res, next) {
    const loyaltyHelper = require('*/cartridge/scripts/loyalty/loyalty');
    const currentCustomer = req.currentCustomer.raw;

    const points = loyaltyHelper.getLoyaltyPoints(currentCustomer);
    res.json({
        loyaltyPoints: points,
    });
    next();
});

module.exports = server.exports();
