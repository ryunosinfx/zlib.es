import chai from './staff/chai-importer.es.js';
import { describe, before, it } from '../../node_modules/mocha/mocha.js';
import { Zlib } from '../../src/zlib.es.js';
import { assertArray, base64toArray, decompressionTest } from './staff/util.js';
describe('Zlib.Inflate', function () {
	const USE_TYPEDARRAY = window.Uint8Array !== void 0;
	const fixedData =
		'eJztzydhGAAAALDd/v////////////////////////////////9no6BxkF+///z99x8A' +
		'EAgYBBQMHAISChoGFg4eAREJGQUVDR0DEwsbBxcPn4CQiJiElIycgpKKmoaWjp6BkYmZ' +
		'hZWNnYOTi5uHl49fQFBIWERUTFxCUkpaRlZOXkFRSVlFVU1dQ1NLW0dXT9/A0MjYxNTM' +
		'3MLSytrG1s7ewdHJ2cXVzd3D08vbx9fPPyAwKDgkNCw8IjIqOiY2Lj4hMSk5JTUtPSMz' +
		'KzsnNy+/oLCouKS0rLyisqq6prauvqGxqbmlta29o7Oru6e3r39gcGh4ZHRsfGJyanpm' +
		'dm5+YXFpeWV1bX1jc2t7Z3dv/+Dw6Pjk9Oz84vLq+ub27v7h8en55fXt/ePz5//z//n/' +
		'/H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f' +
		'/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z' +
		'//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+' +
		'P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//' +
		'5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n/' +
		'/H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f' +
		'/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z' +
		'//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+' +
		'P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//' +
		'5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n/' +
		'/H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f' +
		'/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z' +
		'//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+' +
		'P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//' +
		'5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n/' +
		'/H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f' +
		'/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z//n//H/+P/+f/8//5//z' +
		'//n//H/+P/+f/8//5//z//n//H/+3+P/Ba1OJPE=';

	this.timeout(60000);

	before(function () {
		// Zlib = ZlibOriginal;
	});

	it('pre-deflated data', function () {
		const size = 123456;
		const plain = new (USE_TYPEDARRAY ? Uint8Array : Array)(size);
		const testData = fixedData;

		// make plain data
		for (let i = 0, il = size; i < il; ++i) {
			plain[i] = i & 0xff;
		}

		const decodedData = base64toArray(testData);

		// testdata size
		chai.assert(testData.length === 1604);
		chai.assert(decodedData.length === 1202);

		const inflator = new Zlib.Inflate(decodedData);
		const inflated = inflator.decompress();

		chai.assert(inflated.length === size);
		assertArray(inflated, plain);
	});

	it('pre-deflated data with inflate bufferSize option', function () {
		const size = 123456;
		const plain = new (USE_TYPEDARRAY ? Uint8Array : Array)(size);
		const testData = fixedData;

		// make plain data
		for (let i = 0, il = size; i < il; ++i) {
			plain[i] = i & 0xff;
		}

		const decodedData = base64toArray(testData);

		// testdata size
		chai.assert(testData.length === 1604);
		chai.assert(decodedData.length === 1202);

		const inflator = new Zlib.Inflate(decodedData, { bufferSize: 123456 });
		const inflated = inflator.decompress();

		chai.assert(inflated.length === size);
		chai.assert(inflated.buffer.byteLength === 123456);
		assertArray(inflated, plain);
	});

	it('pre-deflated data with inflate bufferType option', function () {
		const size = 123456;
		const plain = new (USE_TYPEDARRAY ? Uint8Array : Array)(size);
		const testData = fixedData;

		// make plain data
		for (let i = 0, il = size; i < il; ++i) {
			plain[i] = i & 0xff;
		}

		const decodedData = base64toArray(testData);

		// testdata size
		chai.assert(testData.length === 1604);
		chai.assert(decodedData.length === 1202);

		const inflator = new Zlib.Inflate(decodedData, {
			bufferType: Zlib.Inflate.BufferType.BLOCK,
			bufferSize: 41152,
			verify: true,
		});
		const inflated = inflator.decompress();

		chai.assert(inflated.length === size);
		chai.assert(inflated.buffer.byteLength === 123456);
		assertArray(inflated, plain);
	});

	it('pre-deflated data with inflate resize option', function () {
		const size = 123456;
		const plain = new (USE_TYPEDARRAY ? Uint8Array : Array)(size);
		const testData = fixedData;

		// make plain data
		for (let i = 0, il = size; i < il; ++i) {
			plain[i] = i & 0xff;
		}

		const decodedData = base64toArray(testData);

		// testdata size
		chai.assert(testData.length === 1604);
		chai.assert(decodedData.length === 1202);

		const inflator = new Zlib.Inflate(decodedData, {
			bufferType: Zlib.Inflate.BufferType.BLOCK,
			bufferSize: 41153,
			resize: true,
		});
		const inflated = inflator.decompress();

		chai.assert(inflated.length === size);
		chai.assert(inflated.buffer.byteLength === 123456);
		assertArray(inflated, plain);
	});

	it('issue#35 wrong inflate 1', function () {
		const compressed = base64toArray(
			'eJx9jq0NQCEMhG8YJMOwAgJdhWYA9kAyAIuQoBmkvNQ80Z+kP/l6uRy8urIysOVoprTaLlOlcXyzvE7qP3jBuo4XCDg/QAyZCQjI'
		);
		const plain = [
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 228, 0, 0, 0, 0, 0,
			0, 97, 0, 0, 215, 0, 0, 0, 0, 0, 97, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 117, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 174, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 44, 166, 0, 0, 0, 0, 101, 0, 0, 0, 80, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 36, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 139, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 186, 0, 111,
			0, 0, 218, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 111,
		];

		decompressionTest(compressed, plain);
	});

	it('issue#35 wrong inflate 2', function () {
		const compressed = base64toArray(
			'eJxtjD0NgEAMhd8IBlDAigNMsDCxsSIIAyScikvOzAk4A02Tdujf8r2/FPl1Fctk8jufDzSGbGdJ17A7fbAZd6iowMMswM78tLjCy9+417UEYNsIeA=='
		);
		const plain = [
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 231, 0, 0, 0, 0, 0, 0, 0, 0, 22, 8, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 99, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			243, 0, 194, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 36, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 86, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 45, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 81, 0, 0, 0, 0, 0, 0, 0, 0, 191, 0, 0, 108, 0, 0, 0, 0, 169, 0, 0, 60, 0, 0, 0, 0, 165, 0, 0, 0, 0, 0,
			0, 0, 0, 92, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 168, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			152, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		];

		decompressionTest(compressed, plain);
	});

	it('issue#35 take a long time and throw exception', function () {
		const compressed = base64toArray(
			'eJx1jb8NQFAQxj+J2MAASo1EJGIEM1hAhV6iVEg0GgvozGEHG+jscDm5Q/L+FL/3+y73vjfAfVbciDXkqFR9lKretz3XWHbxxl44RSKb+9PWmFw/7+U+MvNlgtTa2D0s3jwyAsYZMgl65Qwx'
		);
		const plain = [
			125, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 150, 0, 237, 0, 41, 0,
			0, 0, 0, 0, 0, 0, 0, 54, 0, 90, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 72, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 140, 103, 0, 145, 170, 0, 0, 0, 0, 0, 0, 0, 109, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 137, 33, 0, 0, 0, 0, 0, 0, 0, 163, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 0, 0, 0, 0, 0, 110, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 230, 0, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 0, 122, 0, 0, 0, 0, 0, 0, 0, 196, 51, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 46, 0,
			49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 111, 0, 0, 0, 0, 0, 56, 0, 0, 0, 0, 0, 0,
			0, 0, 0, 133, 0, 0, 0, 0, 6, 0, 0, 0, 0, 215, 21, 0, 0, 0, 0,
		];

		decompressionTest(compressed, plain);
	});
});
