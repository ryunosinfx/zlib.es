import chai from './staff/chai-importer.es.js';
import { describe, before, it } from '../../node_modules/mocha/mocha.js';
import { Zlib } from '../../src/zlib.es.js';
import { base64toArray, assertArray } from './staff/util.js';
describe('gunzip', function () {
	this.timeout(60000);

	before(function () {
		// Zlib = {
		//   Gzip: ZlibGzip.Gzip,
		//   Gunzip: ZlibGunzip.Gunzip
		// }
	});

	it('pre-compressed data', function () {
		const testData = 'H4sIAAAAAAAAA0tMTEwEAEXlmK0EAAAA';
		const plain = new Uint8Array(
			'aaaa'.split('').map(function (c) {
				return c.charCodeAt(0);
			})
		);

		const decodedData = base64toArray(testData);

		const inflator = new Zlib.Gunzip(decodedData);
		const inflated = inflator.decompress();

		chai.assert(inflated.length === plain.length);
		assertArray(inflated, plain);
	});

	it('decompress pre-compressed data with filename', function () {
		const testData = 'H4sICOzl1k8AA2hvZ2UudHh0AMtIzcnJVyjPL8pJ4QIALTsIrwwAAAA=';
		const plain = new Uint8Array(
			'hello world'
				.split('')
				.map(function (c) {
					return c.charCodeAt(0);
				})
				.concat(0x0a)
		);

		const decodedData = base64toArray(testData);
		const inflator = new Zlib.Gunzip(decodedData);
		const inflated = inflator.decompress();

		chai.assert(inflated.length === plain.length);
		assertArray(inflated, plain);
		chai.assert(inflator.getMembers()[0].getName() === 'hoge.txt');
	});
});
