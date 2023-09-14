/**
 * @fileoverview 雑多な関数群をまとめたモジュール実装.
 */
export class Util {
	/**
	 * Byte String から Byte Array に変換.
	 * @param {!string} str byte string.
	 * @return {!Array.<number>} byte array.
	 */
	static stringToByteArray(str) {
		const tmp = /** @type {!Array.<(string|number)>} */ str.split('');
		for (let i = 0, il = tmp.length; i < il; i++) tmp[i] = (tmp[i].charCodeAt(0) & 0xff) >>> 0;
		return tmp;
	}
}
