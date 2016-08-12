var express = require('express'),
    net = require('net'),
    tls = require('tls'), // https://nodejs.org/api/tls.html#tls_tls_ssl
    url = require('url');

var colors = require('colors');

var getConfig = require('./config');
var decorates = require('./decorate');
var responders = require('./responder');

var _Modules = {};
function _ModuleRequire(namespace, module) {
    _Modules[namespace] = _Modules[namespace] || {};
    return _Modules[namespace][module] = require('./' + namespace + '/' + module);
}

var notify = _ModuleRequire('connect', 'notify');

var getCertByHostname = require('./config/keys/certHelper').getCertByHostname;

var uiApp;
function runUiApp() {
    uiApp = require('./webui/spiceapp');
}
runUiApp();

var app = new express();
var config = global.config = getConfig

var isHttpsSupported = config.isHttpsSupported;
var _port = 4000;

// load middleware
app.use(decorates);
app.use(responders);

app.listen(config.proxyPort).on('connect', connectTunnel);

function connectTunnel(cReq, cSock) {
    if (!isHttpsSupported) {
        var u = url.parse('http://' + cReq.url);
        var pSock = net.connect(u.port, u.hostname, function () {
            cSock.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            pSock.pipe(cSock);
        }).on('error', function (e) {
            cSock.end();
        });

        cSock.pipe(pSock);
        return;
    }

    function destroy(socket) {
        socket && socket.destroy();
    }

    function abortIfUnavailable(socket) {
        return socket.on('error', destroy.bind(this, socket)).on('close', destroy.bind(this, socket));
    }

    var hostname = cReq.headers.host.split(":")[0];
    var cert = getCertByHostname(hostname);
    tls.createServer(cert, function (tlsSocket) {
        tlsSocket.on('data', function (data) {
            // console.log('-------------  tlsSocket ------------')
            // console.log(data.toString())
        });
        var socketToProxy = net.connect(config.proxyPort, config.localhost, function () {
            tlsSocket.pipe(socketToProxy).pipe(tlsSocket);
        }).on('error', function (e) {
            tlsSocket.end();
        });
    }).listen(_port);

    // cSock.on('data', function(data){
    //     console.log('-------------  cSock11 ------------')
    //     // 拿到加密后的请求头
    //     console.log(data)
    // });

    // cSock.on('end', function(data){
    //     console.log('-------------  cSock22 ------------')
    //     // 拿到加密后的请求头
    //     console.log(data)
    // });

    var socketToTls = net.connect(_port, config.localhost, function () {
        cSock.write('HTTP/1.1 200 Connection Established\r\nProxy-Agent: ' + config.name + '\r\n\r\n');
        cSock.pipe(socketToTls).pipe(cSock);
    }).on('error', function (e) {
        cSock.end();
    });

    // var socketToTls = net.connect(_port, config.localhost, function() {
    //     cSock.write('HTTP/1.1 200 Connection Established\r\nProxy-Agent: ' + config.name + '\r\n\r\n');
    //     cSock.pipe(socketToTls).pipe(cSock);
    // }).on('error', function(e) {
    //     cSock.end();
    // });
    _port++;
    abortIfUnavailable(cSock);
}
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

var msg = [
    ' #####  #####   ####  #    # #   #',
    ' #    # #    # #    #  #  #   # # ',
    ' #    # #    # #    #   ##     #  ',
    ' #####  #####  #    #   ##     #  ',
    ' #      #   #  #    #  #  #    #  ',
    ' #      #    #  ####  #    #   #  '
].join("\n").cyan;

console.log(msg);
console.log('http proxy server'.cyan + ' started '.green.bold + 'on port '.cyan + (getConfig.proxyPort + '').yellow);