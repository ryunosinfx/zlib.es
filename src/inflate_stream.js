import { Zlib } from './zlib.js';
import { RawInflateStream } from './rawinflate_stream.js';
export class InflateStream {
	/**
	 * @param {!(Uint8Array)} input deflated buffer.
	 * @constructor
	 */
	constructor(input) {
		this.input = /** @type {!(Uint8Array)} */ input === void 0 ? new Uint8Array() : input;
		this.ip = /** @type {number} */ 0;
		this.rawinflate = /** @type {Zlib.RawInflateStream} */ new RawInflateStream(this.input, this.ip);
		this.output = /** @type {!(Uint8Array)} */ this.rawinflate.output;
	}
	/**
	 * decompress.
	 * @return {!(Uint8Array)} inflated buffer.
	 */
	decompress(input) {
		// /** @type {number} adler-32 checksum */
		// var adler32;
		// 新しい入力を入力バッファに結合する
		// XXX Array, Uint8Array のチェックを行うか確認する
		if (input !== void 0) {
			const tmp = new Uint8Array(this.input.length + input.length);
			tmp.set(this.input, 0);
			tmp.set(input, this.input.length);
			this.input = tmp;
		}
		if (this.method === void 0) if (this.readHeader() < 0) return new Uint8Array();
		const buffer = /** @type {!(Uint8Array)} inflated buffer. */ this.rawinflate.decompress(this.input, this.ip);
		if (this.rawinflate.ip !== 0) {
			this.input = this.input.subarray(this.rawinflate.ip);
			this.ip = 0;
		}
		// verify adler-32
		/*
    if (this.verify) {
      adler32 =
        input[this.ip++] << 24 | input[this.ip++] << 16 |
        input[this.ip++] << 8 | input[this.ip++];
      if (adler32 !== Zlib.Adler32(buffer)) {
        throw new Error('invalid adler-32 checksum');
      }
    }
    */
		return buffer;
	}
	readHeader() {
		let ip = this.ip;
		const input = this.input;
		const cmf = input[ip++]; // Compression Method and Flags
		const flg = input[ip++];
		if (cmf === void 0 || flg === void 0) return -1;
		switch (cmf & 0x0f) {
			case Zlib.CompressionMethod.DEFLATE: // compression method
				this.method = Zlib.CompressionMethod.DEFLATE;
				break;
			default:
				throw new Error('unsupported compression method');
		}
		if (((cmf << 8) + flg) % 31 !== 0) throw new Error(`invalid fcheck flag:${((cmf << 8) + flg) % 31}`); // fcheck
		if (flg & 0x20) throw new Error('fdict flag is not supported'); // fdict (not supported)
		this.ip = ip;
	}
}
