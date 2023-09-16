import chai from './staff/chai-importer.es.js';
import sinon from '../../node_modules/sinon/pkg/sinon-esm.js';
import { describe, before, beforeEach, afterEach, it } from '../../node_modules/mocha/mocha.js';
import { compressionAndDecompressionByStreamTest, compressionAndDecompressionTest } from './staff/base.js';
import { makeRandomData, makeRandomSequentialData, makeSequentialData } from './staff/util.js';
import { Zlib } from '../../src/zlib.es.js';
describe('code path', function () {
	const size = 76543;
	let none;
	let fixed;
	let dynamic;

	this.timeout(60000);

	before(function () {
		// Zlib = ZlibPretty;
	});

	beforeEach(function () {
		none = sinon.spy(Zlib.RawDeflate.prototype, 'makeNocompressBlock');
		fixed = sinon.spy(Zlib.RawDeflate.prototype, 'makeFixedHuffmanBlock');
		dynamic = sinon.spy(Zlib.RawDeflate.prototype, 'makeDynamicHuffmanBlock');
	});

	afterEach(function () {
		none.restore();
		fixed.restore();
		dynamic.restore();
	});

	it('undercomitted', function () {
		const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
		const compressed = new Zlib.Deflate(data).compress();
		const decompressed = new Zlib.Inflate(compressed).decompress();

		chai.deep(data, Array.prototype.slice.call(decompressed));
	});

	it('uncompressed random data', function () {
		const testData = makeRandomData(size);

		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.NONE);

		chai.assert(none.called === true);
		chai.assert(fixed.called === false);
		chai.assert(dynamic.called === false);
	});

	it('fixed random data', function () {
		const testData = makeRandomData(testData);

		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.FIXED);

		chai.assert(none.called === false);
		chai.assert(fixed.called === true);
		chai.assert(dynamic.called === false);
	});

	it('dynamic random data', function () {
		const testData = makeRandomData(testData);

		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.DYNAMIC);

		chai.assert(none.called === false);
		chai.assert(fixed.called === false);
		chai.assert(dynamic.called === true);
	});

	it('uncompressed sequential data', function () {
		const testData = makeSequentialData(testData);

		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.NONE);

		chai.assert(none.called === true);
		chai.assert(fixed.called === false);
		chai.assert(dynamic.called === false);
	});

	it('fixed sequential data', function () {
		const testData = makeSequentialData(testData);

		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.FIXED);

		chai.assert(none.called === false);
		chai.assert(fixed.called === true);
		chai.assert(dynamic.called === false);
	});

	it('dynamic sequential data', function () {
		const testData = makeSequentialData(testData);

		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.DYNAMIC);

		chai.assert(none.called === false);
		chai.assert(fixed.called === false);
		chai.assert(dynamic.called === true);
	});

	it('uncompressed random sequential data', function () {
		const testData = makeRandomSequentialData(testData);

		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.NONE);

		chai.assert(none.called === true);
		chai.assert(fixed.called === false);
		chai.assert(dynamic.called === false);
	});

	it('fixed random sequential data', function () {
		const testData = makeRandomSequentialData(testData);

		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.FIXED);

		chai.assert(none.called === false);
		chai.assert(fixed.called === true);
		chai.assert(dynamic.called === false);
	});

	it('dynamic random sequential data', function () {
		const testData = makeRandomSequentialData(testData);

		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.DYNAMIC);

		chai.assert(none.called === false);
		chai.assert(fixed.called === false);
		chai.assert(dynamic.called === true);
	});

	//-------------------------------------------------------------------------
	// stream
	//-------------------------------------------------------------------------
	it('uncompressed random sequential data (stream)', function () {
		const testData = makeRandomSequentialData(testData);

		compressionAndDecompressionByStreamTest(testData, Zlib.Deflate.CompressionType.NONE);

		chai.assert(none.called === true);
		chai.assert(fixed.called === false);
		chai.assert(dynamic.called === false);
	});

	it('fixed random sequential data (stream)', function () {
		const testData = makeRandomSequentialData(testData);

		compressionAndDecompressionByStreamTest(testData, Zlib.Deflate.CompressionType.FIXED);

		chai.assert(none.called === false);
		chai.assert(fixed.called === true);
		chai.assert(dynamic.called === false);
	});

	it('dynamic random sequential data (stream)', function () {
		const testData = makeRandomSequentialData(testData);

		compressionAndDecompressionByStreamTest(testData, Zlib.Deflate.CompressionType.DYNAMIC);

		chai.assert(none.called === false);
		chai.assert(fixed.called === false);
		chai.assert(dynamic.called === true);
	});
});
