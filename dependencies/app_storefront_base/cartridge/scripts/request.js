
exports.onSession = function () {
    // dw.catalog.StoreMgr.setStoreIDToSession("store1");
    var storeID = dw.catalog.StoreMgr.storeIDFromSession;
    var t = storeID;
}

exports.onRequest = function () {
    var t = request;
    var s = t;
}
