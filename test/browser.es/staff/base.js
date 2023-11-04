import chai from './chai-importer.es.js';
import { Zlib } from '../../../src/zlib.es.js';
// import { Zlib } from '../../../src/zlib.es.min.js';
// import { Zlib } from '../../../bin/zlib.es.min.js';
import { assertArray } from './util.js';
import * as z from '../../../bin/zlib.pretty.dev.js';
// inflate test
export function compressionAndDecompressionTest(testData, compressionType, msg = '') {
	const Z = window.Zlib;
	const deflate2 = new Z.Deflate(testData, {
		compressionType: compressionType,
	}).compress();
	// deflate
	const deflate = new Zlib.Deflate(testData, {
		compressionType: compressionType,
	}).compress();

	// inflate
	const inflate2 = new Z.Inflate(deflate, {
		verify: true,
	}).decompress();
	const inflate = new Zlib.Inflate(deflate, {
		verify: true,
	}).decompress();

	// assertion
	chai.assert(inflate.length, testData.length);
	assertArray(inflate, testData, 'compressionAndDecompressionTest ' + msg);
}

// inflate test
export function compressionAndDecompressionByStreamTest(testData, compressionType, msg = '') {
	// deflate
	const deflate = new Zlib.Deflate(testData, {
		compressionType: compressionType,
	}).compress();

	// inflate
	const inflator = new Zlib.InflateStream();
	let inflate = new Uint8Array();
	for (let i = 0, il = deflate.length; i < il; ++i) {
		const buf = inflator.decompress(deflate.subarray(i, i + 1));
		const tmp = new Uint8Array(buf.length + inflate.length);
		tmp.set(inflate, 0);
		tmp.set(buf, inflate.length);
		inflate = tmp;
	}

	// assertion
	chai.assert(inflate.length === testData.length);
	assertArray(inflate, testData, 'compressionAndDecompressionByStreamTest ' + msg);
}

export function decompressionTest(compressed, plain, msg = '') {
	const inflated = new Zlib.Inflate(compressed).decompress();

	chai.assert(inflated.length === plain.length);
	assertArray(inflated, plain, 'decompressionTest ' + msg);
}
