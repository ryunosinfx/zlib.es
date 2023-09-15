/**
 * @fileoverview Deflate (RFC1951) 実装.
 * Deflateアルゴリズム本体は Zlib.RawDeflate で実装されている.
 */
import { Zlib } from './zlib.js';
import { Adler32 } from './adler32.js';
import { RawDeflate } from './rawdeflate.js';
export class Deflate {
	/**
	 * @const
	 * @type {number} デフォルトバッファサイズ.
	 */
	static DefaultBufferSize = 0x8000;
	/**
	 * Zlib Deflate
	 * @constructor
	 * @param {!(Uint8Array)} input 符号化する対象の byte array.
	 * @param {Object=} opt_params option parameters.
	 */
	constructor(input, opt_params) {
		this.input = /** @type {!(Uint8Array)} */ input;
		this.output = /** @type {!(Uint8Array)} */ new Uint8Array(Deflate.DefaultBufferSize);
		this.compressionType = /** @type {Zlib.Deflate.CompressionType} */ RawDeflate.CompressionType.DYNAMIC;
		const rawDeflateOption = /** @type {Object} */ {};
		if (opt_params || !(opt_params = {}))
			if (typeof opt_params.compressionType === 'number') this.compressionType = opt_params.compressionType; // option parameters
		for (const prop in opt_params) rawDeflateOption[prop] = opt_params[prop]; // copy options
		rawDeflateOption.outputBuffer = this.output; // set raw-deflate output buffer
		this.rawDeflate = /** @type {Zlib.RawDeflate} */ new RawDeflate(this.input, rawDeflateOption);
	}
	/**
	 * 直接圧縮に掛ける.
	 * @param {!(Uint8Array)} input target buffer.
	 * @param {Object=} opt_params option parameters.
	 * @return {!(Uint8Array)} compressed data byte array.
	 */
	static compress(input, opt_params) {
		return new Deflate(input, opt_params).compress();
	}
	/**
	 * Deflate Compression.
	 * @return {!(Uint8Array)} compressed data byte array.
	 */
	compress() {
		let cinfo = /** @type {number} */ 0;
		let flevel = /** @type {number} */ 0;
		let pos = /** @type {number} */ 0;
		const output = this.output;
		const cm = Zlib.CompressionMethod.DEFLATE; // Compression Method and Flags
		switch (cm) {
			case Zlib.CompressionMethod.DEFLATE:
				cinfo = Math.LOG2E * Math.log(RawDeflate.WindowSize) - 8;
				break;
			default:
				throw new Error('invalid compression method');
		}
		const cmf = (cinfo << 4) | cm;
		output[pos++] = cmf;
		const fdict = 0; // Flags
		switch (cm) {
			case Zlib.CompressionMethod.DEFLATE:
				switch (this.compressionType) {
					case RawDeflate.CompressionType.NONE:
						flevel = 0;
						break;
					case RawDeflate.CompressionType.FIXED:
						flevel = 1;
						break;
					case RawDeflate.CompressionType.DYNAMIC:
						flevel = 2;
						break;
					default:
						throw new Error('unsupported compression type');
				}
				break;
			default:
				throw new Error('invalid compression method');
		}
		let flg = (flevel << 6) | (fdict << 5);
		const fcheck = 31 - ((cmf * 256 + flg) % 31);
		flg |= fcheck;
		output[pos++] = flg;
		const adler = Adler32.mkHash(this.input); // Adler-32 checksum
		this.rawDeflate.op = pos;
		const output2 = this.rawDeflate.compress();
		let pos2 = output2.length;
		let output3 = new Uint8Array(output2.buffer); // subarray 分を元にもどす
		if (output3.length <= pos2 + 4) {
			this.output = new Uint8Array(output3.length + 4); // expand buffer
			this.output.set(output3);
			output3 = this.output;
		}
		const output4 = output3.subarray(0, pos2 + 4);
		output4[pos2++] = (adler >> 24) & 0xff; // adler32
		output4[pos2++] = (adler >> 16) & 0xff;
		output4[pos2++] = (adler >> 8) & 0xff;
		output4[pos2++] = adler & 0xff;
		return output4;
	}
}
