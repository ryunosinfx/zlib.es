import { Huffman } from './huffman.js';
export class RawInflate {
	//-----------------------------------------------------------------------------
	/** @define {number} buffer block size. */
	static ZLIB_RAW_INFLATE_BUFFER_SIZE = 0x8000; // [ 0x8000 >= ZLIB_BUFFER_BLOCK_SIZE ]
	//-----------------------------------------------------------------------------
	static buildHuffmanTable = Huffman.buildHuffmanTable;
	/**
	 * @enum {number}
	 */
	static BufferType = {
		BLOCK: 0,
		ADAPTIVE: 1,
	};
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
	 * @type {!(Uint8Array)}
	 */
	static Order = new Uint16Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
	/**
	 * huffman length code table.
	 * @const
	 * @type {!(Uint16Array)}
	 */
	static LengthCodeTable = new Uint16Array([
		0x0003, 0x0004, 0x0005, 0x0006, 0x0007, 0x0008, 0x0009, 0x000a, 0x000b, 0x000d, 0x000f, 0x0011, 0x0013, 0x0017,
		0x001b, 0x001f, 0x0023, 0x002b, 0x0033, 0x003b, 0x0043, 0x0053, 0x0063, 0x0073, 0x0083, 0x00a3, 0x00c3, 0x00e3,
		0x0102, 0x0102, 0x0102,
	]);
	/**
	 * huffman length extra-bits table.
	 * @const
	 * @type {!(Uint8Array)}
	 */
	static LengthExtraTable = new Uint8Array([
		0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0,
	]);
	/**
	 * huffman dist code table.
	 * @const
	 * @type {!(Uint16Array)}
	 */
	static DistCodeTable = new Uint16Array([
		0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0007, 0x0009, 0x000d, 0x0011, 0x0019, 0x0021, 0x0031, 0x0041, 0x0061,
		0x0081, 0x00c1, 0x0101, 0x0181, 0x0201, 0x0301, 0x0401, 0x0601, 0x0801, 0x0c01, 0x1001, 0x1801, 0x2001, 0x3001,
		0x4001, 0x6001,
	]);
	/**
	 * huffman dist extra-bits table.
	 * @const
	 * @type {!(Uint8Array)}
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
	 * @constructor
	 * @param {!(Uint8Array)} input input buffer.
	 * @param {Object} opt_params option parameter.
	 *
	 * opt_params は以下のプロパティを指定する事ができます。
	 *   - index: input buffer の deflate コンテナの開始位置.
	 *   - blockSize: バッファのブロックサイズ.
	 *   - bufferType: Zlib.RawInflate.BufferType の値によってバッファの管理方法を指定する.
	 *   - resize: 確保したバッファが実際の大きさより大きかった場合に切り詰める.
	 */
	constructor(input, opt_params) {
		this.buffer = /** @type {!(Uint8Array)} inflated buffer */ void 0;
		this.blocks = /** @type {!Array.<(Uint8Array)>} */ [];
		this.bufferSize = /** @type {number} block size. */ RawInflate.ZLIB_RAW_INFLATE_BUFFER_SIZE;
		this.totalpos = /** @type {!number} total output buffer pointer. */ 0;
		this.ip = /** @type {!number} input buffer pointer. */ 0;
		this.bitsbuf = /** @type {!number} bit stream reader buffer. */ 0;
		this.bitsbuflen = /** @type {!number} bit stream reader buffer size. */ 0;
		this.input = /** @type {!(Uint8Array)} input buffer. */ new Uint8Array(input);
		this.output = /** @type {!(Uint8Array)} output buffer. */ void 0;
		this.op = /** @type {!number} output buffer pointer. */ void 0;
		this.bfinal = /** @type {boolean} is final block flag. */ false;
		this.bufferType = /** @type {Zlib.RawInflate.BufferType} buffer management. */ RawInflate.BufferType.ADAPTIVE;
		this.resize = /** @type {boolean} resize flag for memory size optimization. */ false;
		if (opt_params || !(opt_params = {})) {
			if (opt_params.index) this.ip = opt_params.index;
			if (opt_params.bufferSize) this.bufferSize = opt_params.bufferSize;
			if (opt_params.bufferType) this.bufferType = opt_params.bufferType;
			if (opt_params.resize) this.resize = opt_params.resize;
		}
		switch (this.bufferType) {
			case RawInflate.BufferType.BLOCK:
				this.op = RawInflate.MaxBackwardLength;
				this.output = new Uint8Array(RawInflate.MaxBackwardLength + this.bufferSize + RawInflate.MaxCopyLength);
				break;
			case RawInflate.BufferType.ADAPTIVE:
				this.op = 0;
				this.output = new Uint8Array(this.bufferSize);
				break;
			default:
				throw new Error('invalid inflate mode');
		}
	}
	/**
	 * decompress.
	 * @return {!(Uint8Array)} inflated buffer.
	 */
	decompress() {
		while (!this.bfinal) this.parseBlock();
		switch (this.bufferType) {
			case RawInflate.BufferType.BLOCK:
				return this.concatBufferBlock();
			case RawInflate.BufferType.ADAPTIVE:
				return this.concatBufferDynamic();
			default:
				throw new Error('invalid inflate mode');
		}
	}
	/**
	 * parse deflated block.
	 */
	parseBlock() {
		let hdr = this.readBits(3);
		if (hdr & 0x1) this.bfinal = true; // BFINAL
		hdr >>>= 1; // BTYPE
		switch (hdr) {
			case 0:
				this.parseUncompressedBlock(); // uncompressed
				break;
			case 1:
				this.parseFixedHuffmanBlock(); // fixed huffman
				break;
			case 2:
				this.parseDynamicHuffmanBlock(); // dynamic huffman
				break;
			default:
				throw new Error(`unknown BTYPE: ${hdr}`); // reserved or other
		}
	}
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
		if (ip + ((length - bitsbuflen + 7) >> 3) >= input.length) throw new Error('input buffer is broken'); // input byte
		while (bitsbuflen < length) {
			bitsbuf |= input[ip++] << bitsbuflen; // not enough buffer
			bitsbuflen += 8;
		}
		const octet = bitsbuf & /* MASK */ ((1 << length) - 1); //input and output byte.// output byte
		bitsbuf >>>= length;
		bitsbuflen -= length;
		this.bitsbuf = bitsbuf;
		this.bitsbuflen = bitsbuflen;
		this.ip = ip;
		return octet;
	}
	/**
	 * read huffman code using table
	 * @param {!(Uint8Array|Uint16Array)} table huffman code table.
	 * @return {number} huffman code.
	 */
	readCodeByTable(table) {
		let bitsbuf = this.bitsbuf;
		let bitsbuflen = this.bitsbuflen;
		const input = this.input;
		let ip = this.ip;
		const inputLength = input.length;
		/** @type {!(Uint8Array)} huffman code table */
		const codeTable = table[0];
		const maxCodeLength = table[1];
		while (bitsbuflen < maxCodeLength) {
			if (ip >= inputLength) break; // not enough buffer
			bitsbuf |= input[ip++] << bitsbuflen;
			bitsbuflen += 8;
		}
		const codeWithLength = codeTable[bitsbuf & ((1 << maxCodeLength) - 1)]; //code length & code (16bit, 16bit) // read max length
		const codeLength = codeWithLength >>> 16; //code bits length
		if (codeLength > bitsbuflen) throw new Error(`invalid code length: ${codeLength}`);
		this.bitsbuf = bitsbuf >> codeLength;
		this.bitsbuflen = bitsbuflen - codeLength;
		this.ip = ip;
		return codeWithLength & 0xffff;
	}
	/**
	 * parse uncompressed block.
	 */
	parseUncompressedBlock() {
		const input = this.input;
		let ip = this.ip;
		let output = this.output;
		let op = this.op;
		const inputLength = input.length;
		const olength = output.length; //output buffer length
		this.bitsbuf = 0; // skip buffered header bits
		this.bitsbuflen = 0;
		if (ip + 1 >= inputLength) throw new Error('invalid uncompressed block header: LEN');
		let len = input[ip++] | (input[ip++] << 8); // len block length
		if (ip + 1 >= inputLength) throw new Error('invalid uncompressed block header: NLEN');
		const nlen = input[ip++] | (input[ip++] << 8); // nlen number for check block length
		if (len === ~nlen) throw new Error('invalid uncompressed block header: length verify'); // check len & nlen
		if (ip + len > input.length) throw new Error('input buffer is broken'); // check size
		switch (this.bufferType) {
			case RawInflate.BufferType.BLOCK: // pre copy
				while (op + len > output.length) {
					const preCopy = olength - op; //copy counter
					len -= preCopy;
					output.set(input.subarray(ip, ip + preCopy), op);
					op += preCopy;
					ip += preCopy;
					this.op = op;
					output = this.expandBufferBlock(); // expand buffer
					op = this.op;
				}
				break;
			case RawInflate.BufferType.ADAPTIVE:
				while (op + len > output.length) output = this.expandBufferAdaptive({ fixRatio: 2 });
				break;
			default:
				throw new Error('invalid inflate mode');
		}
		output.set(input.subarray(ip, ip + len), op); // copy
		op += len;
		ip += len;
		this.ip = ip;
		this.op = op;
		this.output = output;
	}
	/**
	 * parse fixed huffman block.
	 */
	parseFixedHuffmanBlock() {
		switch (this.bufferType) {
			case RawInflate.BufferType.ADAPTIVE:
				this.decodeHuffmanAdaptive(RawInflate.FixedLiteralLengthTable, RawInflate.FixedDistanceTable);
				break;
			case RawInflate.BufferType.BLOCK:
				this.decodeHuffmanBlock(RawInflate.FixedLiteralLengthTable, RawInflate.FixedDistanceTable);
				break;
			default:
				throw new Error('invalid inflate mode');
		}
	}
	/**
	 * parse dynamic huffman block.
	 */
	parseDynamicHuffmanBlock() {
		/** @type {number} number of literal and length codes. */
		const hlit = this.readBits(5) + 257;
		/** @type {number} number of distance codes. */
		const hdist = this.readBits(5) + 1;
		/** @type {number} number of code lengths. */
		const hclen = this.readBits(4) + 4;
		/** @type {!(Uint8Array)} code lengths. */
		const codeLengths = new Uint8Array(RawInflate.Order.length);
		/** @type {number} */
		let prev;
		/** @type {number} */
		let repeat;
		for (let i = 0; i < hclen; ++i) codeLengths[RawInflate.Order[i]] = this.readBits(3); // decode code lengths
		const codeLengthsTable = Huffman.buildHuffmanTable(codeLengths); //code lengths table. decode length table
		const lengthTable = new Uint8Array(hlit + hdist); //code length table.
		for (let i = 0, il = hlit + hdist; i < il; ) {
			const code = this.readCodeByTable(codeLengthsTable);
			switch (code) {
				case 16:
					repeat = 3 + this.readBits(2);
					while (repeat--) lengthTable[i++] = prev;
					break;
				case 17:
					repeat = 3 + this.readBits(3);
					while (repeat--) lengthTable[i++] = 0;
					prev = 0;
					break;
				case 18:
					repeat = 11 + this.readBits(7);
					while (repeat--) lengthTable[i++] = 0;
					prev = 0;
					break;
				default:
					lengthTable[i++] = code;
					prev = code;
					break;
			}
		}
		const litlenTable = Huffman.buildHuffmanTable(lengthTable.subarray(0, hlit)); //literal and length code table.
		const distTable = Huffman.buildHuffmanTable(lengthTable.subarray(hlit)); //distance code table.
		switch (this.bufferType) {
			case RawInflate.BufferType.ADAPTIVE:
				this.decodeHuffmanAdaptive(litlenTable, distTable);
				break;
			case RawInflate.BufferType.BLOCK:
				this.decodeHuffmanBlock(litlenTable, distTable);
				break;
			default:
				throw new Error('invalid inflate mode');
		}
	}
	/**
	 * decode huffman code
	 * @param {!(Uint16Array)} litlen literal and length code table.
	 * @param {!(Uint8Array)} dist distination code table.
	 */
	decodeHuffmanBlock(litlen, dist) {
		let output = this.output;
		let op = this.op;
		this.currentLitlenTable = litlen;
		const olength = output.length - RawInflate.MaxCopyLength; //output position limit.
		let code; //huffman code.
		const lengthCodeTable = RawInflate.LengthCodeTable;
		const lengthExtraTable = RawInflate.LengthExtraTable;
		const distCodeTable = RawInflate.DistCodeTable;
		const distExtraTable = RawInflate.DistExtraTable;
		while ((code = this.readCodeByTable(litlen)) !== 256) {
			if (code < 256) {
				if (op >= olength) {
					this.op = op; // literal
					output = this.expandBufferBlock();
					op = this.op;
				}
				output[op++] = code;
				continue;
			}
			const ti = code - 257; // length code
			let codeLength = lengthCodeTable[ti]; //huffman code length.
			if (lengthExtraTable[ti] > 0) codeLength += this.readBits(lengthExtraTable[ti]);
			code = this.readCodeByTable(dist); // dist code
			let codeDist = distCodeTable[code]; //huffman code distination.
			if (distExtraTable[code] > 0) codeDist += this.readBits(distExtraTable[code]);
			if (op >= olength) {
				this.op = op; // lz77 decode
				output = this.expandBufferBlock();
				op = this.op;
			}
			while (codeLength--) output[op] = output[op++ - codeDist];
		}
		while (this.bitsbuflen >= 8) {
			this.bitsbuflen -= 8;
			this.ip--;
		}
		this.op = op;
	}
	/**
	 * decode huffman code (adaptive)
	 * @param {!(Uint16Array)} litlen literal and length code table.
	 * @param {!(Uint8Array)} dist distination code table.
	 */
	decodeHuffmanAdaptive(litlen, dist) {
		let output = this.output;
		let op = this.op;
		this.currentLitlenTable = litlen;
		let olength = output.length; //output position limit.
		let code; //huffman code.
		const lengthCodeTable = RawInflate.LengthCodeTable;
		const lengthExtraTable = RawInflate.LengthExtraTable;
		const distCodeTable = RawInflate.DistCodeTable;
		const distExtraTable = RawInflate.DistExtraTable;
		while ((code = this.readCodeByTable(litlen)) !== 256) {
			if (code < 256) {
				if (op >= olength) {
					output = this.expandBufferAdaptive(); // literal
					olength = output.length;
				}
				output[op++] = code;
				continue;
			}
			const ti = code - 257; // length code
			let codeLength = lengthCodeTable[ti]; //huffman code length.
			if (lengthExtraTable[ti] > 0) codeLength += this.readBits(lengthExtraTable[ti]);
			code = this.readCodeByTable(dist); // dist code
			let codeDist = distCodeTable[code]; //huffman code distination.
			if (distExtraTable[code] > 0) codeDist += this.readBits(distExtraTable[code]);
			if (op + codeLength > olength) {
				output = this.expandBufferAdaptive(); // lz77 decode
				olength = output.length;
			}
			while (codeLength--) output[op] = output[op++ - codeDist];
		}
		while (this.bitsbuflen >= 8) {
			this.bitsbuflen -= 8;
			this.ip--;
		}
		this.op = op;
	}
	/**
	 * expand output buffer.
	 * @param {Object=} opt_param option parameters.
	 * @return {!(Uint8Array)} output buffer.
	 */
	expandBufferBlock() {
		const backward = this.op - RawInflate.MaxBackwardLength; //backward base point
		const buffer = new Uint8Array(backward); //store buffer.
		const output = this.output;
		buffer.set(output.subarray(RawInflate.MaxBackwardLength, buffer.length)); // copy to output buffer
		this.blocks.push(buffer);
		this.totalpos += buffer.length;
		output.set(output.subarray(backward, backward + RawInflate.MaxBackwardLength)); // copy to backward buffer
		this.op = RawInflate.MaxBackwardLength;
		return output;
	}
	/**
	 * expand output buffer. (adaptive)
	 * @param {Object=} opt_param option parameters.
	 * @return {!(Uint8Array)} output buffer pointer.
	 */
	expandBufferAdaptive(opt_param) {
		let ratio = (this.input.length / this.ip + 1) | 0; //expantion ratio.
		let newSize; //new output buffer size.
		const input = this.input;
		const output = this.output;
		if (opt_param) {
			if (typeof opt_param.fixRatio === 'number') ratio = opt_param.fixRatio;
			if (typeof opt_param.addRatio === 'number') ratio += opt_param.addRatio;
		}
		if (ratio < 2) {
			const maxHuffCode = (input.length - this.ip) / this.currentLitlenTable[2]; // calculate new buffer size //maximum number of huffman code.
			const maxInflateSize = ((maxHuffCode / 2) * 258) | 0; //max inflate size.
			newSize = maxInflateSize < output.length ? output.length + maxInflateSize : output.length << 1;
		} else newSize = output.length * ratio;
		const buffer = new Uint8Array(newSize); // buffer expantion //store buffer.
		buffer.set(output);
		this.output = buffer;
		return this.output;
	}
	/**
	 * concat output buffer.
	 * @return {!(Uint8Array)} output buffer.
	 */
	concatBufferBlock() {
		let pos = 0; //buffer pointer.
		const limit = this.totalpos + (this.op - RawInflate.MaxBackwardLength); //buffer pointer.
		const output = this.output; //output block array.
		const blocks = this.blocks; //blocks array.
		const buffer = new Uint8Array(limit); //output buffer.
		if (blocks.length === 0) return output.subarray(RawInflate.MaxBackwardLength, this.op); // single buffer
		for (const block of blocks) for (let j = 0, jl = block.length; j < jl; ++j) buffer[pos++] = block[j]; // copy to buffer
		for (let i = RawInflate.MaxBackwardLength, il = this.op; i < il; ++i) buffer[pos++] = output[i]; // current buffer
		this.blocks = [];
		this.buffer = buffer;
		return this.buffer;
	}
	/**
	 * concat output buffer. (dynamic)
	 * @return {!(Uint8Array)} output buffer.
	 */
	concatBufferDynamic() {
		let buffer; //output buffer.
		const op = this.op;
		if (this.resize) {
			buffer = new Uint8Array(op);
			buffer.set(this.output.subarray(0, op));
		} else buffer = this.output.subarray(0, op);
		this.buffer = buffer;
		return this.buffer;
	}
}
