/**
 * @fileoverview Adler32 checksum 実装.
 */
import { Util } from './util.js';
export class Adler32 {
	/**
	 * Adler32 ハッシュ値の作成
	 * @param {!(Array|Uint8Array|string)} array 算出に使用する byte array.
	 * @return {number} Adler32 ハッシュ値.
	 */
	static mkHash(array) {
		return Adler32.update(1, typeof array === 'string' ? Util.stringToByteArray(array) : array);
	}
	/**
	 * Adler32 ハッシュ値の更新
	 * @param {number} adler 現在のハッシュ値.
	 * @param {!(Array|Uint8Array)} array 更新に使用する byte array.
	 * @return {number} Adler32 ハッシュ値.
	 */
	static update(adler, array) {
		let s1 = /** @type {number} */ adler & 0xffff;
		let s2 = /** @type {number} */ (adler >>> 16) & 0xffff;
		let len = /** @type {number} array length */ array.length;
		let i = /** @type {number} array index */ 0;
		while (len > 0) {
			/** @type {number} loop length (don't overflow) */
			let tlen = len > Adler32.OptimizationParameter ? Adler32.OptimizationParameter : len;
			len -= tlen;
			do {
				s1 += array[i++];
				s2 += s1;
			} while (--tlen);
			s1 %= 65521;
			s2 %= 65521;
		}
		return ((s2 << 16) | s1) >>> 0;
	}
	/**
	 * Adler32 最適化パラメータ
	 * 現状では 1024 程度が最適.
	 * @see http://jsperf.com/adler-32-simple-vs-optimized/3
	 * @define {number}
	 */
	static OptimizationParameter = 1024;
}
