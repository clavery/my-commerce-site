const server = require("server");

server.get("Bar", function (req, res, next) {
    var foo = "wei";
    res.json({
        message: "Hello from Bar endpoint test foo",
    });
    next();
});

module.exports = server.exports();
