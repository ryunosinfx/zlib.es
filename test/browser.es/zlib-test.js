import { Zlib } from '../../src/zlib.es.js';
import { assertArray, makeRandomSequentialData, makeSequentialData, makeRandomData } from './staff/util.js';
import { compressionAndDecompressionTest } from './staff/base.js';
describe('zlib', function () {
	const size = 76543;

	this.timeout(60000);

	before(function () {
		// Zlib = ZlibOriginal;
	});

	it('uncompressed random data', function (done) {
		const testData = makeRandomData(size);
		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.NONE, 'uncompressed random data');
		done();
	});

	it('fixed random data', function (done) {
		const testData = makeRandomData(size);
		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.FIXED, 'fixed random data');
		done();
	});

	it('dynamic random data', function (done) {
		const testData = makeRandomData(size);
		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.DYNAMIC, 'dynamic random data');
		done();
	});

	it('uncompressed sequential data', function (done) {
		const testData = makeSequentialData(size);
		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.NONE, 'uncompressed sequential data');
		done();
	});

	it('fixed sequential data', function (done) {
		const testData = makeSequentialData(size);
		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.FIXED, 'fixed sequential data');
		done();
	});

	it('dynamic sequential data', function (done) {
		const testData = makeSequentialData(size);
		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.DYNAMIC, 'dynamic sequential data');
		done();
	});

	it('uncompressed random sequential data', function (done) {
		const testData = makeRandomSequentialData(size);
		compressionAndDecompressionTest(
			testData,
			Zlib.Deflate.CompressionType.NONE,
			'uncompressed random sequential data'
		);
		done();
	});

	it('fixed random sequential data', function (done) {
		const testData = makeRandomSequentialData(size);
		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.FIXED, 'fixed random sequential data');
		done();
	});

	it('dynamic random sequential data', function (done) {
		const testData = makeRandomSequentialData(size);
		compressionAndDecompressionTest(
			testData,
			Zlib.Deflate.CompressionType.DYNAMIC,
			'dynamic random sequential data'
		);
		done();
	});

	it('undercomitted', function (done) {
		const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
		const compressed = new Zlib.Deflate(data).compress();
		const decompressed = new Zlib.Inflate(compressed).decompress();

		assertArray(data, Array.prototype.slice.call(decompressed), 'undercomitted ');
		done();
	});
});
