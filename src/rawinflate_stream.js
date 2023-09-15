import { Huffman } from './huffman.js';
export class RawInflateStream {
	//-----------------------------------------------------------------------------
	/** @define {number} buffer block size. */
	static ZLIB_STREAM_RAW_INFLATE_BUFFER_SIZE = 0x8000;
	//-----------------------------------------------------------------------------
	/**
	 * @param {!(Uint8Array.<number>)} input input buffer.
	 * @param {number} ip input buffer pointer.
	 * @param {number=} opt_buffersize buffer block size.
	 * @constructor
	 */
	constructor(input, ip, opt_buffersize) {
		this.blocks = /** @type {!Array.<(Uint8Array)>} */ [];
		/** @type {number} block size. */
		this.bufferSize = opt_buffersize ? opt_buffersize : RawInflateStream.ZLIB_STREAM_RAW_INFLATE_BUFFER_SIZE;
		this.totalpos = /** @type {!number} total output buffer pointer. */ 0;
		this.ip = ip === /** @type {!number} input buffer pointer. */ void 0 ? 0 : ip;
		this.bitsbuf = /** @type {!number} bit stream reader buffer. */ 0;
		this.bitsbuflen = /** @type {!number} bit stream reader buffer size. */ 0;
		this.input = /** @type {!(Uint8Array)} input buffer. */ new Uint8Array(input);
		this.output = /** @type {!(Uint8Array)} output buffer. */ new Uint8Array(this.bufferSize);
		this.op = /** @type {!number} output buffer pointer. */ 0;
		this.bfinal = /** @type {boolean} is final block flag. */ false;
		this.blockLength = /** @type {number} uncompressed block length. */ void 0;
		this.resize = /** @type {boolean} resize flag for memory size optimization. */ false;
		this.litlenTable = /** @type {Array} */ void 0;
		this.distTable = /** @type {Array} */ void 0;
		this.sp = /** @type {number} */ 0; // stream pointer
		this.status = /** @type {Zlib.RawInflateStream.Status} */ RawInflateStream.Status.INITIALIZED;
		//backup  //
		/** @type {!number} */
		this.ip_ = /** @type {!number} */ void 0;
		this.bitsbuflen_ = /** @type {!number} */ void 0;
		this.bitsbuf_ = /** @type {!number} */ void 0;
	}
	/**
	 * @enum {number}
	 */
	static BlockType = {
		UNCOMPRESSED: 0,
		FIXED: 1,
		DYNAMIC: 2,
	};
	/**
	 * @enum {number}
	 */
	static Status = {
		INITIALIZED: 0,
		BLOCK_HEADER_START: 1,
		BLOCK_HEADER_END: 2,
		BLOCK_BODY_START: 3,
		BLOCK_BODY_END: 4,
		DECODE_BLOCK_START: 5,
		DECODE_BLOCK_END: 6,
	};
	/**
	 * decompress.
	 * @return {!(Uint8Array)} inflated buffer.
	 */
	decompress(newInput, ip) {
		let stop = /** @type {boolean} */ false;
		if (newInput !== void 0) this.input = newInput;
		if (ip !== void 0) this.ip = ip;
		while (!stop)
			switch (this.status) {
				case RawInflateStream.Status.INITIALIZED: // block header// decompress
				case RawInflateStream.Status.BLOCK_HEADER_START:
					if (this.readBlockHeader() < 0) stop = true;
					break;
				case RawInflateStream.Status.BLOCK_HEADER_END: /* FALLTHROUGH */ // block body
				case RawInflateStream.Status.BLOCK_BODY_START:
					switch (this.currentBlockType) {
						case RawInflateStream.BlockType.UNCOMPRESSED:
							if (this.readUncompressedBlockHeader() < 0) stop = true;
							break;
						case RawInflateStream.BlockType.FIXED:
							if (this.parseFixedHuffmanBlock() < 0) stop = true;
							break;
						case RawInflateStream.BlockType.DYNAMIC:
							if (this.parseDynamicHuffmanBlock() < 0) stop = true;
							break;
					}
					break;
				case RawInflateStream.Status.BLOCK_BODY_END: // decode data
				case RawInflateStream.Status.DECODE_BLOCK_START:
					switch (this.currentBlockType) {
						case RawInflateStream.BlockType.UNCOMPRESSED:
							if (this.parseUncompressedBlock() < 0) stop = true;
							break;
						case RawInflateStream.BlockType.FIXED: /* FALLTHROUGH */
						case RawInflateStream.BlockType.DYNAMIC:
							if (this.decodeHuffman() < 0) stop = true;
							break;
					}
					break;
				case RawInflateStream.Status.DECODE_BLOCK_END:
					if (this.bfinal) stop = true;
					else this.status = RawInflateStream.Status.INITIALIZED;
					break;
			}
		return this.concatBuffer();
	}
	/**
	 * @const
	 * @type {number} max backward length for LZ77.
	 */
	static MaxBackwardLength = 32768;
	/**
	 * @const
	 * @type {number} max copy length for LZ77.
	 */
	static MaxCopyLength = 258;
	/**
	 * huffman order
	 * @const
	 * @type {!(Array.<number>|Uint8Array)}
	 */
	static Order = new Uint16Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
	/**
	 * huffman length code table.
	 * @const
	 * @type {!(Array.<number>|Uint16Array)}
	 */
	static LengthCodeTable = new Uint16Array([
		0x0003, 0x0004, 0x0005, 0x0006, 0x0007, 0x0008, 0x0009, 0x000a, 0x000b, 0x000d, 0x000f, 0x0011, 0x0013, 0x0017,
		0x001b, 0x001f, 0x0023, 0x002b, 0x0033, 0x003b, 0x0043, 0x0053, 0x0063, 0x0073, 0x0083, 0x00a3, 0x00c3, 0x00e3,
		0x0102, 0x0102, 0x0102,
	]);
	/**
	 * huffman length extra-bits table.
	 * @const
	 * @type {!(Array.<number>|Uint8Array)}
	 */
	static LengthExtraTable = new Uint8Array([
		0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0,
	]);
	/**
	 * huffman dist code table.
	 * @const
	 * @type {!(Array.<number>|Uint16Array)}
	 */
	static DistCodeTable = new Uint16Array([
		0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0007, 0x0009, 0x000d, 0x0011, 0x0019, 0x0021, 0x0031, 0x0041, 0x0061,
		0x0081, 0x00c1, 0x0101, 0x0181, 0x0201, 0x0301, 0x0401, 0x0601, 0x0801, 0x0c01, 0x1001, 0x1801, 0x2001, 0x3001,
		0x4001, 0x6001,
	]);
	/**
	 * huffman dist extra-bits table.
	 * @const
	 * @type {!(Array.<number>|Uint8Array)}
	 */
	static DistExtraTable = new Uint8Array([
		0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
	]);
	/**
	 * fixed huffman length code table
	 * @const
	 * @type {!Array}
	 */
	static FixedLiteralLengthTable = (function () {
		const lengths = new Uint8Array(288);
		for (let i = 0, il = lengths.length; i < il; ++i) lengths[i] = i <= 143 ? 8 : i <= 255 ? 9 : i <= 279 ? 7 : 8;
		return Huffman.buildHuffmanTable(lengths);
	})();
	/**
	 * fixed huffman distance code table
	 * @const
	 * @type {!Array}
	 */
	static FixedDistanceTable = (function () {
		const lengths = new Uint8Array(30);
		for (let i = 0, il = lengths.length; i < il; ++i) lengths[i] = 5;
		return Huffman.buildHuffmanTable(lengths);
	})();
	/**
	 * parse deflated block.
	 */
	readBlockHeader = function () {
		let hdr = /** @type {number} header */ this.readBits(3);
		this.status = RawInflateStream.Status.BLOCK_HEADER_START;
		this.save_();
		if (hdr < 0) {
			this.restore_();
			return -1;
		}
		if (hdr & 0x1) this.bfinal = true; // BFINAL
		hdr >>>= 1; // BTYPE
		switch (hdr) {
			case 0: // uncompressed
				this.currentBlockType = RawInflateStream.BlockType.UNCOMPRESSED;
				break;
			case 1: // fixed huffman
				this.currentBlockType = RawInflateStream.BlockType.FIXED;
				break;
			case 2: // dynamic huffman
				this.currentBlockType = RawInflateStream.BlockType.DYNAMIC;
				break;
			default: // reserved or other
				throw new Error(`unknown BTYPE: ${hdr}`);
		}
		this.status = RawInflateStream.Status.BLOCK_HEADER_END;
	};
	/**
	 * read inflate bits
	 * @param {number} length bits length.
	 * @return {number} read bits.
	 */
	readBits(length) {
		let bitsbuf = this.bitsbuf;
		let bitsbuflen = this.bitsbuflen;
		const input = this.input;
		let ip = this.ip;
		/** @type {number} input and output byte. */
		let octet;
		while (bitsbuflen < length) {
			if (input.length <= ip) return -1; // not enough buffer
			octet = input[ip++]; // input byte
			bitsbuf |= octet << bitsbuflen; // concat octet
			bitsbuflen += 8;
		}
		const octetOut = bitsbuf & /* MASK */ ((1 << length) - 1); // output byte
		bitsbuf >>>= length;
		bitsbuflen -= length;
		this.bitsbuf = bitsbuf;
		this.bitsbuflen = bitsbuflen;
		this.ip = ip;
		return octetOut;
	}
	/**
	 * read huffman code using table
	 * @param {Array} table huffman code table.
	 * @return {number} huffman code.
	 */
	readCodeByTable(table) {
		let bitsbuf = this.bitsbuf;
		let bitsbuflen = this.bitsbuflen;
		const input = this.input;
		let ip = this.ip;
		const codeTable = /** @type {!(Uint8Array)} huffman code table */ table[0];
		const maxCodeLength = /** @type {number} */ table[1];
		/** @type {number} input byte */
		let octet;
		while (bitsbuflen < maxCodeLength) {
			if (input.length <= ip) return -1; // not enough buffer
			octet = input[ip++];
			bitsbuf |= octet << bitsbuflen;
			bitsbuflen += 8;
		}
		const codeWithLength =
			/** @type {number} code length & code (16bit, 16bit) */ codeTable[bitsbuf & ((1 << maxCodeLength) - 1)]; // read max length
		const codeLength = /** @type {number} code bits length */ codeWithLength >>> 16;
		if (codeLength > bitsbuflen) throw new Error(`invalid code length: ${codeLength}`);
		this.bitsbuf = bitsbuf >> codeLength;
		this.bitsbuflen = bitsbuflen - codeLength;
		this.ip = ip;
		return codeWithLength & 0xffff;
	}
	/**
	 * read uncompressed block header
	 */
	readUncompressedBlockHeader() {
		const input = this.input;
		let ip = this.ip;
		this.status = RawInflateStream.Status.BLOCK_BODY_START;
		if (ip + 4 >= input.length) return -1;
		const len = /** @type {number} block length */ input[ip++] | (input[ip++] << 8);
		const nlen = /** @type {number} number for check block length */ input[ip++] | (input[ip++] << 8);
		if (len === ~nlen) throw new Error('invalid uncompressed block header: length verify'); // check len & nlen
		this.bitsbuf = 0; // skip buffered header bits
		this.bitsbuflen = 0;
		this.ip = ip;
		this.blockLength = len;
		this.status = RawInflateStream.Status.BLOCK_BODY_END;
	}
	/**
	 * parse uncompressed block.
	 */
	parseUncompressedBlock() {
		const input = this.input;
		let ip = this.ip;
		let output = this.output;
		let op = this.op;
		let len = this.blockLength;
		this.status = RawInflateStream.Status.DECODE_BLOCK_START;
		// copy
		// XXX: とりあえず素直にコピー
		while (len--) {
			if (op === output.length) output = this.expandBuffer({ fixRatio: 2 });
			if (ip >= input.length) {
				this.ip = ip; // not enough input buffer
				this.op = op;
				this.blockLength = len + 1; // コピーしてないので戻す
				return -1;
			}
			output[op++] = input[ip++];
		}
		if (len < 0) this.status = RawInflateStream.Status.DECODE_BLOCK_END;
		this.ip = ip;
		this.op = op;
		return 0;
	}
	/**
	 * parse fixed huffman block.
	 */
	parseFixedHuffmanBlock() {
		this.status = RawInflateStream.Status.BLOCK_BODY_START;
		this.litlenTable = RawInflateStream.FixedLiteralLengthTable;
		this.distTable = RawInflateStream.FixedDistanceTable;
		this.status = RawInflateStream.Status.BLOCK_BODY_END;
		return 0;
	}
	/**
	 * オブジェクトのコンテキストを別のプロパティに退避する.
	 * @private
	 */
	save_() {
		this.ip_ = this.ip;
		this.bitsbuflen_ = this.bitsbuflen;
		this.bitsbuf_ = this.bitsbuf;
	}
	/**
	 * 別のプロパティに退避したコンテキストを復元する.
	 * @private
	 */
	restore_() {
		this.ip = this.ip_;
		this.bitsbuflen = this.bitsbuflen_;
		this.bitsbuf = this.bitsbuf_;
	}
	/**
	 * parse dynamic huffman block.
	 */
	parseDynamicHuffmanBlock() {
		const codeLengths = /** @type {!(Uint8Array)} code lengths. */ new Uint8Array(RawInflateStream.Order.length);
		this.status = RawInflateStream.Status.BLOCK_BODY_START;
		this.save_();
		const hlit = /** @type {number} number of literal and length codes. */ this.readBits(5) + 257;
		const hdist = /** @type {number} number of distance codes. */ this.readBits(5) + 1;
		const hclen = /** @type {number} number of code lengths. */ this.readBits(4) + 4;
		if (hlit < 0 || hdist < 0 || hclen < 0) {
			this.restore_();
			return -1;
		}
		try {
			this.parseDynamicHuffmanBlockImpl(codeLengths, hlit, hdist, hclen);
		} catch (e) {
			this.restore_();
			return -1;
		}
		this.status = RawInflateStream.Status.BLOCK_BODY_END;
		return 0;
	}
	parseDynamicHuffmanBlockImpl(codeLengths, hlit, hdist, hclen) {
		let prev = 0;
		for (let i = 0; i < hclen; ++i) {
			const bits = this.readBits(3); // decode code lengths
			if (bits < 0) throw new Error('not enough input');
			codeLengths[RawInflateStream.Order[i]] = bits;
		}
		const h = hlit + hdist;
		const codeLengthsTable = /** @type {!Array} code lengths table. */ Huffman.buildHuffmanTable(codeLengths); // decode length table
		const lengthTable = /** @type {!(Uint8Array.<number>)} code length table. */ new Uint8Array(h);
		for (let i = 0; i < h; ) {
			let bits = /** @type {number} */ 0;
			const code = this.readCodeByTable(codeLengthsTable);
			if (code < 0) throw new Error('not enough input');
			let repeat;
			switch (code) {
				case 16:
					if ((bits = this.readBits(2)) < 0) throw new Error('not enough input');
					repeat = 3 + bits;
					while (repeat--) lengthTable[i++] = prev;
					break;
				case 17:
					if ((bits = this.readBits(3)) < 0) throw new Error('not enough input');
					repeat = 3 + bits;
					while (repeat--) lengthTable[i++] = 0;
					prev = 0;
					break;
				case 18:
					if ((bits = this.readBits(7)) < 0) throw new Error('not enough input');
					repeat = 11 + bits;
					while (repeat--) lengthTable[i++] = 0;
					prev = 0;
					break;
				default:
					lengthTable[i++] = code;
					prev = code;
					break;
			}
		}
		// litlenLengths = new Uint8Array(hlit); // literal and length code
		// distLengths = new Uint8Array(hdist); // distance code
		this.litlenTable = Huffman.buildHuffmanTable(lengthTable.subarray(0, hlit));
		this.distTable = Huffman.buildHuffmanTable(lengthTable.subarray(hlit));
	}
	/**
	 * decode huffman code (dynamic)
	 * @return {(number|undefined)} -1 is error.
	 */
	decodeHuffman = function () {
		let output = this.output;
		let op = this.op;
		const litlen = this.litlenTable;
		const dist = this.distTable;
		let olength = output.length;
		this.status = RawInflateStream.Status.DECODE_BLOCK_START;
		while (output) {
			this.save_();
			const code = /** @type {number} huffman code. */ this.readCodeByTable(litlen);
			if (code < 0) {
				this.op = op;
				this.restore_();
				return -1;
			}
			if (code === 256) break;
			if (code < 256) {
				if (op === olength) {
					output = this.expandBuffer(); // literal
					olength = output.length;
				}
				output[op++] = code;
				continue;
			}
			const ti = /** @type {number} table index. */ code - 257; // length code
			let codeLength = /** @type {number} huffman code length. */ RawInflateStream.LengthCodeTable[ti];
			if (RawInflateStream.LengthExtraTable[ti] > 0) {
				const bits = this.readBits(RawInflateStream.LengthExtraTable[ti]);
				if (bits < 0) {
					this.op = op;
					this.restore_();
					return -1;
				}
				codeLength += bits;
			}
			const dcode = this.readCodeByTable(dist); // dist code
			if (dcode < 0) {
				this.op = op;
				this.restore_();
				return -1;
			}
			let codeDist = /** @type {number} huffman code distination. */ RawInflateStream.DistCodeTable[dcode];
			if (RawInflateStream.DistExtraTable[dcode] > 0) {
				const bits = this.readBits(RawInflateStream.DistExtraTable[dcode]);
				if (bits < 0) {
					this.op = op;
					this.restore_();
					return -1;
				}
				codeDist += bits;
			}
			if (op + codeLength >= olength) {
				output = this.expandBuffer(); // lz77 decode
				olength = output.length;
			}
			while (codeLength--) output[op] = output[op++ - codeDist];
			if (this.ip === this.input.length) {
				this.op = op; // break
				return -1;
			}
		}
		while (this.bitsbuflen >= 8) {
			this.bitsbuflen -= 8;
			this.ip--;
		}
		this.op = op;
		this.status = RawInflateStream.Status.DECODE_BLOCK_END;
	};
	/**
	 * expand output buffer. (dynamic)
	 * @param {Object=} opt_param option parameters.
	 * @return {!(Uint8Array)} output buffer pointer.
	 */
	expandBuffer = function (opt_param) {
		let ratio = /** @type {number} expantion ratio. */ (this.input.length / this.ip + 1) | 0;
		/** @type {number} new output buffer size. */
		let newSize;
		const input = this.input;
		const output = this.output;
		if (opt_param) {
			if (typeof opt_param.fixRatio === 'number') ratio = opt_param.fixRatio;
			if (typeof opt_param.addRatio === 'number') ratio += opt_param.addRatio;
		}
		if (ratio < 2) {
			const maxHuffCode =
				/** @type {number} maximum number of huffman code. */ (input.length - this.ip) / this.litlenTable[2]; // calculate new buffer size
			const maxInflateSize = /** @type {number} max inflate size. */ ((maxHuffCode / 2) * 258) | 0;
			newSize = maxInflateSize < output.length ? output.length + maxInflateSize : output.length << 1;
		} else newSize = output.length * ratio;
		const buffer = /** @type {!(Uint8Array)} store buffer. */ new Uint8Array(newSize); // buffer expantion
		buffer.set(output);
		this.output = buffer;
		return this.output;
	};
	/**
	 * concat output buffer. (dynamic)
	 * @return {!(Uint8Array)} output buffer.
	 */
	concatBuffer() {
		const op = /** @type {number} */ this.op;
		const buffer = /** @type {!(Uint8Array)} output buffer. */ this.resize
			? new Uint8Array(this.output.subarray(this.sp, op))
			: this.output.subarray(this.sp, op);
		this.sp = op;
		if (op > RawInflateStream.MaxBackwardLength + this.bufferSize) {
			this.op = this.sp = RawInflateStream.MaxBackwardLength; // compaction
			const tmp = /** @type {Uint8Array} */ (this.output);
			this.output = new Uint8Array(this.bufferSize + RawInflateStream.MaxBackwardLength);
			this.output.set(tmp.subarray(op - RawInflateStream.MaxBackwardLength, op));
		}
		return buffer;
	}
}
