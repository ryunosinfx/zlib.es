// import { describe, before, it } from './staff/mocha-importer.es.js';
import { Zlib } from '../../../src/zlib.es.js';
// import { Zlib } from '../../../src/zlib.es.min.js';
// import { Zlib } from '../../../bin/zlib.es.min.js';
import { assertArray, stringToByteArray, base64toArray } from './staff/util.js';
describe('unzip', function () {
	this.timeout(60000);

	before(function () {
		// Zlib = ZlibUnzip;
	});

	it('decompression files', function (done) {
		const Z = window.Zlib;
		const testData =
			'UEsDBAoAAAAAALZDSEKdh+K5BQAAAAUAAAAIABwAaG9nZS50eHRVVAkAA+g4FFHoOBR' +
			'RdXgLAAEE9gEAAAQUAAAAaG9nZQpQSwMECgAAAAAAukNIQgNLGl0FAAAABQAAAAgAHA' +
			'BmdWdhLnR4dFVUCQAD7zgUUe84FFF1eAsAAQT2AQAABBQAAABmdWdhClBLAwQKAAAAA' +
			'ADCQ0hC8mJOIAUAAAAFAAAACAAcAHBpeW8udHh0VVQJAAP7OBRR+zgUUXV4CwABBPYB' +
			'AAAEFAAAAHBpeW8KUEsBAh4DCgAAAAAAtkNIQp2H4rkFAAAABQAAAAgAGAAAAAAAAQA' +
			'AAKSBAAAAAGhvZ2UudHh0VVQFAAPoOBRRdXgLAAEE9gEAAAQUAAAAUEsBAh4DCgAAAA' +
			'AAukNIQgNLGl0FAAAABQAAAAgAGAAAAAAAAQAAAKSBRwAAAGZ1Z2EudHh0VVQFAAPvO' +
			'BRRdXgLAAEE9gEAAAQUAAAAUEsBAh4DCgAAAAAAwkNIQvJiTiAFAAAABQAAAAgAGAAA' +
			'AAAAAQAAAKSBjgAAAHBpeW8udHh0VVQFAAP7OBRRdXgLAAEE9gEAAAQUAAAAUEsFBgA' +
			'AAAADAAMA6gAAANUAAAAAAA==';
		const decodedData = base64toArray(testData);
		const unzip = new Zlib.Unzip(decodedData, {
			verify: true,
		});
		const files = {};
		const filenames = unzip.getFilenames();

		for (let i = 0, il = filenames.length; i < il; ++i) {
			files[filenames[i]] = unzip.decompress(filenames[i]);
		}

		assertArray(files['hoge.txt'], new Uint8Array(stringToByteArray('hoge\x0a')), 'decompression files hoge');
		assertArray(files['fuga.txt'], new Uint8Array(stringToByteArray('fuga\x0a')), 'decompression files fuga');
		assertArray(files['piyo.txt'], new Uint8Array(stringToByteArray('piyo\x0a')), 'decompression files piyo');
		done();
	});

	it('decompression files (encrypted)', function (done) {
		const testData =
			'UEsDBAoACwAAALZDSEKdh+K5EQAAAAUAAAAIABwAaG9nZS50eHRVVAkAA+g4FFFLkE' +
			'FRdXgLAAEE9gEAAAQUAAAAmLCXJJ8ekVoXli8htr9XeT1QSwcInYfiuREAAAAFAAAA' +
			'UEsDBAoACwAAALpDSEIDSxpdEQAAAAUAAAAIABwAZnVnYS50eHRVVAkAA+84FFFLkE' +
			'FRdXgLAAEE9gEAAAQUAAAA70GVr9WG+kUsWOZjPLDJl3tQSwcIA0saXREAAAAFAAAA' +
			'UEsDBAoACwAAAMJDSELyYk4gEQAAAAUAAAAIABwAcGl5by50eHRVVAkAA/s4FFFLkE' +
			'FRdXgLAAEE9gEAAAQUAAAAwYLuQ1RwgIqnjpzimP0odIJQSwcI8mJOIBEAAAAFAAAA' +
			'UEsBAh4DCgALAAAAtkNIQp2H4rkRAAAABQAAAAgAGAAAAAAAAQAAAKSBAAAAAGhvZ2' +
			'UudHh0VVQFAAPoOBRRdXgLAAEE9gEAAAQUAAAAUEsBAh4DCgALAAAAukNIQgNLGl0R' +
			'AAAABQAAAAgAGAAAAAAAAQAAAKSBYwAAAGZ1Z2EudHh0VVQFAAPvOBRRdXgLAAEE9g' +
			'EAAAQUAAAAUEsBAh4DCgALAAAAwkNIQvJiTiARAAAABQAAAAgAGAAAAAAAAQAAAKSB' +
			'xgAAAHBpeW8udHh0VVQFAAP7OBRRdXgLAAEE9gEAAAQUAAAAUEsFBgAAAAADAAMA6g' +
			'AAACkBAAAAAA==';
		const decodedData = base64toArray(testData);
		const unzip = new Zlib.Unzip(decodedData, {
			password: 'hogefugapiyo'.split('').map(function (s) {
				return s.charCodeAt(0);
			}),
			verify: true,
		});
		const files = {};
		const filenames = unzip.getFilenames();

		for (let i = 0, il = filenames.length; i < il; ++i) {
			files[filenames[i]] = unzip.decompress(filenames[i]);
		}

		assertArray(
			files['hoge.txt'],
			new Uint8Array(stringToByteArray('hoge\x0a')),
			'decompression files (encrypted) hoge'
		);
		assertArray(
			files['fuga.txt'],
			new Uint8Array(stringToByteArray('fuga\x0a')),
			'decompression files (encrypted) fuga'
		);
		assertArray(
			files['piyo.txt'],
			new Uint8Array(stringToByteArray('piyo\x0a')),
			'decompression files (encrypted) piyo'
		);
		done();
	});
});
