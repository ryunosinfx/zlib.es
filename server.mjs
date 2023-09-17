import fs from 'fs';
import http from 'http';
const exts = {
	js: 'text/javascript',
	css: 'text/css',
	html: 'text/html',
};
const PORT = 8088;

// サーバーのイベントハンドラを定義
http.createServer(function (req, res) {
	const url = req.url.replace('../', '/');
	const urls = url.split('.');
	const ext = urls[urls.length - 1];
	console.log(`req url:${url}`);
	const contentType = exts[ext] ? exts[ext] : 'text/plain';
	try {
		res.writeHead(200, {
			'Content-Type': contentType,
		});
		const file = fs.readFileSync(`.${url}`);
		const responseMessage = file;
		res.end(responseMessage);
	} catch (e) {
		res.writeHead(404, {
			'Content-Type': contentType,
		});
		console.log(`req e:${e}`);
		res.end('NOT FOUND');
	}
}).listen(PORT, '127.0.0.1');
