import chai from './staff/chai-importer.es.js';
// import { describe, before, it } from './staff/mocha-importer.es.js';
import { Zlib } from '../../src/zlib.es.js';
import { base64toArray, assertArray } from './staff/util.js';
// eslint-disable-next-line no-undef
describe('gunzip', function () {
	this.timeout(60000);

	before(function () {
		// Zlib = {
		//   Gzip: ZlibGzip.Gzip,
		//   Gunzip: ZlibGunzip.Gunzip
		// }
	});

	it('pre-compressed data', function (done) {
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
		assertArray(inflated, plain, 'pre-compressed data');
		done();
	});

	it('decompress pre-compressed data with filename', function (done) {
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
		assertArray(inflated, plain, 'decompress pre-compressed data with filename');
		chai.assert(inflator.getMembers()[0].getName() === 'hoge.txt');
		done();
	});
});
