import { describe, before, it } from '../../node_modules/mocha/mocha.js';
import { Zlib } from '../../src/zlib.es.js';
import { assertArray, makeRandomSequentialData, makeSequentialData, makeRandomData } from './staff/util.js';
import { compressionAndDecompressionTest } from './staff/base.js';
describe('zlib', function () {
	const size = 76543;

	this.timeout(60000);

	before(function () {
		// Zlib = ZlibOriginal;
	});

	it('uncompressed random data', function () {
		const testData = makeRandomData(size);
		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.NONE);
	});

	it('fixed random data', function () {
		const testData = makeRandomData(size);
		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.FIXED);
	});

	it('dynamic random data', function () {
		const testData = makeRandomData(size);
		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.DYNAMIC);
	});

	it('uncompressed sequential data', function () {
		const testData = makeSequentialData(size);
		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.NONE);
	});

	it('fixed sequential data', function () {
		const testData = makeSequentialData(size);
		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.FIXED);
	});

	it('dynamic sequential data', function () {
		const testData = makeSequentialData(size);
		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.DYNAMIC);
	});

	it('uncompressed random sequential data', function () {
		const testData = makeRandomSequentialData(size);
		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.NONE);
	});

	it('fixed random sequential data', function () {
		const testData = makeRandomSequentialData(size);
		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.FIXED);
	});

	it('dynamic random sequential data', function () {
		const testData = makeRandomSequentialData(size);
		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.DYNAMIC);
	});

	it('undercomitted', function () {
		const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
		const compressed = new Zlib.Deflate(data).compress();
		const decompressed = new Zlib.Inflate(compressed).decompress();

		assertArray(data, Array.prototype.slice.call(decompressed));
	});
});
