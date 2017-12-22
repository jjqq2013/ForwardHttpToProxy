'use strict';
var http = require('http');

function main() {
    //convert `-key value` to cfg[key]=value
    var cfg = process.argv.slice(2/*skip ["node", "xxx.js"]*/).reduce(function (cfg, arg, i, argv) {
        return (i % 2 === 0 && (arg.slice(0, 2) === '--' && (cfg[arg.slice(2)] = argv[i + 1])), cfg);
    }, {local_host: '127.0.0.1', local_port: 0, remote_host: '', remote_port: 0});

    var local_host = cfg.local_host;
    var local_port = cfg.local_port;
    var remote_host = cfg.remote_host;
    var remote_port = cfg.remote_port;

    if (!cfg.local_host || !cfg.local_port || !cfg.remote_host || !cfg.remote_port)
        return console.error('Usage of parameters:\n'
            + '--local_host host\t' + 'Listening address(* means all interfaces). Default: 127.0.0.1\n'
            + '--local_port port\t' + 'Listening port\n'
            + '--remote_host host\t' + 'Real HTTP proxy server address\n'
            + '--remote_port port\t' + 'Real HTTP proxy server port\n'
        );
    console.log('Using parameters: ' + JSON.stringify(cfg, null, '  '));

    http.createServer(function (req, res) {

        var _req_opt = {};
        _req_opt.protocol = 'http:';
        _req_opt.host = remote_host;
        _req_opt.port = remote_port;
        _req_opt.method = req.method;
        _req_opt.path = 'http://' + req.headers['host'] + req.url;
        _req_opt.headers = req.headers;
        _req_opt.headers['proxy-connection'] = 'Keep-Alive';

        console.log(JSON.stringify(_req_opt, null, '  '));

        var _req = http.request(_req_opt, function (_res) {

            res.writeHead(_res.statusCode, _res.headers);

            _res.on('data', function (buf) {
                console.log('<<<<' + (Date.t = new Date()) + '.' + Date.t.getMilliseconds() + '\n' + buf.toString('ascii'));
                res.write(buf)
            }).on('end', function () {
                res.end();
            }).on('error', function (err) {
                console.error('[FHP][Reading response from remote] ' + err);
                res.destroy();
            });
        }).on('error', function (err) {
            console.error('[FHP][Connection to ' + remote_host + ':' + remote_port + '] ' + err);
            res.destroy();
        }).on('abort', function () {
            console.error('[FHP][Connection is aborted from client side');
            res.destroy();
        });

        req.on('data', function (buf) {
            console.log('>>>>' + (Date.t = new Date()) + '.' + Date.t.getMilliseconds() + '\n' + buf.toString('ascii'));
            _req.write(buf);
        }).on('end', function () {
            _req.end();
        }).on('error', function (err) {
            console.error('[FHP][Reading request body] ' + err);
            _req.abort();
        });

        res.on('end', function () {
            _req.abort();
        }).on('error', function (err) {
            console.error('[FHP][Writing response] ' + err);
            _req.abort();
        });
    }).on('error', function (err) {
        console.error('[FHP] ' + err);
        process.exit(1);
    }).listen(local_port, local_host, function () {
        console.log('[FHP] OK: This server is listening at http://' + local_host + ':' + local_port + ' and will convert request to proxy request and send to http://' + remote_host + ':' + remote_port);
    });
}

main();
