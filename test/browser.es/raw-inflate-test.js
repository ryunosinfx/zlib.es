import chai from './staff/chai-importer.es.js';
import { describe, before, it, beforeEach } from '../../node_modules/mocha/mocha.js';
import { Zlib } from '../../src/zlib.es.js';
import { assertArray, makeRandomData, makeRandomSequentialData, makeSequentialData } from './staff/util.js';
//define(['base', 'rawinflate', 'util'], function() {
describe('raw-inflate', function () {
	const USE_TYPEDARRAY = window.Uint8Array !== void 0;
	const size = 76543;
	let testData;

	this.timeout(60000);

	before(function () {
		// Zlib = {
		//   RawInflate: ZlibRawInflate.RawInflate,
		//   RawDeflate: ZlibRawDeflate.RawDeflate
		// };
	});

	beforeEach(function () {
		testData = new (USE_TYPEDARRAY ? Uint8Array : Array)(size);
	});

	it('uncompressed random data', function () {
		makeRandomData(testData);
		rawInflateTest(testData, Zlib.RawDeflate.CompressionType.NONE);
	});

	it('fixed random data', function () {
		makeRandomData(testData);
		rawInflateTest(testData, Zlib.RawDeflate.CompressionType.FIXED);
	});

	it('dynamic random data', function () {
		makeRandomData(testData);
		rawInflateTest(testData, Zlib.RawDeflate.CompressionType.DYNAMIC);
	});

	it('uncompressed sequential data', function () {
		makeSequentialData(testData);
		rawInflateTest(testData, Zlib.RawDeflate.CompressionType.NONE);
	});

	it('fixed sequential data', function () {
		makeSequentialData(testData);
		rawInflateTest(testData, Zlib.RawDeflate.CompressionType.FIXED);
	});

	it('dynamic sequential data', function () {
		makeSequentialData(testData);
		rawInflateTest(testData, Zlib.RawDeflate.CompressionType.DYNAMIC);
	});

	it('uncompressed random sequential data', function () {
		makeRandomSequentialData(testData);
		rawInflateTest(testData, Zlib.RawDeflate.CompressionType.NONE);
	});

	it('fixed random sequential data', function () {
		makeRandomSequentialData(testData);
		rawInflateTest(testData, Zlib.RawDeflate.CompressionType.FIXED);
	});

	it('dynamic random sequential data', function () {
		makeRandomSequentialData(testData);
		rawInflateTest(testData, Zlib.RawDeflate.CompressionType.DYNAMIC);
	});

	it('undercomitted', function () {
		const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
		const compressed = new Zlib.RawDeflate(data).compress();
		const decompressed = new Zlib.RawInflate(compressed).decompress();

		assertArray(data, Array.prototype.slice.call(decompressed));
	});
});
//});

// inflate test
function rawInflateTest(testData, compressionType, inflateOption) {
	// deflate
	const deflate = new Zlib.RawDeflate(testData, {
		compressionType: compressionType,
	}).compress();

	// inflate
	if (inflateOption) {
		inflateOption.verify = true;
	} else {
		inflateOption = { verify: true };
	}
	const inflate = new Zlib.RawInflate(deflate, inflateOption).decompress();

	// assertion
	chai.assert(inflate.length === testData.length);
	assertArray(inflate, testData);
}
