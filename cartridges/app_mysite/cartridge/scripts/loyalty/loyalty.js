
module.exports.getLoyaltyPoints = function (customer) {
    if (!customer || !customer.profile) {
        return 0;
    }
    return customer.profile.custom.loyaltyPoints || 0;
}
