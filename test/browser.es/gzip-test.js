import chai from './staff/chai-importer.es.js';
import { describe, before, it } from '../../node_modules/mocha/mocha.js';
import { Zlib } from '../../src/zlib.es.js';
import { assertArray, makeRandomSequentialData } from './staff/util.js';
describe('gzip', function () {
	const size = 76543;
	const USE_TYPEDARRAY = window.Uint8Array !== void 0;

	this.timeout(60000);

	before(function () {
		// Zlib = {
		// 	Gzip: Zlib.Gzip,
		// 	Gunzip: Zlib.Gunzip,
		// };
	});

	it('random sequential data', function () {
		const testData = makeRandomSequentialData(size);

		const deflator = new Zlib.Gzip(testData);
		const deflated = deflator.compress();

		const inflator = new Zlib.Gunzip(deflated);
		const inflated = inflator.decompress();

		chai.assert(inflated.length === testData.length);
		assertArray(inflated, testData);
	});

	it('compress with filename', function () {
		const testData = makeRandomSequentialData(size);
		const deflator = new Zlib.Gzip(testData, {
			flags: {
				fname: true,
				fcommenct: false,
				fhcrc: false,
			},
			filename: 'foobar.filename',
		});
		const deflated = deflator.compress();

		const inflator = new Zlib.Gunzip(deflated);
		const inflated = inflator.decompress();

		chai.assert(inflated.length === testData.length);
		assertArray(inflated, testData);
		chai.assert(inflator.getMembers()[0].getName() === 'foobar.filename');
	});

	it('compress with filename (seed: 1346432776267)', function () {
		const testData = makeRandomSequentialData(size, USE_TYPEDARRAY, 1346432776267);
		const deflator = new Zlib.Gzip(testData, {
			flags: {
				fname: true,
				fcommenct: false,
				fhcrc: false,
			},
			filename: 'foobar.filename',
		});
		const deflated = deflator.compress();

		const inflator = new Zlib.Gunzip(deflated);
		const inflated = inflator.decompress();

		chai.assert(inflated.length === testData.length);
		assertArray(inflated, testData);
		chai.assert(inflator.getMembers()[0].getName() === 'foobar.filename');
	});
});
