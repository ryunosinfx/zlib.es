import chai from './staff/chai-importer.es.js';
import sinon from '../../node_modules/sinon/pkg/sinon-esm.js';
import { compressionAndDecompressionByStreamTest, compressionAndDecompressionTest } from './staff/base.js';
import { makeRandomData, makeRandomSequentialData, makeSequentialData, assertArray } from './staff/util.js';
// import { Zlib } from '../../../src/zlib.es.js';
// import { Zlib } from '../../../src/zlib.es.min.js';
import { Zlib } from '../../../bin/zlib.es.min.js';
// eslint-disable-next-line no-undef
describe('code path', function () {
	const size = 76543;
	let none;
	let fixed;
	let dynamic;
	let testData = null;
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

	it('undercomitted', function (done) {
		const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
		const compressed = new Zlib.Deflate(data).compress();
		const decompressed = new Zlib.Inflate(compressed).decompress();
		assertArray(data, Array.prototype.slice.call(decompressed), 'undercomitted');
		done(); // ここでテストが終了する
	});

	it('uncompressed random data', function (done) {
		testData = makeRandomData(size);

		compressionAndDecompressionTest(
			testData,
			Zlib.Deflate.CompressionType.UNCOMPRESSED,
			'uncompressed random data'
		);

		chai.assert(none.called === true);
		chai.assert(fixed.called === false);
		chai.assert(dynamic.called === false);
		done(); // ここでテストが終了する
	});

	it('fixed random data', function (done) {
		testData = makeRandomData(testData);

		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.FIXED, 'fixed random data');

		chai.assert(none.called === false);
		chai.assert(fixed.called === true);
		chai.assert(dynamic.called === false);
		done(); // ここでテストが終了する
	});

	it('dynamic random data', function (done) {
		testData = makeRandomData(testData);

		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.DYNAMIC, 'dynamic random data');

		chai.assert(none.called === false);
		chai.assert(fixed.called === false);
		chai.assert(dynamic.called === true);
		done(); // ここでテストが終了する
	});

	it('uncompressed sequential data', function (done) {
		testData = makeSequentialData(testData);

		compressionAndDecompressionTest(
			testData,
			Zlib.Deflate.CompressionType.UNCOMPRESSED,
			'uncompressed sequential data'
		);

		chai.assert(none.called === true);
		chai.assert(fixed.called === false);
		chai.assert(dynamic.called === false);
		done(); // ここでテストが終了する
	});

	it('fixed sequential data', function (done) {
		testData = makeSequentialData(testData);

		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.FIXED, 'fixed sequential data');

		chai.assert(none.called === false);
		chai.assert(fixed.called === true);
		chai.assert(dynamic.called === false);
		done(); // ここでテストが終了する
	});

	it('dynamic sequential data', function (done) {
		testData = makeSequentialData(testData);

		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.DYNAMIC, 'dynamic sequential data');

		chai.assert(none.called === false);
		chai.assert(fixed.called === false);
		chai.assert(dynamic.called === true);
		done(); // ここでテストが終了する
	});

	it('uncompressed random sequential data', function (done) {
		testData = makeRandomSequentialData(testData);

		compressionAndDecompressionTest(
			testData,
			Zlib.Deflate.CompressionType.UNCOMPRESSED,
			'uncompressed random sequential data'
		);

		chai.assert(none.called === true);
		chai.assert(fixed.called === false);
		chai.assert(dynamic.called === false);
		done(); // ここでテストが終了する
	});

	it('fixed random sequential data', function (done) {
		testData = makeRandomSequentialData(testData);

		compressionAndDecompressionTest(testData, Zlib.Deflate.CompressionType.FIXED, 'fixed random sequential data');

		chai.assert(none.called === false);
		chai.assert(fixed.called === true);
		chai.assert(dynamic.called === false);
		done(); // ここでテストが終了する
	});

	it('dynamic random sequential data', function (done) {
		testData = makeRandomSequentialData(testData);

		compressionAndDecompressionTest(
			testData,
			Zlib.Deflate.CompressionType.DYNAMIC,
			'dynamic random sequential data'
		);

		chai.assert(none.called === false);
		chai.assert(fixed.called === false);
		chai.assert(dynamic.called === true);
		done(); // ここでテストが終了する
	});

	//-------------------------------------------------------------------------
	// stream
	//-------------------------------------------------------------------------
	it('uncompressed random sequential data (stream)', function (done) {
		testData = makeRandomSequentialData(testData);

		compressionAndDecompressionByStreamTest(
			testData,
			Zlib.Deflate.CompressionType.UNCOMPRESSED,
			'uncompressed random sequential data (stream)'
		);

		chai.assert(none.called === true);
		chai.assert(fixed.called === false);
		chai.assert(dynamic.called === false);
		done(); // ここでテストが終了する
	});

	it('fixed random sequential data (stream)', function (done) {
		testData = makeRandomSequentialData(testData);

		compressionAndDecompressionByStreamTest(
			testData,
			Zlib.Deflate.CompressionType.FIXED,
			'fixed random sequential data (stream)'
		);

		chai.assert(none.called === false);
		chai.assert(fixed.called === true);
		chai.assert(dynamic.called === false);
		done(); // ここでテストが終了する
	});

	it('dynamic random sequential data (stream)', function (done) {
		testData = makeRandomSequentialData(testData);

		compressionAndDecompressionByStreamTest(
			testData,
			Zlib.Deflate.CompressionType.DYNAMIC,
			'dynamic random sequential data (stream)'
		);

		chai.assert(none.called === false);
		chai.assert(fixed.called === false);
		chai.assert(dynamic.called === true);
		done(); // ここでテストが終了する
	});
});
