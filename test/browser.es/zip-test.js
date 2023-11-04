import { Zlib } from '../../../src/zlib.es.js';
// import { Zlib } from '../../../src/zlib.es.min.js';
// import { Zlib } from '../../../bin/zlib.es.min.js';
import { assertArray, makeRandomSequentialData, stringToByteArray } from './staff/util.js';
describe('zip', function () {
	const size = 76543;

	this.timeout(60000);

	before(function () {
		// Zlib = {
		//   Unzip: ZlibUnzip.Unzip,
		//   Zip: ZlibZip.Zip
		// }
	});

	it('compress (store)', function (done) {
		const td = makeRandomSequentialData(size);

		const testData = {
			hogehoge: td,
			fugafuga: td,
			piyopiyo: td,
		};

		const zip = new Zlib.Zip();
		for (const key in testData) {
			zip.addFile(testData[key], {
				filename: stringToByteArray(key),
				compressionMethod: Zlib.Zip.CompressionMethod.STORE,
			});
		}
		const zipped = zip.compress();

		const unzip = new Zlib.Unzip(zipped, {
			verify: true,
		});
		const files = {};
		const filenames = unzip.getFilenames();

		for (const filename of filenames) {
			files[filename] = unzip.decompress(filename);
		}
		for (const key in testData) {
			assertArray(files[key], testData[key], 'compress (store) key:' + key);
		}
		done();
	});

	it('compress (deflate)', function (done) {
		const td = makeRandomSequentialData(size);

		const testData = {
			hogehoge: td,
			fugafuga: td,
			piyopiyo: td,
		};

		const zip = new Zlib.Zip();
		for (const key in testData) {
			zip.addFile(testData[key], {
				filename: stringToByteArray(key),
				compressionMethod: Zlib.Zip.CompressionMethod.DEFLATE,
			});
		}
		const zipped = zip.compress();

		const unzip = new Zlib.Unzip(zipped, {
			verify: true,
		});
		const files = {};
		const filenames = unzip.getFilenames();

		for (const filename of filenames) {
			files[filename] = unzip.decompress(filename);
		}
		for (const key in testData) {
			assertArray(files[key], testData[key], 'compress (deflate) key:' + key);
		}
		done();
	});

	it('compress with password (deflate)', function (done) {
		const td = makeRandomSequentialData(size);

		const testData = {
			hogehoge: td,
			fugafuga: td,
			piyopiyo: td,
		};

		const zip = new Zlib.Zip();
		zip.setPassword([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
		for (const key in testData) {
			zip.addFile(testData[key], {
				filename: stringToByteArray(key),
				compressionMethod: Zlib.Zip.CompressionMethod.DEFLATE,
			});
		}
		const zipped = zip.compress();

		const unzip = new Zlib.Unzip(zipped, {
			password: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
			verify: true,
		});
		const files = {};
		const filenames = unzip.getFilenames();

		for (const filename of filenames) {
			files[filename] = unzip.decompress(filename);
		}
		for (const key in testData) {
			assertArray(files[key], testData[key], 'compress with password (deflate) key:' + key);
		}
		done();
	});

	it('compress with password (each file)', function (done) {
		const td = makeRandomSequentialData(size);

		const testData = {
			hogehoge: [td, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
			fugafuga: [td, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]],
			piyopiyo: [td, [1, 3, 5, 7, 9, 11, 13, 15, 17, 19]],
		};

		const zip = new Zlib.Zip();
		for (const key in testData) {
			zip.addFile(testData[key][0], {
				filename: stringToByteArray(key),
				compressionMethod: Zlib.Zip.CompressionMethod.DEFLATE,
				password: testData[key][1],
			});
		}
		const zipped = zip.compress();

		const unzip = new Zlib.Unzip(zipped, {
			verify: true,
		});
		const files = {};
		const filenames = unzip.getFilenames();

		for (const filename of filenames) {
			files[filename] = unzip.decompress(filename, {
				password: testData[filename][1],
			});
		}
		for (const key in testData) {
			assertArray(files[key], testData[key][0], 'compress with password (each file) key:' + key);
		}
		done();
	});
});
