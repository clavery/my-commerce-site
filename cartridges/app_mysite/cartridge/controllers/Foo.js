const server = require("server");

server.get("Bar", function (req, res, next) {
    res.json({
        message: "Hello from Bar endpoint",
    });
    next();
});

module.exports = server.exports();
