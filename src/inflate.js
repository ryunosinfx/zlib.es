import { Adler32 } from './adler32.js';
import { RawInflate } from './rawinflate.js';
import { Zip } from './zip.js';
export class Inflate {
	/**
	 * @constructor
	 * @param {!(Uint8Array)} input deflated buffer.
	 * @param {Object=} opt_params option parameters.
	 *
	 * opt_params は以下のプロパティを指定する事ができます。
	 *   - index: input buffer の deflate コンテナの開始位置.
	 *   - blockSize: バッファのブロックサイズ.
	 *   - verify: 伸張が終わった後 adler-32 checksum の検証を行うか.
	 *   - bufferType: Zlib.Inflate.BufferType の値によってバッファの管理方法を指定する.
	 *       Zlib.Inflate.BufferType は Zlib.RawInflate.BufferType のエイリアス.
	 */
	constructor(input, opt_params) {
		this.input = /** @type {!(Uint8Array)} */ input;
		this.ip = /** @type {number} */ 0;
		if (opt_params || !(opt_params = {})) {
			if (opt_params.index) this.ip = opt_params.index; // option parameters
			if (opt_params.verify) this.verify = /** @type {(boolean|undefined)} verify flag. */ opt_params.verify;
		}
		const cmf = /** @type {number} */ input[this.ip++]; // Compression Method and Flags
		const flg = /** @type {number} */ input[this.ip++];
		switch (cmf & 0x0f) {
			case Zip.CompressionMethod.DEFLATE:
				this.method = Zip.CompressionMethod.DEFLATE; // compression method
				break;
			default:
				throw new Error('unsupported compression method');
		}
		if (((cmf << 8) + flg) % 31 !== 0) throw new Error(`invalid fcheck flag:${((cmf << 8) + flg) % 31}`); // fcheck
		if (flg & 0x20) throw new Error('fdict flag is not supported'); // fdict (not supported)
		this.rawinflate = /** @type {Zlib.RawInflate} */ new RawInflate(input, {
			index: this.ip, // RawInflate
			bufferSize: opt_params.bufferSize,
			bufferType: opt_params.bufferType,
			resize: opt_params.resize,
		});
	}
	/**
	 * decompress.
	 * @return {!(Uint8Array)} inflated buffer.
	 */
	decompress() {
		const input = /** @type {!(Uint8Array)} input buffer. */ this.input;
		const buffer = /** @type {!(Uint8Array)} inflated buffer. */ this.rawinflate.decompress();
		this.ip = this.rawinflate.ip;
		if (this.verify) {
			const adler32 = // verify adler-32
				/** @type {number} adler-32 checksum */
				((input[this.ip++] << 24) | (input[this.ip++] << 16) | (input[this.ip++] << 8) | input[this.ip++]) >>>
				0;
			if (adler32 !== Adler32(buffer)) throw new Error('invalid adler-32 checksum');
		}
		return buffer;
	}
}
