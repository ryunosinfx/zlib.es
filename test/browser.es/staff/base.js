import chai from './chai-importer.es.js';
import { Zlib } from '../../../src/zlib.es.js';
// inflate test
export function compressionAndDecompressionTest(testData, compressionType) {
	// deflate
	const deflate = new Zlib.Deflate(testData, {
		compressionType: compressionType,
	}).compress();

	// inflate
	const inflate = new Zlib.Inflate(deflate, {
		verify: true,
	}).decompress();

	// assertion
	chai.assert(inflate.length, testData.length);
	chai.assert.deepEqual(inflate, testData);
}

// inflate test
export function compressionAndDecompressionByStreamTest(testData, compressionType) {
	// deflate
	const deflate = new Zlib.Deflate.compress(testData, {
		compressionType: compressionType,
	});

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
	chai.assert.deepEqual(inflate, testData);
}

export function decompressionTest(compressed, plain) {
	const inflated = new Zlib.Inflate(compressed).decompress();

	chai.assert(inflated.length === plain.length);
	chai.assert.deepEqual(inflated, plain);
}
