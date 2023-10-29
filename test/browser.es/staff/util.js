import chai from './chai-importer.es.js';
import { MersenneTwister } from '../../../vendor/mt.js/mt.es.js';
//-----------------------------------------------------------------------------
// base64 decoder
// see http://sourceforge.net/projects/libb64/
//-----------------------------------------------------------------------------
export const base64toArray = function (str) {
	const table = [
		62, -1, -1, -1, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -2, -1, -1, -1, 0, 1, 2, 3, 4, 5, 6, 7,
		8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, -1, -1, -1, -1, -1, -1, 26, 27, 28, 29,
		30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
	];
	const table_length = table.length;
	const decoded = new Array((((table_length + 2) / 3) | 0) * 4);
	let c = 0;
	let n = 0;
	let op = 0;

	for (let i = 0, il = str.length; i < il; ++i) {
		const v = (str.charCodeAt(i) & 0xff) - 43;
		if (v < 0 || v >= table_length) {
			continue;
		}
		const fragment = table[v];
		if (fragment < 0) {
			continue;
		}
		switch (n) {
			case 0:
				c = (fragment & 0x03f) << 2;
				++n;
				break;
			case 1:
				c |= (fragment & 0x030) >> 4;
				decoded[op++] = c;
				c = (fragment & 0x00f) << 4;
				++n;
				break;
			case 2:
				c |= (fragment & 0x03c) >> 2;
				decoded[op++] = c;
				c = (fragment & 0x003) << 6;
				++n;
				break;
			case 3:
				c |= fragment & 0x03f;
				decoded[op++] = c;
				n = 0;
		}
	}
	decoded.length = op;

	return decoded;
};

//-----------------------------------------------------------------------------
// array assertion
//-----------------------------------------------------------------------------
export const assertArray = function (expected, actuals, msg = '') {
	console.log('assertArray ' + msg + ' expected:%o,actuals:%o', expected, actuals);
	if (expected.length !== actuals.length)
		console.warn('assertArray expected.length === actuals.length', msg, expected.length, actuals.length);
	chai.assert.isTrue(expected.length === actuals.length);

	for (let i = 0, il = expected.length; i < il; ++i) {
		if (expected[i] !== actuals[i])
			console.warn('assertArray expected[i] === actuals[i]', msg, i, expected[i], actuals[i]);
		chai.assert.isTrue(expected[i] === actuals[i]);
	}
};

//-----------------------------------------------------------------------------
// string to bytearray
//-----------------------------------------------------------------------------
export const stringToByteArray = function (str) {
	const array = new Array(str.length);

	for (let i = 0, il = str.length; i < il; ++i) {
		array[i] = str.charCodeAt(i) & 0xff;
	}

	return array;
};

//-----------------------------------------------------------------------------
// make random data
//-----------------------------------------------------------------------------
export const makeRandomData = function (size, typedarray) {
	const data = new (typedarray ? Uint8Array : Array)(size);
	const seed = +new Date();
	const mt = new MersenneTwister(seed);

	console.log('makeRandomData seed:', seed);

	// make random data
	for (let i = 0, il = data.length; i < il; ++i) {
		data[i] = mt.nextInt(256);
	}
	console.log('makeRandomData data:', data);
	return data;
};

//-----------------------------------------------------------------------------
// make sequential data
//-----------------------------------------------------------------------------
export const makeSequentialData = function (size, typedarray) {
	const data = new (typedarray ? Uint8Array : Array)(size);

	// make sequential data
	for (let i = 0, il = data.length; i < il; ++i) {
		data[i] = i & 0xff;
	}

	return data;
};

//-----------------------------------------------------------------------------
// make random sequential data
//-----------------------------------------------------------------------------
export const makeRandomSequentialData = function (size, typedarray, opt_seed) {
	const data = new (typedarray ? Uint8Array : Array)(size);
	const seed = opt_seed || +new Date();
	const mt = new MersenneTwister(seed);

	console.log('seed:', seed);

	// make random data
	for (let i = 0, il = data.length; i < il; ) {
		let random1 = mt.nextInt(256);
		let random2 = mt.nextInt(256);
		while (random2--) {
			if (i === il) {
				break;
			}
			data[i++] = random1++ & 0xff;
		}
	}

	return data;
};
