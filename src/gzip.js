/**
 * @fileoverview GZIP (RFC1952) 実装.
 */
import { CRC32 } from './crc32.js';
import { RawDeflate } from './rawdeflate.js';
export class Gzip {
	/**
	 * @type {number}
	 * @const
	 */
	static DefaultBufferSize = 0x8000;
	/** @enum {number} */
	static OperatingSystem = {
		FAT: 0,
		AMIGA: 1,
		VMS: 2,
		UNIX: 3,
		VM_CMS: 4,
		ATARI_TOS: 5,
		HPFS: 6,
		MACINTOSH: 7,
		Z_SYSTEM: 8,
		CP_M: 9,
		TOPS_20: 10,
		NTFS: 11,
		QDOS: 12,
		ACORN_RISCOS: 13,
		UNKNOWN: 255,
	};
	/** @enum {number} */
	static FlagsMask = {
		FTEXT: 0x01,
		FHCRC: 0x02,
		FEXTRA: 0x04,
		FNAME: 0x08,
		FCOMMENT: 0x10,
	};
	/**
	 * @constructor
	 * @param {!(Array|Uint8Array)} input input buffer.
	 * @param {Object=} opt_params option parameters.
	 */
	constructor(input, opt_params) {
		this.input = /** @type {!(Array.<number>|Uint8Array)} input buffer. */ input;
		this.ip = /** @type {number} input buffer pointer. */ 0;
		/** @type {!(Array.<number>|Uint8Array)} output buffer. */
		this.output;
		this.op = /** @type {number} output buffer. */ 0;
		this.flags = /** @type {!Object} flags option flags. */ {};
		/** @type {!string} filename. */
		this.filename;
		/** @type {!string} comment. */
		this.comment;
		/** @type {!Object} deflate options. */
		this.deflateOptions;
		if (opt_params) {
			if (opt_params.flags) this.flags = opt_params.flags; // option parameters
			if (typeof opt_params.filename === 'string') this.filename = opt_params.filename;
			if (typeof opt_params.comment === 'string') this.comment = opt_params.comment;
			if (opt_params.deflateOptions) this.deflateOptions = opt_params.deflateOptions;
		}
		if (!this.deflateOptions) this.deflateOptions = {};
	}
	/**
	 * encode gzip members.
	 * @return {!(Array|Uint8Array)} gzip binary array.
	 */
	compress() {
		const output = /** @type {!(Array|Uint8Array)} output buffer. */ new Uint8Array(Gzip.DefaultBufferSize);
		let op = /** @type {number} output buffer pointer. */ 0;
		const input = this.input;
		let ip = this.ip;
		const filename = this.filename;
		const comment = this.comment;
		output[op++] = 0x1f; // check signature
		output[op++] = 0x8b;
		output[op++] = 8; /* XXX: use Zlib const */ // check compression method
		let flg = 0; // flags
		if (this.flags.fname) flg |= Gzip.FlagsMask.FNAME;
		if (this.flags.fcomment) flg |= Gzip.FlagsMask.FCOMMENT;
		if (this.flags.fhcrc) flg |= Gzip.FlagsMask.FHCRC;
		// XXX: FTEXT
		// XXX: FEXTRA
		output[op++] = flg;
		const mtime = ((Date.now ? Date.now() : +new Date()) / 1000) | 0; // modification time
		output[op++] = mtime & 0xff;
		output[op++] = (mtime >>> 8) & 0xff;
		output[op++] = (mtime >>> 16) & 0xff;
		output[op++] = (mtime >>> 24) & 0xff;
		output[op++] = 0; // extra flags
		output[op++] = Gzip.OperatingSystem.UNKNOWN; // operating system
		// extra
		/* NOP */
		if (this.flags.fname !== void 0) {
			for (let i = 0, il = filename.length; i < il; ++i) {
				const c = filename.charCodeAt(i); // fname
				if (c > 0xff) output[op++] = (c >>> 8) & 0xff;
				output[op++] = c & 0xff;
			}
			output[op++] = 0; // null termination
		}
		if (this.flags.comment) {
			for (let i = 0, il = comment.length; i < il; ++i) {
				const c = comment.charCodeAt(i); // fcomment
				if (c > 0xff) output[op++] = (c >>> 8) & 0xff;
				output[op++] = c & 0xff;
			}
			output[op++] = 0; // null termination
		}
		if (this.flags.fhcrc) {
			const crc16 = CRC32.calc(output, 0, op) & 0xffff; // fhcrc CRC-16 value for FHCRC flag.
			output[op++] = crc16 & 0xff;
			output[op++] = (crc16 >>> 8) & 0xff;
		}
		this.deflateOptions.outputBuffer = output; // add compress option
		this.deflateOptions.outputIndex = op;
		const rawdeflate = new RawDeflate(input, this.deflateOptions); // compress//raw deflate object.
		let output2 = rawdeflate.compress();
		let op2 = rawdeflate.op;
		if (op2 + 8 > output2.buffer.byteLength) {
			this.output = new Uint8Array(op2 + 8); // expand buffer
			this.output.set(new Uint8Array(output2.buffer));
			output2 = this.output;
		} else output2 = new Uint8Array(output2.buffer);
		const crc32 = CRC32.calc(input); // crc32 CRC-32 value for verification.
		output2[op2++] = crc32 & 0xff;
		output2[op2++] = (crc32 >>> 8) & 0xff;
		output2[op2++] = (crc32 >>> 16) & 0xff;
		output2[op2++] = (crc32 >>> 24) & 0xff;
		const il = input.length; // input size
		output2[op2++] = il & 0xff;
		output2[op2++] = (il >>> 8) & 0xff;
		output2[op2++] = (il >>> 16) & 0xff;
		output2[op2++] = (il >>> 24) & 0xff;
		this.ip = ip;
		const output3 = op2 < output2.length ? output2.subarray(0, op2) : output2;
		this.output = output3;
		return output3;
	}
}
