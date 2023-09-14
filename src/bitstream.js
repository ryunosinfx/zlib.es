/**
 * @fileoverview bit 単位での書き込み実装.
 */
/**
 * ビットストリーム
 * @constructor
 * @param {!(Array|Uint8Array)=} buffer output buffer.
 * @param {number=} bufferPosition start buffer pointer.
 */
export class BitStream {
	/**
	 * デフォルトブロックサイズ.
	 * @const
	 * @type {number}
	 */
	static DefaultBlockSize = 0x8000;
	constructor(buffer, bufferPosition) {
		this.index = /** @type {number} buffer index. */ typeof bufferPosition === 'number' ? bufferPosition : 0;
		this.bitindex = /** @type {number} bit index. */ 0;
		/** @type {!(Array|Uint8Array)} bit-stream output buffer. */
		this.buffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(BitStream.DefaultBlockSize);
		// 入力された index が足りなかったら拡張するが、倍にしてもダメなら不正とする
		if (this.buffer.length * 2 <= this.index) throw new Error('invalid index');
		else if (this.buffer.length <= this.index) this.expandBuffer();
	}
	/**
	 * expand buffer.
	 * @return {!(Array|Uint8Array)} new buffer.
	 */
	expandBuffer() {
		const oldbuf = /** @type {!(Array|Uint8Array)} old buffer. */ this.buffer;
		const buffer = /** @type {!(Array|Uint8Array)} new buffer. */ new Uint8Array(oldbuf.length << 1);
		buffer.set(oldbuf); // copy buffer
		return (this.buffer = buffer);
	}
	/**
	 * 数値をビットで指定した数だけ書き込む.
	 * @param {number} number 書き込む数値.
	 * @param {number} n 書き込むビット数.
	 * @param {boolean=} reverse 逆順に書き込むならば true.
	 */
	writeBits(number, n, reverse) {
		const buffer = this.buffer;
		const index = this.index;
		const bitindex = this.bitindex;
		let current = /** @type {number} current octet. */ buffer[index];
		if (reverse && n > 1)
			number = n > 8 ? this.rev32_(number) >> (32 - n) : BitStream.ReverseTable[number] >> (8 - n);
		if (n + bitindex < 8) {
			current = (current << n) | number; // Byte 境界を超えないとき
			bitindex += n;
		} else {
			for (let i = 0; i < n; ++i) {
				current = (current << 1) | ((number >> (n - i - 1)) & 1); // Byte 境界を超えるとき
				if (++bitindex === 8) {
					bitindex = 0; // next byte
					buffer[index++] = BitStream.ReverseTable[current];
					current = 0;
					if (index === buffer.length) buffer = this.expandBuffer(); // expand
				}
			}
		}
		buffer[index] = current;
		this.buffer = buffer;
		this.bitindex = bitindex;
		this.index = index;
	}
	/**
	 * 32-bit 整数のビット順を逆にする
	 * @param {number} n 32-bit integer.
	 * @return {number} reversed 32-bit integer.
	 * @private
	 */
	rev32_(n) {
		return (
			(BitStream.ReverseTable[n & 0xff] << 24) |
			(BitStream.ReverseTable[(n >>> 8) & 0xff] << 16) |
			(BitStream.ReverseTable[(n >>> 16) & 0xff] << 8) |
			BitStream.ReverseTable[(n >>> 24) & 0xff]
		);
	}
	/**
	 * ストリームの終端処理を行う
	 * @return {!(Array|Uint8Array)} 終端処理後のバッファを byte array で返す.
	 */
	finish() {
		const buffer = this.buffer;
		let index = this.index;
		if (this.bitindex > 0) {
			buffer[index] <<= 8 - this.bitindex; // bitindex が 0 の時は余分に index が進んでいる状態
			buffer[index] = Zlib.BitStream.ReverseTable[buffer[index]];
			index++;
		}
		return buffer.subarray(0, index); // array truncation;
	}
	static buildReverseTable() {
		const table = /** @type {!(Array|Uint8Array)} reverse table. */ new Uint8Array(256);
		const func = (n) => {
			let r = n,
				s = 7;
			for (n >>>= 1; n; n >>>= 1) {
				r <<= 1;
				r |= n & 1;
				--s;
			}
			return ((r << s) & 0xff) >>> 0;
		};
		for (let i = 0; i < 256; ++i) {
			table[i] = func(i); // generate
		}
		return table;
	}
	/**
	 * 0-255 のビット順を反転したテーブル
	 * @const
	 * @type {!(Uint8Array|Array.<number>)}
	 */
	static ReverseTable = (() => BitStream.buildReverseTable())();
}
