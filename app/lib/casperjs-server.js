var system = require("system");
var casper = require('casper').create({
    viewportSize: {width: 1366, height: 768},
    pageSettings: {
        userAgent: "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/33.0.1750.149 Safari/537.36",
        loadImages: false,
        loadPlugins: false,
        resourceTimeout: 10000
    },
    verbose: true,
    logLevel: 'debug'
});

var port = 8587;
if (system.args[4]) {
    port = system.args[4];
}
var server = require('webserver').create();
var CookieTool = require("./cookie.js");
//phantom.addCookie({
//    'name': 'referencedPos',
//    'value': 1077,
//    'domain': 'www.lagranderecre.fr'
//});
casper.start();
var timeout = 20000;//10 seconds
var serverStatus = server.listen(port, function (request, response) {
    casper.then(function () {
        //var method = request.method;
        switch (request.url) {
            case "/process" :
            {
                var postData = request.post;
                postData = this.evaluate(function (s) {
                    return JSON.parse(s);
                }, postData);
                if (postData) {
                    _process(postData, response);
                } else {
                    _outputJSON({
                        "status": false,
                        "message": "There is no account details to be handled."
                    }, response);
                }
                break;
            }
            case "/exit":
            {
                _output("server is stopping.", response);
                server.close();
                casper.exit();
                break;
            }
            default :
            {
                _output("server is running.", response);
            }
        }
    });
    casper.on("exit", function (code) {
        casper.log("Casper server exit:" + code, "error");
    });
    casper.on("error", function (msg) {
        casper.log(msg, "error");
    });
    casper.on("resource.error", function (resourceError) {
        casper.log("Resource error:" + JSON.stringify(resourceError), "debug");
    });
    casper.run(function () {
        casper.log("Casper listening on port " + port, "info");
    });
});

if (!serverStatus) {
    casper.log("Failed to listen on port " + port, "error");
    casper.exit(1);
}

function _process(job, res) {
    var url = job.url;
    var method = job.method;
    var scriptFile = job.scriptFile;
    var json = {
        status: false,
        updateTime: new Date().toUTCString(),
        postData: job
    };
    var script = require(scriptFile);
    if (script) {
        casper.thenOpen(url, function onResponse(response) {
            json.statusCode = response.status;
            switch (response.status) {
                case 200 :
                    json.statusCode = 200;
                    try {
                        if (script[method]) {
                            script[method](casper, json.postData, json, timeout, function (t) {
                                json = t;
                            });
                        } else {
                            json.message = "unknown method " + method;
                        }
                    } catch (e) {
                        json.message = e.message;
                    }
                    break;
                default:
                    json.status = false;
                    json.message = "Failed to access retailer site " + url + " - "
                    + (response ? JSON.stringify(response) : "");
            }

        }, function onTimeout() {
            json.message = "Timeout opening " + url;
        }, timeout);

    } else {
        json.message = scriptFile + " not found";
    }
    casper.then(function () {
        _outputJSON(json, res);
    });
    casper.on("error", function (msg, backtrace) {
        json.message = msg;
        json.status = false;
        _outputJSON(json, res);
    });
}

function _outputJSON(data, response) {
    _output(JSON.stringify(data), response, 'application/json');
}

function _output(s, response, contentType) {
    response.writeHead(200, {
        'Content-Type': contentType || 'text/plain'
    });
    response.write(s);
    response.close();
}