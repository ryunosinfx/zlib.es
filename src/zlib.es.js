/**
 * @fileoverview Zlib namespace. Zlib の仕様に準拠した圧縮は Zlib.Deflate で実装
 * されている. これは Inflate との共存を考慮している為.
 */
/** @define {boolean} */
const ZLIB_CRC32_COMPACT = false;
const MAX_FIREFOX_SIZE = 8589934592;
/**
 * @fileoverview 雑多な関数群をまとめたモジュール実装.
 */
class ZU {
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
	static Err = (m) => {
		// console.error(m);
		throw new Error(m);
	};
	static a = (n) => new Array(n);
	static u8 = (n) => new Uint8Array(n);
	static u16 = (n) => new Uint16Array(n);
	static u32 = (n) => new Uint32Array(n);
}
/**
 * Compression Method
 * @enum {number}
 */
export class Zlib {
	/**
	 * @enum {number}
	 */
	static CompressionMethod = {
		STORE: 0,
		DEFLATE: 8,
		RESERVED: 15,
	};
}
class FileHeader {
	/**
	 * @param {!(Uint8Array)} input input buffer.
	 * @param {number} ip input position.
	 * @constructor
	 */
	constructor(input, ip) {
		this.input = /** @type {!(Uint8Array)} */ input;
		this.offset = /** @type {number} */ ip;
		this.parse();
	}
	parse() {
		const input = this.input,
			FS = Unzip.FileHeaderSignature;
		let ip = this.offset;
		if (input[ip++] !== FS[0] || input[ip++] !== FS[1] || input[ip++] !== FS[2] || input[ip++] !== FS[3])
			ZU.Err('invalid file header signature'); // central file header signature
		this.version = input[ip++]; // version made by
		this.os = input[ip++];
		this.needVersion = input[ip++] | (input[ip++] << 8); // version needed to extract
		this.flags = input[ip++] | (input[ip++] << 8); // general purpose bit flag
		this.compression = input[ip++] | (input[ip++] << 8); // compression method
		this.time = input[ip++] | (input[ip++] << 8); // last mod file time
		this.date = input[ip++] | (input[ip++] << 8); //last mod file date
		this.crc32 = (input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24)) >>> 0; // crc-32
		this.compressedSize = (input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24)) >>> 0; // compressed size
		this.plainSize = (input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24)) >>> 0; // uncompressed size
		this.fileNameLength = input[ip++] | (input[ip++] << 8); // file name length
		this.extraFieldLength = input[ip++] | (input[ip++] << 8); // extra field length
		this.fileCommentLength = input[ip++] | (input[ip++] << 8); // file comment length
		this.diskNumberStart = input[ip++] | (input[ip++] << 8); // disk number start
		this.internalFileAttributes = input[ip++] | (input[ip++] << 8); // internal file attributes
		this.externalFileAttributes = input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24); // external file attributes
		this.relativeOffset = (input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24)) >>> 0; // relative offset of local header
		this.filename = String.fromCharCode.apply(null, input.subarray(ip, (ip += this.fileNameLength))); // file name
		this.extraField = input.subarray(ip, (ip += this.extraFieldLength)); // extra field
		this.comment = input.subarray(ip, ip + this.fileCommentLength); // file comment
		this.length = ip - this.offset;
	}
}
/**
 * @fileoverview Adler32 checksum 実装.
 */
class Adler32 {
	/**
	 * Adler32 ハッシュ値の作成
	 * @param {!(Uint8Array|string)} array 算出に使用する byte array.
	 * @return {number} Adler32 ハッシュ値.
	 */
	static mkHash = (array) => Adler32.update(1, typeof array === 'string' ? ZU.stringToByteArray(array) : array);
	/**
	 * Adler32 ハッシュ値の更新
	 * @param {number} adler 現在のハッシュ値.
	 * @param {!(Uint8Array)} array 更新に使用する byte array.
	 * @return {number} Adler32 ハッシュ値.
	 */
	static update(adler, array) {
		let s1 = /** @type {number} */ adler & 0xffff,
			s2 = /** @type {number} */ (adler >>> 16) & 0xffff,
			len = /** @type {number} array length */ array.length,
			i = /** @type {number} array index */ 0;
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

/**
 * @fileoverview bit 単位での書き込み実装.
 */
/**
 * ビットストリーム
 * @constructor
 * @param {!(Uint8Array)=} buffer output buffer.
 * @param {number=} bufferPosition start buffer pointer.
 */
class BitStream {
	/**
	 * デフォルトブロックサイズ.
	 * @const
	 * @type {number}
	 */
	static DefaultBlockSize = 0x8000;
	constructor(buffer, bufferPosition) {
		this.index = /** @type {number} buffer index. */ typeof bufferPosition === 'number' ? bufferPosition : 0;
		this.bitindex = /** @type {number} bit index. */ 0;
		/** @type {!(Uint8Array)} bit-stream output buffer. */
		this.buffer = buffer instanceof Uint8Array ? buffer : ZU.u8(BitStream.DefaultBlockSize);
		// 入力された index が足りなかったら拡張するが、倍にしてもダメなら不正とする
		if (this.buffer.length * 2 <= this.index) ZU.Err('invalid index');
		else if (this.buffer.length <= this.index) this.expandBuffer();
	}
	/**
	 * expand buffer.
	 * @return {!(Uint8Array)} new buffer.
	 */
	expandBuffer() {
		const oldbuf = /** @type {!(Uint8Array)} old buffer. */ this.buffer,
			buffer = /** @type {!(Uint8Array)} new buffer. */ ZU.u8(oldbuf.length << 1);
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
		let buf = this.buffer,
			idx = this.index,
			bitindex = this.bitindex,
			current = /** @type {number} current octet. */ buf[idx];
		if (reverse && n > 1)
			number = n > 8 ? BitStream.rev32_(number) >> (32 - n) : BitStream.ReverseTable[number] >> (8 - n);
		if (n + bitindex < 8) {
			current = (current << n) | number; // Byte 境界を超えないとき
			bitindex += n;
		} else {
			for (let i = 0; i < n; ++i) {
				current = (current << 1) | ((number >> (n - i - 1)) & 1); // Byte 境界を超えるとき
				if (++bitindex === 8) {
					bitindex = 0; // next byte
					buf[idx++] = BitStream.ReverseTable[current];
					current = 0;
					if (idx === buf.length) buf = this.expandBuffer(); // expand
				}
			}
		}
		buf[idx] = current;
		this.buffer = buf;
		this.bitindex = bitindex;
		this.index = idx;
	}
	/**
	 * 32-bit 整数のビット順を逆にする
	 * @param {number} n 32-bit integer.
	 * @return {number} reversed 32-bit integer.
	 * @private
	 */
	static rev32_(n) {
		const RT = BitStream.ReverseTable;
		return (
			(RT[n & 0xff] << 24) | (RT[(n >>> 8) & 0xff] << 16) | (RT[(n >>> 16) & 0xff] << 8) | RT[(n >>> 24) & 0xff]
		);
	}
	/**
	 * ストリームの終端処理を行う
	 * @return {!(Uint8Array)} 終端処理後のバッファを byte array で返す.
	 */
	finish() {
		const buf = this.buffer;
		let i = this.index;
		if (this.bitindex > 0) {
			buf[i] <<= 8 - this.bitindex; // bitindex が 0 の時は余分に index が進んでいる状態
			buf[i] = BitStream.ReverseTable[buf[i]];
			i++;
		}
		return buf.subarray(0, i); // array truncation;
	}
	static buildReverseTable() {
		const t = /** @type {!(Uint8Array)} reverse table. */ ZU.u8(256),
			func = (n) => {
				let r = n,
					s = 7;
				for (n >>>= 1; n; n >>>= 1) {
					r <<= 1;
					r |= n & 1;
					--s;
				}
				return ((r << s) & 0xff) >>> 0;
			};
		for (let i = 0; i < 256; ++i) t[i] = func(i); // generate
		return t;
	}
	/**
	 * 0-255 のビット順を反転したテーブル
	 * @const
	 * @type {!(Uint8Array.<number>)}
	 */
	static ReverseTable = (() => BitStream.buildReverseTable())();
}
/**
 * @fileoverview CRC32 実装.
 */
class CRC32 {
	/**
	 * CRC32 ハッシュ値を取得
	 * @param {!(Uint8Array)} data data byte array.
	 * @param {number=} pos data position.
	 * @param {number=} length data length.
	 * @return {number} CRC32.
	 */
	static calc = (data, pos, length) => CRC32.update(data, 0, pos, length);
	/**
	 * CRC32ハッシュ値を更新
	 * @param {!(Uint8Array)} data data byte array.
	 * @param {number} crc CRC32.
	 * @param {number=} pos data position.
	 * @param {number=} length data length.
	 * @return {number} CRC32.
	 */
	static update(data, crc, pos, length) {
		const t = CRC32.Table,
			il = typeof length === 'number' ? length : data.length;
		let i = typeof pos === 'number' ? pos : (pos = 0);
		crc ^= 0xffffffff;
		for (i = il & 7; i--; ++pos) crc = (crc >>> 8) ^ t[(crc ^ data[pos]) & 0xff]; // loop unrolling for performance
		for (i = il >> 3; i--; pos += 8) {
			crc = (crc >>> 8) ^ t[(crc ^ data[pos]) & 0xff];
			crc = (crc >>> 8) ^ t[(crc ^ data[pos + 1]) & 0xff];
			crc = (crc >>> 8) ^ t[(crc ^ data[pos + 2]) & 0xff];
			crc = (crc >>> 8) ^ t[(crc ^ data[pos + 3]) & 0xff];
			crc = (crc >>> 8) ^ t[(crc ^ data[pos + 4]) & 0xff];
			crc = (crc >>> 8) ^ t[(crc ^ data[pos + 5]) & 0xff];
			crc = (crc >>> 8) ^ t[(crc ^ data[pos + 6]) & 0xff];
			crc = (crc >>> 8) ^ t[(crc ^ data[pos + 7]) & 0xff];
		}
		return (crc ^ 0xffffffff) >>> 0;
	}
	/**
	 * @param {number} num
	 * @param {number} crc
	 * @returns {number}
	 */
	static single = (num, crc) => (CRC32.Table[(num ^ crc) & 0xff] ^ (num >>> 8)) >>> 0;
	/**
	 * @type {Array.<number>}
	 * @const
	 * @private
	 */
	static Table_ = [
		0x00000000, 0x77073096, 0xee0e612c, 0x990951ba, 0x076dc419, 0x706af48f, 0xe963a535, 0x9e6495a3, 0x0edb8832,
		0x79dcb8a4, 0xe0d5e91e, 0x97d2d988, 0x09b64c2b, 0x7eb17cbd, 0xe7b82d07, 0x90bf1d91, 0x1db71064, 0x6ab020f2,
		0xf3b97148, 0x84be41de, 0x1adad47d, 0x6ddde4eb, 0xf4d4b551, 0x83d385c7, 0x136c9856, 0x646ba8c0, 0xfd62f97a,
		0x8a65c9ec, 0x14015c4f, 0x63066cd9, 0xfa0f3d63, 0x8d080df5, 0x3b6e20c8, 0x4c69105e, 0xd56041e4, 0xa2677172,
		0x3c03e4d1, 0x4b04d447, 0xd20d85fd, 0xa50ab56b, 0x35b5a8fa, 0x42b2986c, 0xdbbbc9d6, 0xacbcf940, 0x32d86ce3,
		0x45df5c75, 0xdcd60dcf, 0xabd13d59, 0x26d930ac, 0x51de003a, 0xc8d75180, 0xbfd06116, 0x21b4f4b5, 0x56b3c423,
		0xcfba9599, 0xb8bda50f, 0x2802b89e, 0x5f058808, 0xc60cd9b2, 0xb10be924, 0x2f6f7c87, 0x58684c11, 0xc1611dab,
		0xb6662d3d, 0x76dc4190, 0x01db7106, 0x98d220bc, 0xefd5102a, 0x71b18589, 0x06b6b51f, 0x9fbfe4a5, 0xe8b8d433,
		0x7807c9a2, 0x0f00f934, 0x9609a88e, 0xe10e9818, 0x7f6a0dbb, 0x086d3d2d, 0x91646c97, 0xe6635c01, 0x6b6b51f4,
		0x1c6c6162, 0x856530d8, 0xf262004e, 0x6c0695ed, 0x1b01a57b, 0x8208f4c1, 0xf50fc457, 0x65b0d9c6, 0x12b7e950,
		0x8bbeb8ea, 0xfcb9887c, 0x62dd1ddf, 0x15da2d49, 0x8cd37cf3, 0xfbd44c65, 0x4db26158, 0x3ab551ce, 0xa3bc0074,
		0xd4bb30e2, 0x4adfa541, 0x3dd895d7, 0xa4d1c46d, 0xd3d6f4fb, 0x4369e96a, 0x346ed9fc, 0xad678846, 0xda60b8d0,
		0x44042d73, 0x33031de5, 0xaa0a4c5f, 0xdd0d7cc9, 0x5005713c, 0x270241aa, 0xbe0b1010, 0xc90c2086, 0x5768b525,
		0x206f85b3, 0xb966d409, 0xce61e49f, 0x5edef90e, 0x29d9c998, 0xb0d09822, 0xc7d7a8b4, 0x59b33d17, 0x2eb40d81,
		0xb7bd5c3b, 0xc0ba6cad, 0xedb88320, 0x9abfb3b6, 0x03b6e20c, 0x74b1d29a, 0xead54739, 0x9dd277af, 0x04db2615,
		0x73dc1683, 0xe3630b12, 0x94643b84, 0x0d6d6a3e, 0x7a6a5aa8, 0xe40ecf0b, 0x9309ff9d, 0x0a00ae27, 0x7d079eb1,
		0xf00f9344, 0x8708a3d2, 0x1e01f268, 0x6906c2fe, 0xf762575d, 0x806567cb, 0x196c3671, 0x6e6b06e7, 0xfed41b76,
		0x89d32be0, 0x10da7a5a, 0x67dd4acc, 0xf9b9df6f, 0x8ebeeff9, 0x17b7be43, 0x60b08ed5, 0xd6d6a3e8, 0xa1d1937e,
		0x38d8c2c4, 0x4fdff252, 0xd1bb67f1, 0xa6bc5767, 0x3fb506dd, 0x48b2364b, 0xd80d2bda, 0xaf0a1b4c, 0x36034af6,
		0x41047a60, 0xdf60efc3, 0xa867df55, 0x316e8eef, 0x4669be79, 0xcb61b38c, 0xbc66831a, 0x256fd2a0, 0x5268e236,
		0xcc0c7795, 0xbb0b4703, 0x220216b9, 0x5505262f, 0xc5ba3bbe, 0xb2bd0b28, 0x2bb45a92, 0x5cb36a04, 0xc2d7ffa7,
		0xb5d0cf31, 0x2cd99e8b, 0x5bdeae1d, 0x9b64c2b0, 0xec63f226, 0x756aa39c, 0x026d930a, 0x9c0906a9, 0xeb0e363f,
		0x72076785, 0x05005713, 0x95bf4a82, 0xe2b87a14, 0x7bb12bae, 0x0cb61b38, 0x92d28e9b, 0xe5d5be0d, 0x7cdcefb7,
		0x0bdbdf21, 0x86d3d2d4, 0xf1d4e242, 0x68ddb3f8, 0x1fda836e, 0x81be16cd, 0xf6b9265b, 0x6fb077e1, 0x18b74777,
		0x88085ae6, 0xff0f6a70, 0x66063bca, 0x11010b5c, 0x8f659eff, 0xf862ae69, 0x616bffd3, 0x166ccf45, 0xa00ae278,
		0xd70dd2ee, 0x4e048354, 0x3903b3c2, 0xa7672661, 0xd06016f7, 0x4969474d, 0x3e6e77db, 0xaed16a4a, 0xd9d65adc,
		0x40df0b66, 0x37d83bf0, 0xa9bcae53, 0xdebb9ec5, 0x47b2cf7f, 0x30b5ffe9, 0xbdbdf21c, 0xcabac28a, 0x53b39330,
		0x24b4a3a6, 0xbad03605, 0xcdd70693, 0x54de5729, 0x23d967bf, 0xb3667a2e, 0xc4614ab8, 0x5d681b02, 0x2a6f2b94,
		0xb40bbe37, 0xc30c8ea1, 0x5a05df1b, 0x2d02ef8d,
	];
	static buildCompactTable() {
		const t = /** @type {!(Uint32Array)} */ ZU.u32(256);
		for (let i = 0; i < 256; ++i) {
			let c = i;
			for (let j = 0; j < 8; ++j) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			t[i] = c >>> 0;
		}
		return t;
	}
	/**
	 * @type {!(Uint32Array)} CRC-32 Table.
	 * @const
	 */
	static Table = ZLIB_CRC32_COMPACT ? CRC32.buildCompactTable() : ZU.u32(CRC32.Table_);
}
/**
 * @fileoverview Heap Sort 実装. ハフマン符号化で使用する.
 */
class Heap {
	/**
	 * カスタムハフマン符号で使用するヒープ実装
	 * @param {number} length ヒープサイズ.
	 * @constructor
	 */
	constructor(length) {
		this.buffer = ZU.u16(length * 2);
		this.length = 0;
	}
	/**
	 * 親ノードの index 取得
	 * @param {number} index 子ノードの index.
	 * @return {number} 親ノードの index.
	 *
	 */
	static getParent = (index) => (((index - 2) / 4) | 0) * 2;
	/**
	 * 子ノードの index 取得
	 * @param {number} index 親ノードの index.
	 * @return {number} 子ノードの index.
	 */
	static getChild = (index) => 2 * index + 2;
	/**
	 * Heap に値を追加する
	 * @param {number} index キー index.
	 * @param {number} value 値.
	 * @return {number} 現在のヒープ長.
	 */
	push(index, value) {
		const heap = this.buffer; // ルートノードにたどり着くまで入れ替えを試みる
		let current = this.length;
		heap[this.length++] = value;
		heap[this.length++] = index;
		while (current > 0) {
			const parent = Heap.getParent(current); // 親ノードと比較して親の方が小さければ入れ替える
			if (heap[current] > heap[parent]) {
				const swap1 = heap[current];
				heap[current] = heap[parent];
				heap[parent] = swap1;
				const swap2 = heap[current + 1];
				heap[current + 1] = heap[parent + 1];
				heap[parent + 1] = swap2;
				current = parent;
			} else break; // 入れ替えが必要なくなったらそこで抜ける
		}
		return this.length;
	}
	/**
	 * Heapから一番大きい値を返す
	 * @return {{index: number, value: number, length: number}} {index: キーindex,
	 *     value: 値, length: ヒープ長} の Object.
	 */
	pop() {
		const heap = this.buffer,
			value = heap[0],
			idx = heap[1];
		this.length -= 2; // 後ろから値を取る
		heap[0] = heap[this.length];
		heap[1] = heap[this.length + 1];
		let parent = 0; // ルートノードから下がっていく
		while (heap) {
			let current = Heap.getChild(parent);
			if (current >= this.length) break; // 範囲チェック
			if (current + 2 < this.length && heap[current + 2] > heap[current]) current += 2; // 隣のノードと比較して、隣の方が値が大きければ隣を現在ノードとして選択
			if (heap[current] > heap[parent]) {
				const swap1 = heap[parent]; // 親ノードと比較して親の方が小さい場合は入れ替える
				heap[parent] = heap[current];
				heap[current] = swap1;
				const swap2 = heap[parent + 1];
				heap[parent + 1] = heap[current + 1];
				heap[current + 1] = swap2;
			} else break;
			parent = current;
		}
		return { index: idx, value, length: this.length };
	}
}
class Huffman {
	/**
	 * build huffman table from length list.
	 * @param {!(Uint8Array)} lengths length list.
	 * @return {!Array} huffman table.
	 */
	static buildHuffmanTable(lengths) {
		const listSize = /** @type {number} length list size. */ lengths.length;
		let maxCodeLength = /** @type {number} max code length for table size. */ 0,
			minCodeLength = /** @type {number} min code length for table size. */ Number.POSITIVE_INFINITY;
		for (const length of lengths) {
			if (length > maxCodeLength) maxCodeLength = length; // Math.max は遅いので最長の値は for-loop で取得する
			if (length < minCodeLength) minCodeLength = length;
		}
		const size = 1 << maxCodeLength, //table size.
			t = ZU.u32(size); //huffman code table.
		// ビット長の短い順からハフマン符号を割り当てる
		for (let bitLength = 1, code = 0, skip = 2; bitLength <= maxCodeLength; ) {
			for (let i = 0; i < listSize; ++i)
				if (lengths[i] === bitLength) {
					let reversed = 0; //reversed code.// ビットオーダーが逆になるためビット長分並びを反転する
					for (let rtemp = code, j = 0; j < bitLength; ++j) {
						reversed = (reversed << 1) | (rtemp & 1);
						rtemp >>= 1; //reverse temp.
					}
					// 最大ビット長をもとにテーブルを作るため、
					// 最大ビット長以外では 0 / 1 どちらでも良い箇所ができる
					// そのどちらでも良い場所は同じ値で埋めることで
					// 本来のビット長以上のビット数取得しても問題が起こらないようにする
					const v = (bitLength << 16) | i;
					for (let j = reversed; j < size; j += skip) t[j] = v;
					++code;
				}
			++bitLength; //bit length.// 次のビット長へ
			code <<= 1; //huffman code.
			skip <<= 1; //サイズが 2^maxlength 個のテーブルを埋めるためのスキップ長.
		}
		return [t, maxCodeLength, minCodeLength];
	}
}
/**
 * @fileoverview Deflate (RFC1951) 符号化アルゴリズム実装.
 */
class RawDeflate {
	static CompressionType = {
		NONE: 0,
		FIXED: 1,
		DYNAMIC: 2,
		RESERVED: 3,
	};
	/**
	 * LZ77 の最小マッチ長
	 * @const
	 * @type {number}
	 */
	static Lz77MinLength = 3;
	/**
	 * LZ77 の最大マッチ長
	 * @const
	 * @type {number}
	 */
	static Lz77MaxLength = 258;
	/**dynamic random data
	 * LZ77 のウィンドウサイズ
	 * @const
	 * @type {number}
	 */
	static WindowSize = 0x8000;
	/**
	 * 最長の符号長
	 * @const
	 * @type {number}
	 */
	static MaxCodeLength = 16;
	/**
	 * ハフマン符号の最大数値
	 * @const
	 * @type {number}
	 */
	static HUFMAX = 286;
	/**
	 * 固定ハフマン符号の符号化テーブル
	 * @const
	 * @type {Array.<Array.<number, number>>}
	 */
	static FixedHuffmanTable = (function () {
		const t = [];
		for (let i = 0; i < 288; i++)
			switch (true) {
				case i <= 143:
					t.push([i + 0x030, 8]);
					break;
				case i <= 255:
					t.push([i - 144 + 0x190, 9]);
					break;
				case i <= 279:
					t.push([i - 256 + 0x000, 7]);
					break;
				case i <= 287:
					t.push([i - 280 + 0x0c0, 8]);
					break;
				default:
					ZU.Err(`invalid literal: ${i}`);
			}
		return t;
	})();
	/**
	 * Raw Deflate 実装
	 *
	 * @constructor
	 * @param {!(Uint8Array)} input 符号化する対象のバッファ.
	 * @param {Object=} opt_params option parameters.
	 *
	 * typed array が使用可能なとき、outputBuffer が Array は自動的に Uint8Array に
	 * 変換されます.
	 * 別のオブジェクトになるため出力バッファを参照している変数などは
	 * 更新する必要があります.
	 */
	constructor(input, opt_params) {
		this.compressionType = /** @type {RawDeflate.CompressionType} */ RawDeflate.CompressionType.DYNAMIC;
		this.lazy = /** @type {number} */ 0;
		this.freqsLitLen = /** @type {!(Uint32Array)} */ void 0;
		this.freqsDist = /** @type {!(Uint32Array)} */ void 0;
		this.input = /** @type {!(Uint8Array)} */ input instanceof Array ? ZU.u8(input) : input;
		this.output = /** @type {!(Uint8Array)} output output buffer. */ void 0;
		this.op = /** @type {number} pos output buffer position. */ 0;
		if (opt_params) {
			if (opt_params.lazy) this.lazy = opt_params.lazy; // option parameters
			if (typeof opt_params.compressionType === 'number') this.compressionType = opt_params.compressionType;
			if (opt_params.outputBuffer)
				this.output =
					opt_params.outputBuffer instanceof Array ? ZU.u8(opt_params.outputBuffer) : opt_params.outputBuffer;
			if (typeof opt_params.outputIndex === 'number') this.op = opt_params.outputIndex;
		}
		if (!this.output) this.output = ZU.u8(0x8000);
	}
	/**
	 * DEFLATE ブロックの作成
	 * @return {!(Uint8Array)} 圧縮済み byte array.
	 */
	compress() {
		const input = this.input; // compression
		switch (this.compressionType) {
			case RawDeflate.CompressionType.NONE:
				for (let position = 0, length = input.length; position < length; ) {
					const blockArray = input.subarray(position, position + 0xffff); // each 65535-Byte (length header: 16-bit)
					position += blockArray.length;
					this.makeNocompressBlock(blockArray, position === length);
				}
				break;
			case RawDeflate.CompressionType.FIXED:
				this.output = this.makeFixedHuffmanBlock(input, true);
				this.op = this.output.length;
				break;
			case RawDeflate.CompressionType.DYNAMIC:
				this.output = this.makeDynamicHuffmanBlock(input, true);
				this.op = this.output.length;
				break;
			default:
				ZU.Err('invalid compression type');
		}
		return this.output;
	}
	/**
	 * 非圧縮ブロックの作成
	 * @param {!(Uint8Array)} blockArray ブロックデータ byte array.
	 * @param {!boolean} isFinalBlock 最後のブロックならばtrue.
	 * @return {!(Uint8Array)} 非圧縮ブロック byte array.
	 */
	makeNocompressBlock(blockArray, isFinalBlock) {
		let op = this.op,
			byteLength = this.output.buffer.byteLength;
		const terget = op + blockArray.length + 5;
		while (byteLength <= terget) byteLength = byteLength << 1; // expand buffer
		const o = ZU.u8(byteLength),
			bfinal = isFinalBlock ? 1 : 0, // header
			btype = RawDeflate.CompressionType.NONE,
			len = blockArray.length, // length
			nlen = (~len + 0x10000) & 0xffff;
		o.set(this.output);
		o[op++] = bfinal | (btype << 1);
		o[op++] = len & 0xff;
		o[op++] = (len >>> 8) & 0xff;
		o[op++] = nlen & 0xff;
		o[op++] = (nlen >>> 8) & 0xff;
		o.set(blockArray, op); // copy buffer
		op += blockArray.length;
		const subarray = o.subarray(0, op);
		this.op = op;
		this.output = subarray;
		return subarray;
	}
	/**
	 * 固定ハフマンブロックの作成
	 * @param {!(Uint8Array)} blockArray ブロックデータ byte array.
	 * @param {!boolean} isFinalBlock 最後のブロックならばtrue.
	 * @return {!(Uint8Array)} 固定ハフマン符号化ブロック byte array.
	 */
	makeFixedHuffmanBlock(blockArray, isFinalBlock) {
		const stream = new BitStream(ZU.u8(this.output.buffer), this.op),
			bfinal = isFinalBlock ? 1 : 0, // header
			btype = RawDeflate.CompressionType.FIXED;
		stream.writeBits(bfinal, 1, true);
		stream.writeBits(btype, 2, true);
		const data = this.lz77(blockArray);
		RawDeflate.fixedHuffman(data, stream);
		return stream.finish();
	}
	/**
	 * 動的ハフマンブロックの作成
	 * @param {!(Uint8Array)} blockArray ブロックデータ byte array.
	 * @param {!boolean} isFinalBlock 最後のブロックならばtrue.
	 * @return {!(Uint8Array)} 動的ハフマン符号ブロック byte array.
	 */
	makeDynamicHuffmanBlock(blockArray, isFinalBlock) {
		let hlit = /** @type {number} */ 0,
			hdist = /** @type {number} */ 0,
			hclen = /** @type {number} */ 0;
		const stream = new BitStream(ZU.u8(this.output.buffer), this.op),
			hclenOrder = /** @const @type {Array.<number>} */ [
				16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
			],
			bfinal = isFinalBlock ? 1 : 0, // header
			transLengths = /** @type {Array} */ ZU.a(19),
			btype = RawDeflate.CompressionType.DYNAMIC;
		stream.writeBits(bfinal, 1, true);
		stream.writeBits(btype, 2, true);
		const data = this.lz77(blockArray),
			litLenLengths = RawDeflate.getLengths_(this.freqsLitLen, 15), // リテラル・長さ, 距離のハフマン符号と符号長の算出
			litLenCodes = RawDeflate.getCodesFromLengths_(litLenLengths),
			distLengths = RawDeflate.getLengths_(this.freqsDist, 7),
			distCodes = RawDeflate.getCodesFromLengths_(distLengths);
		for (hlit = 286; hlit > 257 && litLenLengths[hlit - 1] === 0; ) hlit--; // HLIT の決定
		for (hdist = 30; hdist > 1 && distLengths[hdist - 1] === 0; ) hdist--; // HDIST の決定
		/** @type {{
		 *   codes: !(Uint32Array),
		 *   freqs: !(Uint8Array)
		 * }} */
		const treeSymbols = RawDeflate.getTreeSymbols_(hlit, litLenLengths, hdist, distLengths), // HCLEN
			treeLengths = RawDeflate.getLengths_(treeSymbols.freqs, 7);
		for (let i = 0; i < 19; i++) transLengths[i] = treeLengths[hclenOrder[i]];
		for (hclen = 19; hclen > 4 && transLengths[hclen - 1] === 0; ) hclen--;
		const treeCodes = RawDeflate.getCodesFromLengths_(treeLengths);
		stream.writeBits(hlit - 257, 5, true); // 出力
		stream.writeBits(hdist - 1, 5, true);
		stream.writeBits(hclen - 4, 4, true);
		for (let i = 0; i < hclen; i++) stream.writeBits(transLengths[i], 3, true);
		const codes = treeSymbols.codes; // ツリーの出力
		for (let i = 0, il = codes.length; i < il; i++) {
			const code = codes[i];
			let bitlen = 0;
			stream.writeBits(treeCodes[code], treeLengths[code], true);
			if (code >= 16) {
				i++; // extra bits
				switch (code) {
					case 16:
						bitlen = 2;
						break;
					case 17:
						bitlen = 3;
						break;
					case 18:
						bitlen = 7;
						break;
					default:
						ZU.Err(`invalid code: ${code}`);
				}
				stream.writeBits(codes[i], bitlen, true);
			}
		}
		RawDeflate.dynamicHuffman(data, [litLenCodes, litLenLengths], [distCodes, distLengths], stream);
		return stream.finish();
	}
	/**
	 * 動的ハフマン符号化(カスタムハフマンテーブル)
	 * @param {!(Uint16Array)} dataArray LZ77 符号化済み byte array.
	 * @param {!BitStream} stream 書き込み用ビットストリーム.
	 * @return {!BitStream} ハフマン符号化済みビットストリームオブジェクト.
	 */
	static dynamicHuffman(dataArray, litLen, dist, stream) {
		const litLenCodes = litLen[0],
			litLenLengths = litLen[1],
			distCodes = dist[0],
			distLengths = dist[1];
		for (let i = 0, il = dataArray.length; i < il; ++i) {
			const literal = dataArray[i]; // 符号を BitStream に書き込んでいく
			stream.writeBits(litLenCodes[literal], litLenLengths[literal], true); // literal or length
			if (literal > 256) {
				stream.writeBits(dataArray[++i], dataArray[++i], true); // 長さ・距離符号// length extra
				const code = dataArray[++i]; // distance
				stream.writeBits(distCodes[code], distLengths[code], true);
				stream.writeBits(dataArray[++i], dataArray[++i], true); // distance extra
			} else if (literal === 256) break; // 終端
		}
		return stream;
	}
	/**
	 * 固定ハフマン符号化
	 * @param {!(Uint16Array)} dataArray LZ77 符号化済み byte array.
	 * @param {!BitStream} stream 書き込み用ビットストリーム.
	 * @return {!BitStream} ハフマン符号化済みビットストリームオブジェクト.
	 */
	static fixedHuffman(dataArray, stream) {
		for (let i = 0, il = dataArray.length; i < il; i++) {
			const literal = dataArray[i]; // 符号を BitStream に書き込んでいく
			BitStream.prototype.writeBits.apply(stream, RawDeflate.FixedHuffmanTable[literal]); // 符号の書き込み
			if (literal > 0x100) {
				stream.writeBits(dataArray[++i], dataArray[++i], true); // 長さ・距離符号 // length extra
				stream.writeBits(dataArray[++i], 5); // distance
				stream.writeBits(dataArray[++i], dataArray[++i], true); // distance extra
			} else if (literal === 0x100) break; // 終端
		}
		return stream;
	}
	/**
	 * LZ77 実装
	 * @param {!(Uint8Array)} dataArray LZ77 符号化するバイト配列.
	 * @return {!(Uint16Array)} LZ77 符号化した配列.
	 */
	lz77(dataArray) {
		const t = /** @type {Object.<number, Array.<number>>} chained-hash-table */ {},
			windowSize = /** @const @type {number} */ RawDeflate.WindowSize,
			lz77buf = /** @type {!(Uint16Array)} lz77 buffer */ ZU.u16(dataArray.length * 2),
			/** @type {!(Uint32Array)} */
			freqsLitLen = ZU.u32(286),
			/** @type {!(Uint32Array)} */
			freqsDist = ZU.u32(30),
			/** @type {number} */
			lazy = this.lazy;
		/** @type {Lz77Match} previous longest match */
		let prevMatch,
			pos = /** @type {number} lz77 output buffer pointer */ 0,
			skipLength = /** @type {number} lz77 skip length */ 0;
		freqsLitLen[256] = 1; // EOB の最低出現回数は 1
		/**
		 * マッチデータの書き込み
		 * @param {Lz77Match} match LZ77 Match data.
		 * @param {!number} offset スキップ開始位置(相対指定).
		 * @private
		 */
		function writeMatch(match, offset) {
			/** @type {Array.<number>} */
			const lz77Array = Lz77Match.toLz77Array(match.length, match.backwardDistance);
			for (let i = 0, il = lz77Array.length; i < il; ++i) lz77buf[pos++] = lz77Array[i];
			freqsLitLen[lz77Array[0]]++;
			freqsDist[lz77Array[3]]++;
			skipLength = match.length + offset - 1;
			prevMatch = null;
		}
		// LZ77 符号化
		for (let position = 0, length = dataArray.length; position < length; ++position) {
			let matchKey = 0; //chained-hash-table key
			for (let i = 0, il = RawDeflate.Lz77MinLength; i < il; ++i) {
				if (position + i === length) break;
				matchKey = (matchKey << 8) | dataArray[position + i]; // ハッシュキーの作成
			}
			if (t[matchKey] === void 0) t[matchKey] = []; // テーブルが未定義だったら作成する
			const matchList = t[matchKey];
			if (skipLength-- > 0) {
				matchList.push(position); // skip
				continue;
			}
			while (matchList.length > 0 && position - matchList[0] > windowSize) matchList.shift(); // マッチテーブルの更新 (最大戻り距離を超えているものを削除する)
			if (position + RawDeflate.Lz77MinLength >= length) {
				if (prevMatch) writeMatch(prevMatch, -1); // データ末尾でマッチしようがない場合はそのまま流しこむ
				for (let i = 0, il = length - position; i < il; ++i) {
					const tmp = dataArray[position + i];
					lz77buf[pos++] = tmp;
					++freqsLitLen[tmp];
				}
				break;
			}
			if (matchList.length > 0) {
				const longestMatch = RawDeflate.searchLongestMatch_(dataArray, position, matchList); // マッチ候補から最長のものを探す
				if (prevMatch) {
					if (prevMatch.length < longestMatch.length) {
						const tmp = dataArray[position - 1]; // 現在のマッチの方が前回のマッチよりも長い// write previous literal
						lz77buf[pos++] = tmp;
						++freqsLitLen[tmp];
						writeMatch(longestMatch, 0); // write current match
					} else writeMatch(prevMatch, -1); // write previous match
				} else if (longestMatch.length < lazy) prevMatch = longestMatch;
				else writeMatch(longestMatch, 0);
			} else if (prevMatch) writeMatch(prevMatch, -1); // 前回マッチしていて今回マッチがなかったら前回のを採用
			else {
				const tmp = dataArray[position];
				lz77buf[pos++] = tmp;
				++freqsLitLen[tmp];
			}
			matchList.push(position); // マッチテーブルに現在の位置を保存
		}
		lz77buf[pos++] = 256; // 終端処理
		freqsLitLen[256]++;
		this.freqsLitLen = freqsLitLen;
		this.freqsDist = freqsDist;
		return /** @type {!(Uint16Array.<number>)} */ lz77buf.subarray(0, pos);
	}
	/**
	 * マッチした候補の中から最長一致を探す
	 * @param {!Object} data plain data byte array.
	 * @param {!number} position plain data byte array position.
	 * @param {!Array.<number>} matchList 候補となる位置の配列.
	 * @return {!Lz77Match} 最長かつ最短距離のマッチオブジェクト.
	 * @private
	 */
	static searchLongestMatch_(data, position, matchList) {
		let currentMatch,
			matchMax = 0;
		const dl = data.length;
		permatch: for (let i = 0, l = matchList.length; i < l; i++) {
			const match = matchList[l - i - 1]; // 候補を後ろから 1 つずつ絞り込んでゆく
			let matchLength = RawDeflate.Lz77MinLength;
			if (matchMax > RawDeflate.Lz77MinLength) {
				for (let j = matchMax; j > RawDeflate.Lz77MinLength; j--)
					if (data[match + j - 1] !== data[position + j - 1]) continue permatch; // 前回までの最長一致を末尾から一致検索する
				matchLength = matchMax;
			}
			while (
				matchLength < RawDeflate.Lz77MaxLength && // 最長一致探索
				position + matchLength < dl &&
				data[match + matchLength] === data[position + matchLength]
			)
				++matchLength;
			if (matchLength > matchMax) {
				currentMatch = match; // マッチ長が同じ場合は後方を優先
				matchMax = matchLength;
			}
			if (matchLength === RawDeflate.Lz77MaxLength) break; // 最長が確定したら後の処理は省略
		}
		return new Lz77Match(matchMax, position - currentMatch);
	}
	/**
	 * Tree-Transmit Symbols の算出
	 * reference: PuTTY Deflate implementation
	 * @param {number} hlit HLIT.
	 * @param {!(Uint8Array)} litlenLengths リテラルと長さ符号の符号長配列.
	 * @param {number} hdist HDIST.
	 * @param {!(Uint8Array)} distLengths 距離符号の符号長配列.
	 * @return {{
	 *   codes: !(Uint32Array),
	 *   freqs: !(Uint8Array)
	 * }} Tree-Transmit Symbols.
	 */
	static getTreeSymbols_(hlit, litlenLengths, hdist, distLengths) {
		const srcLen = hlit + hdist,
			src = ZU.u32(srcLen),
			result = ZU.u32(286 + 30),
			freqs = ZU.u8(19);
		let j = 0,
			nResult = 0; // 符号化
		for (let i = 0; i < hlit; i++) src[j++] = litlenLengths[i];
		for (let i = 0; i < hdist; i++) src[j++] = distLengths[i];
		for (let i = 0; i < srcLen; i += j) {
			const srcI = src[i];
			for (j = 1; i + j < srcLen && src[i + j] === srcI; ) ++j; // Run Length Encoding
			let runLength = j;
			if (srcI === 0) {
				if (runLength < 3)
					while (runLength-- > 0) {
						result[nResult++] = 0; // 0 の繰り返しが 3 回未満ならばそのまま
						freqs[0]++;
					}
				else
					while (runLength > 0) {
						let rpt = runLength < 138 ? runLength : 138; // 繰り返しは最大 138 までなので切り詰める
						if (rpt > runLength - 3 && rpt < runLength) rpt = runLength - 3;
						if (rpt <= 10) {
							result[nResult++] = 17; // 3-10 回 -> 17
							result[nResult++] = rpt - 3;
							freqs[17]++;
						} else {
							result[nResult++] = 18; // 11-138 回 -> 18
							result[nResult++] = rpt - 11;
							freqs[18]++;
						}
						runLength -= rpt;
					}
			} else {
				result[nResult++] = srcI;
				freqs[srcI]++;
				runLength--;
				if (runLength < 3)
					while (runLength-- > 0) {
						result[nResult++] = srcI; // 繰り返し回数が3回未満ならばランレングス符号は要らない
						freqs[srcI]++;
					}
				else
					while (runLength > 0) {
						let rpt = runLength < 6 ? runLength : 6; // 3 回以上ならばランレングス符号化// runLengthを 3-6 で分割
						if (rpt > runLength - 3 && rpt < runLength) rpt = runLength - 3;
						result[nResult++] = 16;
						result[nResult++] = rpt - 3;
						freqs[16]++;
						runLength -= rpt;
					}
			}
		}
		return {
			codes: result.subarray(0, nResult),
			freqs,
		};
	}
	/**
	 * ハフマン符号の長さを取得する
	 * @param {!(Uint8Array|Uint32Array)} freqs 出現カウント.
	 * @param {number} limit 符号長の制限.
	 * @return {!(Uint8Array)} 符号長配列.
	 * @private
	 */
	static getLengths_(freqs, limit) {
		const nSymbols = /** @type {number} */ freqs.length,
			heap = /** @type {Heap} */ new Heap(2 * RawDeflate.HUFMAX),
			length = /** @type {!(Uint8Array)} */ ZU.u8(nSymbols);
		for (let i = 0; i < nSymbols; ++i) if (freqs[i] > 0) heap.push(i, freqs[i]); // ヒープの構築
		const heapHalfLen = heap.length / 2,
			nodes = ZU.a(heapHalfLen),
			values = ZU.u32(heapHalfLen);
		if (nodes.length === 1) {
			length[heap.pop().index] = 1; // 非 0 の要素が一つだけだった場合は、そのシンボルに符号長 1 を割り当てて終了
			return length;
		}
		for (let i = 0; i < heapHalfLen; ++i) {
			nodes[i] = heap.pop(); // Reverse Package Merge Algorithm による Canonical Huffman Code の符号長決定
			values[i] = nodes[i].value;
		}
		const codeLength = RawDeflate.reversePackageMerge_(values, values.length, limit);
		for (let i = 0, il = nodes.length; i < il; ++i) length[nodes[i].index] = codeLength[i];
		return length;
	}
	/**
	 * @param {number} j
	 */
	static takePackage(j, type, currentPosition, symbols, codeLength) {
		const x = /** @type {number} */ type[j][currentPosition[j]];
		if (x === symbols) {
			RawDeflate.takePackage(j + 1, type, currentPosition, symbols, codeLength);
			RawDeflate.takePackage(j + 1, type, currentPosition, symbols, codeLength);
		} else --codeLength[x];
		++currentPosition[j];
	}
	/**
	 * Reverse Package Merge Algorithm.
	 * @param {!(Uint32Array)} freqs sorted probability.
	 * @param {number} symbols number of symbols.
	 * @param {number} limit code length limit.
	 * @return {!(Uint8Array)} code lengths.
	 */
	static reversePackageMerge_(freqs, symbols, limit) {
		const limitM1 = limit - 1,
			minimumCost = /** @type {!(Uint16Array)} */ ZU.u16(limit),
			flag = /** @type {!(Uint8Array)} */ ZU.u8(limit),
			codeLength = /** @type {!(Uint8Array)} */ ZU.u8(symbols),
			value = /** @type {Array} */ ZU.a(limit),
			type = /** @type {Array} */ ZU.a(limit),
			currentPosition = /** @type {Array.<number>} */ ZU.a(limit),
			half = /** @type {number} */ 1 << limitM1;
		let excess = /** @type {number} */ (1 << limit) - symbols;
		minimumCost[limitM1] = symbols;
		for (let j = 0; j < limit; ++j) {
			if (excess < half) flag[j] = 0;
			else {
				flag[j] = 1;
				excess -= half;
			}
			excess <<= 1;
			minimumCost[limit - 2 - j] = ((minimumCost[limitM1 - j] / 2) | 0) + symbols;
		}
		minimumCost[0] = flag[0];
		value[0] = ZU.a(minimumCost[0]);
		type[0] = ZU.a(minimumCost[0]);
		for (let j = 1; j < limit; ++j) {
			if (minimumCost[j] > 2 * minimumCost[j - 1] + flag[j]) minimumCost[j] = 2 * minimumCost[j - 1] + flag[j];
			value[j] = ZU.a(minimumCost[j]);
			type[j] = ZU.a(minimumCost[j]);
		}
		for (let i = 0; i < symbols; ++i) codeLength[i] = limit;
		const tml = minimumCost[limitM1];
		for (let t = 0; t < tml; ++t) {
			value[limitM1][t] = freqs[t];
			type[limitM1][t] = t;
		}
		for (let i = 0; i < limit; ++i) currentPosition[i] = 0;
		if (flag[limitM1] === 1) {
			--codeLength[0];
			++currentPosition[limitM1];
		}
		for (let j = limit - 2; j >= 0; --j) {
			let i = 0,
				next = currentPosition[j + 1];
			const valueJ0 = value[j],
				valueJ1 = value[j + 1],
				typeJ = type[j],
				minimumCostJ = minimumCost[j];
			for (let t = 0; t < minimumCostJ; t++) {
				const weight = valueJ1[next] + valueJ1[next + 1];
				if (weight > freqs[i]) {
					valueJ0[t] = weight;
					typeJ[t] = symbols;
					next += 2;
				} else {
					valueJ0[t] = freqs[i];
					typeJ[t] = i;
					++i;
				}
			}
			currentPosition[j] = 0;
			if (flag[j] === 1) RawDeflate.takePackage(j, type, currentPosition, symbols, codeLength);
		}
		return codeLength;
	}
	/**
	 * 符号長配列からハフマン符号を取得する
	 * reference: PuTTY Deflate implementation
	 * @param {!(Uint8Array)} lengths 符号長配列.
	 * @return {!(Uint16Array)} ハフマン符号配列.
	 * @private
	 */
	static getCodesFromLengths_(lengths) {
		const il = lengths.length,
			codes = ZU.u16(il),
			count = [],
			startCode = [];
		let c = 0;
		for (const len of lengths) count[len] = (count[len] | 0) + 1; // Count the codes of each length.
		for (let i = 1; i <= RawDeflate.MaxCodeLength; i++) {
			startCode[i] = c; // Determine the starting code for each length block.
			c += count[i] | 0;
			c <<= 1;
		}
		for (let i = 0; i < il; i++) {
			const len = lengths[i]; // Determine the code for each symbol. Mirrored, of course.
			let c = startCode[len];
			startCode[len] += 1;
			codes[i] = 0;
			for (let j = 0; j < len; j++) {
				codes[i] = (codes[i] << 1) | (c & 1);
				c >>>= 1;
			}
		}
		return codes;
	}
}
class Lz77Match {
	/**
	 * マッチ情報
	 * @param {!number} length マッチした長さ.
	 * @param {!number} backwardDistance マッチ位置との距離.
	 * @constructor
	 */
	constructor(length, backwardDistance) {
		this.length = /** @type {number} match length. */ length;
		this.backwardDistance = /** @type {number} backward distance. */ backwardDistance;
	}
	/**
	 * 長さ符号テーブル.
	 * [コード, 拡張ビット, 拡張ビット長] の配列となっている.
	 * @const
	 * @type {!(Uint32Array)}
	 */
	static LengthCodeTable = Lz77Match.buildLengthCodeTable();
	static buildLengthCodeTable() {
		const t = /** @type {!Array} */ [];
		for (let i = 3; i <= 258; i++) {
			const c = Lz77Match.code(i);
			t[i] = (c[2] << 24) | (c[1] << 16) | c[0];
		}
		return ZU.u32(t);
	}
	/**
	 * @param {number} l lz77 length.
	 * @return {!Array.<number>} lz77 codes.
	 */
	static code(length) {
		const l = length;
		switch (true) {
			case l === 3:
				return [257, l - 3, 0];
			case l === 4:
				return [258, l - 4, 0];
			case l === 5:
				return [259, l - 5, 0];
			case l === 6:
				return [260, l - 6, 0];
			case l === 7:
				return [261, l - 7, 0];
			case l === 8:
				return [262, l - 8, 0];
			case l === 9:
				return [263, l - 9, 0];
			case l === 10:
				return [264, l - 10, 0];
			case l <= 12:
				return [265, l - 11, 1];
			case l <= 14:
				return [266, l - 13, 1];
			case l <= 16:
				return [267, l - 15, 1];
			case l <= 18:
				return [268, l - 17, 1];
			case l <= 22:
				return [269, l - 19, 2];
			case l <= 26:
				return [270, l - 23, 2];
			case l <= 30:
				return [271, l - 27, 2];
			case l <= 34:
				return [272, l - 31, 2];
			case l <= 42:
				return [273, l - 35, 3];
			case l <= 50:
				return [274, l - 43, 3];
			case l <= 58:
				return [275, l - 51, 3];
			case l <= 66:
				return [276, l - 59, 3];
			case l <= 82:
				return [277, l - 67, 4];
			case l <= 98:
				return [278, l - 83, 4];
			case l <= 114:
				return [279, l - 99, 4];
			case l <= 130:
				return [280, l - 115, 4];
			case l <= 162:
				return [281, l - 131, 5];
			case l <= 194:
				return [282, l - 163, 5];
			case l <= 226:
				return [283, l - 195, 5];
			case l <= 257:
				return [284, l - 227, 5];
			case l === 258:
				return [285, l - 258, 0];
			default:
				ZU.Err(`invalid length: ${l}`);
		}
	}
	/**
	 * 距離符号テーブル
	 * @param {!number} d 距離.
	 * @return {!Array.<number>} コード、拡張ビット、拡張ビット長の配列.
	 * @private
	 */
	static getDistanceCode_(dist) {
		const d = dist;
		switch (true) {
			case d === 1:
				return [0, d - 1, 0];
			case d === 2:
				return [1, d - 2, 0];
			case d === 3:
				return [2, d - 3, 0];
			case d === 4:
				return [3, d - 4, 0];
			case d <= 6:
				return [4, d - 5, 1];
			case d <= 8:
				return [5, d - 7, 1];
			case d <= 12:
				return [6, d - 9, 2];
			case d <= 16:
				return [7, d - 13, 2];
			case d <= 24:
				return [8, d - 17, 3];
			case d <= 32:
				return [9, d - 25, 3];
			case d <= 48:
				return [10, d - 33, 4];
			case d <= 64:
				return [11, d - 49, 4];
			case d <= 96:
				return [12, d - 65, 5];
			case d <= 128:
				return [13, d - 97, 5];
			case d <= 192:
				return [14, d - 129, 6];
			case d <= 256:
				return [15, d - 193, 6];
			case d <= 384:
				return [16, d - 257, 7];
			case d <= 512:
				return [17, d - 385, 7];
			case d <= 768:
				return [18, d - 513, 8];
			case d <= 1024:
				return [19, d - 769, 8];
			case d <= 1536:
				return [20, d - 1025, 9];
			case d <= 2048:
				return [21, d - 1537, 9];
			case d <= 3072:
				return [22, d - 2049, 10];
			case d <= 4096:
				return [23, d - 3073, 10];
			case d <= 6144:
				return [24, d - 4097, 11];
			case d <= 8192:
				return [25, d - 6145, 11];
			case d <= 12288:
				return [26, d - 8193, 12];
			case d <= 16384:
				return [27, d - 12289, 12];
			case d <= 24576:
				return [28, d - 16385, 13];
			case d <= 32768:
				return [29, d - 24577, 13];
			default:
				ZU.Err(`invalid distance ${d}`);
		}
	}
	/**
	 * マッチ情報を LZ77 符号化配列で返す.
	 * なお、ここでは以下の内部仕様で符号化している
	 * [ CODE, EXTRA-BIT-LEN, EXTRA, CODE, EXTRA-BIT-LEN, EXTRA ]
	 * @return {!Array.<number>} LZ77 符号化 byte array.
	 */
	static toLz77Array(length, backwardDistance) {
		let pos = 0;
		const a = [],
			code1 = Lz77Match.LengthCodeTable[length]; // length
		a[pos++] = code1 & 0xffff;
		a[pos++] = (code1 >> 16) & 0xff;
		a[pos++] = code1 >> 24;
		const code2 = Lz77Match.getDistanceCode_(backwardDistance); // distance
		a[pos++] = code2[0];
		a[pos++] = code2[1];
		a[pos++] = code2[2];
		return a;
	}
}
class Zip {
	/**
	 * @enum {number}
	 */
	static OperatingSystem = {
		MSDOS: 0,
		UNIX: 3,
		MACINTOSH: 7,
	};
	/**Gunzip
	 * @enum {number}
	 */
	static Flags = {
		ENCRYPT: 0x0001,
		DESCRIPTOR: 0x0008,
		UTF8: 0x0800,
	};
	static CompressionMethod = Zlib.CompressionMethod;
	/**
	 * @type {Array.<number>}
	 * @const
	 */
	static FileHeaderSignature = [0x50, 0x4b, 0x01, 0x02];
	/**
	 * @type {Array.<number>}
	 * @const
	 */
	static LocalFileHeaderSignature = [0x50, 0x4b, 0x03, 0x04];
	/**
	 * @type {Array.<number>}
	 * @const
	 */
	static CentralDirectorySignature = [0x50, 0x4b, 0x05, 0x06];
	/**
	 * @param {Object=} opt_params options.
	 * @constructor
	 */
	constructor(opt_params = {}) {
		/** @type {Array.<{
		 *   buffer: !(Uint8Array),
		 *   option: Object,
		 *   compressed: boolean,
		 *   encrypted: boolean,
		 *   size: number,
		 *   crc32: number
		 * }>} */
		this.files = [];
		this.comment = /** @type {(Uint8Array)} */ opt_params.comment;
		this.password = /** @type {(Uint8Array)} */ void 0;
	}
	/**
	 * @param {Uint8Array} input
	 * @param {Object=} opt_params options.
	 */
	addFile(input, opt_params = {}) {
		// const filename = /** @type {string} */ opt_params.filename ? opt_params.filename : '';
		let compressed = /** @type {boolean} */ void 0,
			crc32 = /** @type {number} */ 0,
			buf = input instanceof Array ? ZU.u8(input) : input;
		if (typeof opt_params.compressionMethod !== 'number')
			opt_params.compressionMethod = Zlib.CompressionMethod.DEFLATE; // default// その場で圧縮する場合
		if (opt_params.compress)
			switch (opt_params.compressionMethod) {
				case Zlib.CompressionMethod.STORE:
					break;
				case Zlib.CompressionMethod.DEFLATE:
					crc32 = CRC32.calc(buf);
					buf = Zip.deflateWithOption(buf, opt_params);
					compressed = true;
					break;
				default:
					ZU.Err(`unknown compression method:${opt_params.compressionMethod}`);
			}
		this.files.push({
			buffer: buf,
			option: opt_params,
			compressed,
			encrypted: !!opt_params.password,
			size: input.length,
			crc32,
			// filename,
		});
	}
	/**
	 * @param {(Uint8Array)} password
	 */
	setPassword(password) {
		this.password = password;
	}
	compress() {
		/** @type {Array.<{
		 *   buffer: !(Uint8Array),
		 *   option: Object,
		 *   compressed: boolean,
		 *   encrypted: boolean,
		 *   size: number,
		 *   crc32: number
		 * }>} */
		const files = this.files,
			fileCount = files.length;
		/** @type {{
		 *   buffer: !(Uint8Array),
		 *   option: Object,
		 *   compressed: boolean,
		 *   encrypted: boolean,
		 *   size: number,
		 *   crc32: number
		 * }} */
		let localFileSize = /** @type {number} */ 0,
			centralDirectorySize = /** @type {number} */ 0;
		for (let i = 0; i < fileCount; ++i) {
			const file = files[i],
				opt = file.option, // ファイルの圧縮
				filenameLength = opt.filename ? opt.filename.length : 0,
				commentLength = opt.comment ? opt.comment.length : 0;
			// const extraFieldLength = opt.extraField ? opt.extraField.length : 0;
			if (!file.compressed) {
				file.crc32 = CRC32.calc(file.buffer); // 圧縮されていなかったら圧縮 // 圧縮前に CRC32 の計算をしておく
				switch (opt.compressionMethod) {
					case Zlib.CompressionMethod.STORE:
						break;
					case Zlib.CompressionMethod.DEFLATE:
						file.buffer = Zip.deflateWithOption(file.buffer, opt);
						file.compressed = true;
						break;
					default:
						ZU.Err(`unknown compression method:${opt.compressionMethod}`);
				}
			}
			if (opt.password !== void 0 || this.password !== void 0) {
				const key = Zip.createEncryptionKey(opt.password || this.password), // encryption// init encryption
					len = file.buffer.length + 12, // add header
					buffer = ZU.u8(len);
				buffer.set(file.buffer, 12);
				for (let j = 0; j < 12; ++j)
					buffer[j] = Zip.encode(key, i === 11 ? file.crc32 & 0xff : (Math.random() * 256) | 0);
				for (let j = 12; j < len; ++j) buffer[j] = Zip.encode(key, buffer[j]); // data encryption
				file.buffer = buffer;
			}
			localFileSize += 30 + filenameLength + file.buffer.length; // 必要バッファサイズの計算// local file header// file data
			centralDirectorySize += 46 + filenameLength + commentLength; // file header
		}
		const endOfCentralDirectorySize = 22 + (this.comment ? this.comment.length : 0), // end of central directory
			o = ZU.u8(localFileSize + centralDirectorySize + endOfCentralDirectorySize);
		let op1 = 0,
			op2 = localFileSize,
			op3 = op2 + centralDirectorySize;
		for (const file of files) {
			const opt = file.option, // ファイルの圧縮
				filenameLength = opt.filename ? opt.filename.length : 0,
				extraFieldLength = 0, // TODO
				commentLength = opt.comment ? opt.comment.length : 0,
				offset = op1, //// local file header & file header ////
				LFHS = Zip.LocalFileHeaderSignature,
				FHS = Zip.FileHeaderSignature;
			o[op1++] = LFHS[0]; // local file header // signature
			o[op1++] = LFHS[1];
			o[op1++] = LFHS[2];
			o[op1++] = LFHS[3];
			o[op2++] = FHS[0]; // file header
			o[op2++] = FHS[1];
			o[op2++] = FHS[2];
			o[op2++] = FHS[3];
			const needVersion = 20; // compressor info
			o[op2++] = needVersion & 0xff;
			o[op2++] =
				/** @type {OperatingSystem} */
				(opt.os) || Zip.OperatingSystem.MSDOS;
			o[op1++] = o[op2++] = needVersion & 0xff; // need version
			o[op1++] = o[op2++] = (needVersion >> 8) & 0xff;
			let flags = 0; // general purpose bit flag
			if (opt.password || this.password) flags |= Zip.Flags.ENCRYPT;
			o[op1++] = o[op2++] = flags & 0xff;
			o[op1++] = o[op2++] = (flags >> 8) & 0xff;
			const compressionMethod =
				/** @type {CompressionMethod} */
				(opt.compressionMethod); // compression method
			o[op1++] = o[op2++] = compressionMethod & 0xff;
			o[op1++] = o[op2++] = (compressionMethod >> 8) & 0xff;
			const date = /** @type {(Date|undefined)} */ (opt.date) || new Date(); // date
			o[op1++] = o[op2++] = ((date.getMinutes() & 0x7) << 5) | ((date.getSeconds() / 2) | 0);
			o[op1++] = o[op2++] = (date.getHours() << 3) | (date.getMinutes() >> 3);
			o[op1++] = o[op2++] = (((date.getMonth() + 1) & 0x7) << 5) | date.getDate();
			o[op1++] = o[op2++] = (((date.getFullYear() - 1980) & 0x7f) << 1) | ((date.getMonth() + 1) >> 3);
			const crc32 = file.crc32; // CRC-32
			o[op1++] = o[op2++] = crc32 & 0xff;
			o[op1++] = o[op2++] = (crc32 >> 8) & 0xff;
			o[op1++] = o[op2++] = (crc32 >> 16) & 0xff;
			o[op1++] = o[op2++] = (crc32 >> 24) & 0xff;
			const size = file.buffer.length; // compressed size
			o[op1++] = o[op2++] = size & 0xff;
			o[op1++] = o[op2++] = (size >> 8) & 0xff;
			o[op1++] = o[op2++] = (size >> 16) & 0xff;
			o[op1++] = o[op2++] = (size >> 24) & 0xff;
			const plainSize = file.size; // uncompressed size
			o[op1++] = o[op2++] = plainSize & 0xff;
			o[op1++] = o[op2++] = (plainSize >> 8) & 0xff;
			o[op1++] = o[op2++] = (plainSize >> 16) & 0xff;
			o[op1++] = o[op2++] = (plainSize >> 24) & 0xff;
			o[op1++] = o[op2++] = filenameLength & 0xff; // filename length
			o[op1++] = o[op2++] = (filenameLength >> 8) & 0xff;
			o[op1++] = o[op2++] = extraFieldLength & 0xff; // extra field length
			o[op1++] = o[op2++] = (extraFieldLength >> 8) & 0xff;
			o[op2++] = commentLength & 0xff; // file comment length
			o[op2++] = (commentLength >> 8) & 0xff;
			o[op2++] = 0; // disk number start
			o[op2++] = 0;
			o[op2++] = 0; // internal file attributes
			o[op2++] = 0;
			o[op2++] = 0; // external file attributes
			o[op2++] = 0;
			o[op2++] = 0;
			o[op2++] = 0;
			o[op2++] = offset & 0xff; // relative offset of local header
			o[op2++] = (offset >> 8) & 0xff;
			o[op2++] = (offset >> 16) & 0xff;
			o[op2++] = (offset >> 24) & 0xff;
			const filename = opt.filename; // filename
			if (filename) {
				o.set(filename, op1);
				o.set(filename, op2);
				op1 += filenameLength;
				op2 += filenameLength;
			}
			const extraField = opt.extraField; // extra field
			if (extraField) {
				o.set(extraField, op1);
				o.set(extraField, op2);
				op1 += extraFieldLength;
				op2 += extraFieldLength;
			}
			const comment = opt.comment; // comment
			if (comment) {
				o.set(comment, op2);
				op2 += commentLength;
			}
			o.set(file.buffer, op1); //// file data ////
			op1 += file.buffer.length;
		}
		o[op3++] = Zip.CentralDirectorySignature[0]; //// end of central directory //// signature
		o[op3++] = Zip.CentralDirectorySignature[1];
		o[op3++] = Zip.CentralDirectorySignature[2];
		o[op3++] = Zip.CentralDirectorySignature[3];
		o[op3++] = 0; // number of this disk
		o[op3++] = 0;
		o[op3++] = 0; // number of the disk with the start of the central directory
		o[op3++] = 0;
		o[op3++] = fileCount & 0xff; // total number of entries in the central directory on this disk
		o[op3++] = (fileCount >> 8) & 0xff;
		o[op3++] = fileCount & 0xff; // total number of entries in the central directory
		o[op3++] = (fileCount >> 8) & 0xff;
		o[op3++] = centralDirectorySize & 0xff; // size of the central directory
		o[op3++] = (centralDirectorySize >> 8) & 0xff;
		o[op3++] = (centralDirectorySize >> 16) & 0xff;
		o[op3++] = (centralDirectorySize >> 24) & 0xff;
		o[op3++] = localFileSize & 0xff; // offset of start of central directory with respect to the starting disk number
		o[op3++] = (localFileSize >> 8) & 0xff;
		o[op3++] = (localFileSize >> 16) & 0xff;
		o[op3++] = (localFileSize >> 24) & 0xff;
		const commentLength = this.comment ? this.comment.length : 0; // .ZIP file comment length
		o[op3++] = commentLength & 0xff;
		o[op3++] = (commentLength >> 8) & 0xff;
		if (this.comment) {
			o.set(this.comment, op3); // .ZIP file comment
			op3 += commentLength;
		}
		return o;
	}
	/**
	 * @param {!(Uint8Array)} input
	 * @param {Object=} opt_params options.
	 * @return {!(Uint8Array)}
	 */
	static deflateWithOption = (input, opt_params) => new RawDeflate(input, opt_params.deflateOption).compress();
	/**
	 * @param {(Uint32Array)} key
	 * @return {number}
	 */
	static getByte(key) {
		const tmp = (key[2] & 0xffff) | 2;
		return ((tmp * (tmp ^ 1)) >> 8) & 0xff;
	}
	/**
	 * @param {(Uint32Array|Object)} key
	 * @param {number} n
	 * @return {number}
	 */
	static encode(key, n) {
		const tmp = Zip.getByte(/** @type {(Uint32Array)} */ (key));
		Zip.updateKeys(/** @type {(Uint32Array)} */ (key), n);
		return tmp ^ n;
	}
	/**
	 * @param {(Uint32Array)} key
	 * @param {number} n
	 */
	static updateKeys(key, n) {
		key[0] = CRC32.single(key[0], n);
		key[1] = ((((((key[1] + (key[0] & 0xff)) * 20173) >>> 0) * 6681) >>> 0) + 1) >>> 0;
		key[2] = CRC32.single(key[2], key[1] >>> 24);
	}
	/**
	 * @param {(Uint8Array)} password
	 * @return {!(Uint32Array|Object)}
	 */
	static createEncryptionKey(password) {
		const key = ZU.u32([305419896, 591751049, 878082192]);
		for (let i = 0, il = password.length; i < il; ++i) Zip.updateKeys(key, password[i] & 0xff);
		return key;
	}
}
class LocalFileHeader {
	/**
	 * @param {!(Uint8Array)} input input buffer.
	 * @param {number} ip input position.
	 * @constructor
	 */
	constructor(input, ip) {
		this.input = /** @type {!(Uint8Array)} */ input;
		this.offset = /** @type {number} */ ip;
		this.parse();
	}
	static Flags = Zip.Flags;
	parse() {
		const input = this.input,
			LFHS = Unzip.LocalFileHeaderSignature;
		let ip = /** @type {number} */ this.offset;
		if (input[ip++] !== LFHS[0] || input[ip++] !== LFHS[1] || input[ip++] !== LFHS[2] || input[ip++] !== LFHS[3])
			ZU.Err('invalid local file header signature'); // local file header signature
		this.needVersion = input[ip++] | (input[ip++] << 8); // version needed to extract
		this.flags = input[ip++] | (input[ip++] << 8); // general purpose bit flag
		this.compression = input[ip++] | (input[ip++] << 8); // compression method
		this.time = input[ip++] | (input[ip++] << 8); // last mod file time
		this.date = input[ip++] | (input[ip++] << 8); //last mod file date
		this.crc32 = (input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24)) >>> 0; // crc-32
		this.compressedSize = (input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24)) >>> 0; // compressed size
		this.plainSize = (input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24)) >>> 0; // uncompressed size
		this.fileNameLength = input[ip++] | (input[ip++] << 8); // file name length
		this.extraFieldLength = input[ip++] | (input[ip++] << 8); // extra field length
		this.filename = String.fromCharCode.apply(null, input.subarray(ip, (ip += this.fileNameLength))); // file name
		this.extraField = input.subarray(ip, (ip += this.extraFieldLength)); // extra field
		this.length = ip - this.offset;
	}
}
/**
 * @fileoverview Deflate (RFC1951) 実装.
 * Deflateアルゴリズム本体は Zlib.RawDeflate で実装されている.
 */
class Deflate {
	static CompressionType = RawDeflate.CompressionType;
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
	constructor(input, opt_params = {}) {
		this.input = /** @type {!(Uint8Array)} */ input;
		this.output = /** @type {!(Uint8Array)} */ ZU.u8(Deflate.DefaultBufferSize);
		this.compressionType = /** @type {Deflate.CompressionType} */ Deflate.CompressionType.DYNAMIC;
		const rawDeflateOption = /** @type {Object} */ {};
		if (typeof opt_params.compressionType === 'number') this.compressionType = opt_params.compressionType; // option parameters
		for (const prop in opt_params) rawDeflateOption[prop] = opt_params[prop]; // copy options
		rawDeflateOption.outputBuffer = this.output; // set raw-deflate output buffer
		this.rawDeflate = /** @type {RawDeflate} */ new RawDeflate(this.input, rawDeflateOption);
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
		let cinfo = /** @type {number} */ 0,
			flevel = /** @type {number} */ 0,
			pos = /** @type {number} */ 0;
		const o = this.output,
			cm = Zlib.CompressionMethod.DEFLATE; // Compression Method and Flags
		switch (cm) {
			case Zlib.CompressionMethod.DEFLATE:
				cinfo = Math.LOG2E * Math.log(RawDeflate.WindowSize) - 8;
				break;
			default:
				ZU.Err('invalid compression method');
		}
		const cmf = (cinfo << 4) | cm,
			fdict = 0, // Flags
			CT = Deflate.CompressionType;
		o[pos++] = cmf;
		switch (cm) {
			case Zlib.CompressionMethod.DEFLATE:
				switch (this.compressionType) {
					case CT.NONE:
						flevel = 0;
						break;
					case CT.FIXED:
						flevel = 1;
						break;
					case CT.DYNAMIC:
						flevel = 2;
						break;
					default:
						ZU.Err('unsupported compression type');
				}
				break;
			default:
				ZU.Err('invalid compression method');
		}
		let flg = (flevel << 6) | (fdict << 5);
		const fcheck = 31 - ((cmf * 256 + flg) % 31);
		flg |= fcheck;
		o[pos++] = flg;
		this.rawDeflate.op = pos;
		const adler = Adler32.mkHash(this.input), // Adler-32 checksum
			o2 = this.rawDeflate.compress();
		let pos2 = o2.length,
			o3 = ZU.u8(o2.buffer); // subarray 分を元にもどす
		if (o3.length <= pos2 + 4) {
			this.output = ZU.u8(o3.length + 4); // expand buffer
			this.output.set(o3);
			o3 = this.output;
		}
		const o4 = o3.subarray(0, pos2 + 4);
		o4[pos2++] = (adler >> 24) & 0xff; // adler32
		o4[pos2++] = (adler >> 16) & 0xff;
		o4[pos2++] = (adler >> 8) & 0xff;
		o4[pos2++] = adler & 0xff;
		return o4;
	}
}
/**
 * @fileoverview GZIP (RFC1952) 展開コンテナ実装.
 */
class Gunzip {
	/**
	 * @constructor
	 * @param {!(Uint8Array)} input input buffer.
	 * @param {Object=} opt_params option parameters.
	 */
	constructor(input) {
		this.input = input; // input buffer.
		this.ip = 0; //input buffer pointer.
		this.member = [];
		this.decompressed = false;
	}
	/**
	 * @return {Array.<Zlib.GunzipMember>}
	 */
	getMembers() {
		if (!this.decompressed) this.decompress();
		return this.member.slice();
	}
	/**
	 * inflate gzip data.
	 * @return {!(Uint8Array)} inflated buffer.
	 */
	decompress() {
		const il = this.input.length; //input length.
		while (this.ip < il) this.decodeMember();
		this.decompressed = true;
		return Gunzip.concatMember(this.member);
	}
	/**
	 * decode gzip member.
	 */
	decodeMember() {
		const member = /** @type {Zlib.GunzipMember} */ new GunzipMember(),
			input = this.input;
		/** @type {number} character code */
		let c,
			ip = this.ip;
		member.id1 = input[ip++];
		member.id2 = input[ip++];
		if (member.id1 !== 0x1f || member.id2 !== 0x8b) ZU.Err(`invalid file signature:${member.id1},${member.id2}`); // check signature
		member.cm = input[ip++]; // check compression method
		switch (member.cm) {
			case 8 /* XXX: use Zlib const */:
				break;
			default:
				ZU.Err(`unknown compression method: ${member.cm}`);
		}
		member.flg = input[ip++]; // flags
		const mtime = input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24); // modification time
		member.mtime = new Date(mtime * 1000);
		member.xfl = input[ip++]; // extra flags
		member.os = input[ip++]; // operating system
		if ((member.flg & Gzip.FlagsMask.FEXTRA) > 0) {
			member.xlen = input[ip++] | (input[ip++] << 8); // extra
			ip = Gunzip.decodeSubField(ip, member.xlen);
		}
		if ((member.flg & Gzip.FlagsMask.FNAME) > 0) {
			const str = []; // fname
			for (let ci = 0; (c = input[ip++]) > 0; ci++) str[ci] = String.fromCharCode(c);
			member.name = str.join('');
		}
		if ((member.flg & Gzip.FlagsMask.FCOMMENT) > 0) {
			const str = []; // fcomment
			for (let ci = 0; (c = input[ip++]) > 0; ci++) str[ci] = String.fromCharCode(c);
			member.comment = str.join('');
		}
		if ((member.flg & Gzip.FlagsMask.FHCRC) > 0) {
			member.crc16 = CRC32.calc(input, 0, ip) & 0xffff; // fhcrc
			if (member.crc16 !== (input[ip++] | (input[ip++] << 8))) ZU.Err('invalid header crc16');
		}
		// isize を事前に取得すると展開後のサイズが分かるため、
		// inflate処理のバッファサイズが事前に分かり、高速になる
		const l = input.length,
			isize = input[l - 4] | (input[l - 3] << 8) | (input[l - 2] << 16) | (input[l - 1] << 24);
		// isize の妥当性チェック
		// ハフマン符号では最小 2-bit のため、最大で 1/4 になる
		// LZ77 符号では 長さと距離 2-Byte で最大 258-Byte を表現できるため、
		// 1/128 になるとする
		// ここから入力バッファの残りが isize の 512 倍以上だったら
		// サイズ指定のバッファ確保は行わない事とする
		const bufferSize = l - ip - /* CRC-32 */ 4 - /* ISIZE */ 4 < isize * 512 ? isize : void 0, // inflate size
			rawinflate = new RawInflate(input, { index: ip, bufferSize }), // compressed block // RawInflate implementation.
			inflated = rawinflate.decompress(); // inflated data.
		member.data = inflated;
		let ipr = rawinflate.ip;
		const crc32 = (input[ipr++] | (input[ipr++] << 8) | (input[ipr++] << 16) | (input[ipr++] << 24)) >>> 0; // crc32
		member.crc32 = crc32;
		if (CRC32.calc(inflated) !== crc32)
			ZU.Err(`invalid CRC-32 checksum: 0x${CRC32.calc(inflated).toString(16)} / 0x${crc32.toString(16)}`);
		const isize2 = (input[ipr++] | (input[ipr++] << 8) | (input[ipr++] << 16) | (input[ipr++] << 24)) >>> 0; // input size
		member.isize = isize2;
		if ((inflated.length & 0xffffffff) !== isize2)
			ZU.Err(`invalid input size: ${inflated.length & 0xffffffff} / ${isize2}`);
		this.member.push(member);
		this.ip = ipr;
	}
	/**
	 * サブフィールドのデコード
	 * XXX: 現在は何もせずスキップする
	 */
	static decodeSubField = (ip, length) => ip + length;
	/**
	 * @return {!(Uint8Array)}
	 */
	static concatMember(members) {
		let p = 0,
			size = 0;
		for (const member of members) size += member.data.length;
		const buffer = ZU.u8(size);
		for (const member of members) {
			buffer.set(member.data, p);
			p += member.data.length;
		}
		return buffer;
	}
}
class GunzipMember {
	constructor() {
		this.id1 = /** @type {number} signature first byte. */ void 0;
		this.id2 = /** @type {number} signature second byte. */ void 0;
		this.cm = /** @type {number} compression method. */ void 0;
		this.flg = /** @type {number} flags. */ void 0;
		this.mtime = /** @type {Date} modification time. */ void 0;
		this.xfl = /** @type {number} extra flags. */ void 0;
		this.os = /** @type {number} operating system number. */ void 0;
		this.crc16 = /** @type {number} CRC-16 value for FHCRC flag. */ void 0;
		this.xlen = /** @type {number} extra length. */ void 0;
		this.crc32 = /** @type {number} CRC-32 value for verification. */ void 0;
		this.isize = /** @type {number} input size modulo 32 value. */ void 0;
		this.name = /** @type {string} filename. */ void 0;
		this.comment = /** @type {string} comment. */ void 0;
		this.data = /** @type {!(Uint8Array|)} */ void 0;
	}
	getName() {
		return this.name;
	}
	getData() {
		return this.data;
	}
	getMtime() {
		return this.mtime;
	}
}
/**
 * @fileoverview GZIP (RFC1952) 実装.
 */
class Gzip {
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
	 * @param {!(Uint8Array)} input input buffer.
	 * @param {Object=} opt_params option parameters.
	 */
	constructor(input, opt_params = {}) {
		this.input = /** @type {!(Uint8Array)} input buffer. */ input;
		this.ip = /** @type {number} input buffer pointer. */ 0;
		this.output = /** @type {!(Uint8Array)} output buffer. */ void 0;
		this.op = /** @type {number} output buffer. */ 0;
		this.flags = /** @type {!Object} flags option flags. */ {};
		this.filename = /** @type {!string} filename. */ void 0;
		this.comment = /** @type {!string} comment. */ void 0;
		this.deflateOptions = /** @type {!Object} deflate options. */ void 0;
		if (opt_params.flags) this.flags = opt_params.flags; // option parameters
		if (typeof opt_params.filename === 'string') this.filename = opt_params.filename;
		if (typeof opt_params.comment === 'string') this.comment = opt_params.comment;
		if (opt_params.deflateOptions) this.deflateOptions = opt_params.deflateOptions;
		if (!this.deflateOptions) this.deflateOptions = {};
	}
	/**
	 * encode gzip members.
	 * @return {!(Uint8Array)} gzip binary array.
	 */
	compress() {
		const o = /** @type {!(Uint8Array)} output buffer. */ ZU.u8(Gzip.DefaultBufferSize),
			input = this.input,
			ip = this.ip,
			filename = this.filename,
			comment = this.comment;
		let op = /** @type {number} output buffer pointer. */ 0,
			flg = 0; // flags
		o[op++] = 0x1f; // check signature
		o[op++] = 0x8b;
		o[op++] = 8; /* XXX: use Zlib const */ // check compression method
		if (this.flags.fname) flg |= Gzip.FlagsMask.FNAME;
		if (this.flags.fcomment) flg |= Gzip.FlagsMask.FCOMMENT;
		if (this.flags.fhcrc) flg |= Gzip.FlagsMask.FHCRC;
		// XXX: FTEXT
		// XXX: FEXTRA
		o[op++] = flg;
		const mtime = ((Date.now ? Date.now() : +new Date()) / 1000) | 0; // modification time
		o[op++] = mtime & 0xff;
		o[op++] = (mtime >>> 8) & 0xff;
		o[op++] = (mtime >>> 16) & 0xff;
		o[op++] = (mtime >>> 24) & 0xff;
		o[op++] = 0; // extra flags
		o[op++] = Gzip.OperatingSystem.UNKNOWN; // operating system
		// extra
		/* NOP */
		if (this.flags.fname !== void 0) {
			for (let i = 0, il = filename.length; i < il; ++i) {
				const c = filename.charCodeAt(i); // fname
				if (c > 0xff) o[op++] = (c >>> 8) & 0xff;
				o[op++] = c & 0xff;
			}
			o[op++] = 0; // null termination
		}
		if (this.flags.comment) {
			for (let i = 0, il = comment.length; i < il; ++i) {
				const c = comment.charCodeAt(i); // fcomment
				if (c > 0xff) o[op++] = (c >>> 8) & 0xff;
				o[op++] = c & 0xff;
			}
			o[op++] = 0; // null termination
		}
		if (this.flags.fhcrc) {
			const crc16 = CRC32.calc(o, 0, op) & 0xffff; // fhcrc CRC-16 value for FHCRC flag.
			o[op++] = crc16 & 0xff;
			o[op++] = (crc16 >>> 8) & 0xff;
		}
		this.deflateOptions.outputBuffer = o; // add compress option
		this.deflateOptions.outputIndex = op;
		const rawdeflate = new RawDeflate(input, this.deflateOptions); // compress//raw deflate object.
		let o2 = rawdeflate.compress(),
			op2 = rawdeflate.op;
		if (op2 + 8 > o2.buffer.byteLength) {
			this.output = ZU.u8(op2 + 8); // expand buffer
			this.output.set(ZU.u8(o2.buffer));
			o2 = this.output;
		} else o2 = ZU.u8(o2.buffer);
		const crc32 = CRC32.calc(input); // crc32 CRC-32 value for verification.
		o2[op2++] = crc32 & 0xff;
		o2[op2++] = (crc32 >>> 8) & 0xff;
		o2[op2++] = (crc32 >>> 16) & 0xff;
		o2[op2++] = (crc32 >>> 24) & 0xff;
		const il = input.length; // input size
		o2[op2++] = il & 0xff;
		o2[op2++] = (il >>> 8) & 0xff;
		o2[op2++] = (il >>> 16) & 0xff;
		o2[op2++] = (il >>> 24) & 0xff;
		this.ip = ip;
		const o3 = op2 < o2.length ? o2.subarray(0, op2) : o2;
		this.output = o3;
		return o3;
	}
}
class InflateStream {
	/**
	 * @param {!(Uint8Array)} input deflated buffer.
	 * @constructor
	 */
	constructor(input) {
		this.input = /** @type {!(Uint8Array)} */ input === void 0 ? ZU.u8() : input;
		this.ip = /** @type {number} */ 0;
		this.rawinflate = /** @type {RawInflateStream} */ new RawInflateStream(this.input, this.ip);
		this.method = /** @type {Zlib.CompressionMethod} */ void 0;
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
			const tmp = ZU.u8(this.input.length + input.length);
			tmp.set(this.input, 0);
			tmp.set(input, this.input.length);
			this.input = tmp;
		}
		if (this.method === void 0) if (this.readHeader() < 0) return ZU.u8();
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
        ZU.Err('invalid adler-32 checksum');
      }
    }
    */
		return buffer;
	}
	readHeader() {
		let ip = this.ip;
		const input = this.input,
			cmf = input[ip++], // Compression Method and Flags
			flg = input[ip++];
		if (cmf === void 0 || flg === void 0) return -1;
		switch (cmf & 0x0f) {
			case Zlib.CompressionMethod.DEFLATE: // compression method
				this.method = Zlib.CompressionMethod.DEFLATE;
				break;
			default:
				ZU.Err('unsupported compression method');
		}
		if (((cmf << 8) + flg) % 31 !== 0) ZU.Err(`invalid fcheck flag:${((cmf << 8) + flg) % 31}`); // fcheck
		if (flg & 0x20) ZU.Err('fdict flag is not supported'); // fdict (not supported)
		this.ip = ip;
	}
}
class Inflate {
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
	constructor(input, opt_params = {}) {
		this.input = /** @type {!(Uint8Array)} */ input;
		this.ip = /** @type {number} */ 0;
		if (opt_params.index) this.ip = opt_params.index; // option parameters
		if (opt_params.verify) this.verify = /** @type {(boolean|undefined)} verify flag. */ opt_params.verify;
		const cmf = /** @type {number} */ input[this.ip++], // Compression Method and Flags
			flg = /** @type {number} */ input[this.ip++];
		switch (cmf & 0x0f) {
			case Zlib.CompressionMethod.DEFLATE:
				this.method = Zlib.CompressionMethod.DEFLATE; // compression method
				break;
			default:
				ZU.Err('unsupported compression method');
		}
		if (((cmf << 8) + flg) % 31 !== 0) ZU.Err(`invalid fcheck flag:${((cmf << 8) + flg) % 31}`); // fcheck
		if (flg & 0x20) ZU.Err('fdict flag is not supported'); // fdict (not supported)
		this.rawinflate = /** @type {RawInflate} */ new RawInflate(input, {
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
		const input = /** @type {!(Uint8Array)} input buffer. */ this.input,
			buffer = /** @type {!(Uint8Array)} inflated buffer. */ this.rawinflate.decompress();
		this.ip = this.rawinflate.ip;
		if (this.verify) {
			// console.warn('decompress input:' + JSON.stringify(input), this.ip);
			const adler32 = // verify adler-32
				/** @type {number} adler-32 checksum */
				((input[this.ip++] << 24) | (input[this.ip++] << 16) | (input[this.ip++] << 8) | input[this.ip++]) >>>
				0;
			// console.warn('decompress adler32:' + adler32, Adler32.mkHash(buffer), buffer);
			if (adler32 !== Adler32.mkHash(buffer))
				ZU.Err('invalid adler-32 checksum ' + adler32 + '/' + Adler32.mkHash(buffer) + ' ' + '');
		}
		return buffer;
	}
}
class RawInflateStream {
	//-----------------------------------------------------------------------------
	/** @define {number} buffer block size. */
	static ZLIB_STREAM_RAW_INFLATE_BUFFER_SIZE = 0x8000;
	//-----------------------------------------------------------------------------
	/**
	 * @param {!(Uint8Array.<number>)} input input buffer.
	 * @param {number} ip input buffer pointer.decompress
	 * @param {number=} opt_buffersize buffer block size.
	 * @constructor
	 */
	constructor(input, ip, opt_buffersize) {
		this.blocks = /** @type {!Array.<(Uint8Array)>} */ [];
		this.bufferSize = /** @type {number} block size. */ opt_buffersize
			? opt_buffersize
			: RawInflateStream.ZLIB_STREAM_RAW_INFLATE_BUFFER_SIZE;
		this.totalpos = /** @type {!number} total output buffer pointer. */ 0;
		this.ip = ip === /** @type {!number} input buffer pointer. */ void 0 ? 0 : ip;
		this.bitsbuf = /** @type {!number} bit stream reader buffer. */ 0;
		this.bitsbuflen = /** @type {!number} bit stream reader buffer size. */ 0;
		this.input = /** @type {!(Uint8Array)} input buffer. */ ZU.u8(input);
		this.output = /** @type {!(Uint8Array)} output buffer. */ ZU.u8(this.bufferSize);
		this.op = /** @type {!number} output buffer pointer. */ 0;
		this.bfinal = /** @type {boolean} is final block flag. */ false;
		this.blockLength = /** @type {number} uncompressed block length. */ 0;
		this.resize = /** @type {boolean} resize flag for memory size optimization. */ false;
		this.litlenTable = /** @type {Array} */ void 0;
		this.distTable = /** @type {Array} */ void 0;
		this.sp = /** @type {number} */ 0; // stream pointer
		this.status = /** @type {RawInflateStream.Status} */ RawInflateStream.Status.INITIALIZED;
		//backup  //
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
		const S = RawInflateStream.Status,
			BT = RawInflateStream.BlockType;
		while (!stop)
			switch (this.status) {
				case S.INITIALIZED: // block header// decompress
				case S.BLOCK_HEADER_START:
					if (this.readBlockHeader() < 0) stop = true;
					break;
				case S.BLOCK_HEADER_END: /* FALLTHROUGH */ // block body
				case S.BLOCK_BODY_START:
					switch (this.currentBlockType) {
						case BT.UNCOMPRESSED:
							if (this.readUncompressedBlockHeader() < 0) stop = true;
							break;
						case BT.FIXED:
							if (this.parseFixedHuffmanBlock() < 0) stop = true;
							break;
						case BT.DYNAMIC:
							if (this.parseDynamicHuffmanBlock() < 0) stop = true;
							break;
					}
					break;
				case S.BLOCK_BODY_END: // decode data
				case S.DECODE_BLOCK_START:
					switch (this.currentBlockType) {
						case BT.UNCOMPRESSED:
							if (this.parseUncompressedBlock() < 0) stop = true;
							break;
						case BT.FIXED: /* FALLTHROUGH */
						case BT.DYNAMIC:
							if (this.decodeHuffman() < 0) stop = true;
							break;
					}
					break;
				case S.DECODE_BLOCK_END:
					if (this.bfinal) stop = true;
					else this.status = S.INITIALIZED;
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
	 * @type {!(Uint8Array)}
	 */
	static Order = ZU.u16([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
	/**
	 * huffman length code table.
	 * @const
	 * @type {!(Uint16Array)}
	 */
	static LengthCodeTable = ZU.u16([
		0x0003, 0x0004, 0x0005, 0x0006, 0x0007, 0x0008, 0x0009, 0x000a, 0x000b, 0x000d, 0x000f, 0x0011, 0x0013, 0x0017,
		0x001b, 0x001f, 0x0023, 0x002b, 0x0033, 0x003b, 0x0043, 0x0053, 0x0063, 0x0073, 0x0083, 0x00a3, 0x00c3, 0x00e3,
		0x0102, 0x0102, 0x0102,
	]);
	/**
	 * huffman length extra-bits table.
	 * @const
	 * @type {!(Uint8Array)}
	 */
	static LengthExtraTable = ZU.u8([
		0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0,
	]);
	/**
	 * huffman dist code table.
	 * @const
	 * @type {!(Uint16Array)}
	 */
	static DistCodeTable = ZU.u16([
		0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0007, 0x0009, 0x000d, 0x0011, 0x0019, 0x0021, 0x0031, 0x0041, 0x0061,
		0x0081, 0x00c1, 0x0101, 0x0181, 0x0201, 0x0301, 0x0401, 0x0601, 0x0801, 0x0c01, 0x1001, 0x1801, 0x2001, 0x3001,
		0x4001, 0x6001,
	]);
	/**
	 * huffman dist extra-bits table.
	 * @const
	 * @type {!(Uint8Array)}
	 */
	static DistExtraTable = ZU.u8([
		0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
	]);
	/**
	 * fixed huffman length code table
	 * @const
	 * @type {!Array}
	 */
	static FixedLiteralLengthTable = (function () {
		const lengths = ZU.u8(288);
		for (let i = 0, il = lengths.length; i < il; ++i) lengths[i] = i <= 143 ? 8 : i <= 255 ? 9 : i <= 279 ? 7 : 8;
		return Huffman.buildHuffmanTable(lengths);
	})();
	/**
	 * fixed huffman distance code table
	 * @const
	 * @type {!Array}
	 */
	static FixedDistanceTable = (function () {
		const lengths = ZU.u8(30);
		for (let i = 0, il = lengths.length; i < il; ++i) lengths[i] = 5;
		return Huffman.buildHuffmanTable(lengths);
	})();
	/**
	 * parse deflated block.
	 */
	readBlockHeader() {
		let hdr = /** @type {number} header */ this.readBits(3);
		const S = RawInflateStream.Status,
			BT = RawInflateStream.BlockType;
		this.status = S.BLOCK_HEADER_START;
		this.save_();
		if (hdr < 0) {
			this.restore_();
			return -1;
		}
		if (hdr & 0x1) this.bfinal = true; // BFINAL
		hdr >>>= 1; // BTYPE
		switch (hdr) {
			case 0: // uncompressed
				this.currentBlockType = BT.UNCOMPRESSED;
				break;
			case 1: // fixed huffman
				this.currentBlockType = BT.FIXED;
				break;
			case 2: // dynamic huffman
				this.currentBlockType = BT.DYNAMIC;
				break;
			default: // reserved or other
				ZU.Err(`unknown BTYPE: ${hdr}`);
		}
		this.status = S.BLOCK_HEADER_END;
	}
	/**
	 * read inflate bits
	 * @param {number} length bits length.
	 * @return {number} read bits.
	 */
	readBits(length) {
		const input = this.input;
		let bitsbuf = this.bitsbuf,
			bitsbuflen = this.bitsbuflen,
			ip = this.ip,
			octet = /** @type {number} input and output byte. */ 0;
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
		const input = this.input,
			codeTable = /** @type {!(Uint8Array)} huffman code table */ table[0],
			maxCodeLength = /** @type {number} */ table[1];
		let bitsbuf = this.bitsbuf,
			bitsbuflen = this.bitsbuflen,
			ip = this.ip,
			octet;
		/** @type {number} input byte */
		while (bitsbuflen < maxCodeLength) {
			if (input.length <= ip) return -1; // not enough buffer
			octet = input[ip++];
			bitsbuf |= octet << bitsbuflen;
			bitsbuflen += 8;
		}
		const codeWithLength =
				/** @type {number} code length & code (16bit, 16bit) */ codeTable[bitsbuf & ((1 << maxCodeLength) - 1)], // read max length
			codeLength = /** @type {number} code bits length */ codeWithLength >>> 16;
		if (codeLength > bitsbuflen) ZU.Err(`invalid code length: ${codeLength}`);
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
		const len = /** @type {number} block length */ input[ip++] | (input[ip++] << 8),
			nlen = /** @type {number} number for check block length */ input[ip++] | (input[ip++] << 8);
		if (len === ~nlen) ZU.Err('invalid uncompressed block header: length verify'); // check len & nlen
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
		let ip = this.ip,
			output = this.output,
			op = this.op,
			len = this.blockLength;
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
		const codeLengths = /** @type {!(Uint8Array)} code lengths. */ ZU.u8(RawInflateStream.Order.length);
		this.status = RawInflateStream.Status.BLOCK_BODY_START;
		this.save_();
		const hlit = /** @type {number} number of literal and length codes. */ this.readBits(5) + 257,
			hdist = /** @type {number} number of distance codes. */ this.readBits(5) + 1,
			hclen = /** @type {number} number of code lengths. */ this.readBits(4) + 4;
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
			if (bits < 0) ZU.Err('not enough input');
			codeLengths[RawInflateStream.Order[i]] = bits;
		}
		const h = hlit + hdist,
			codeLengthsTable = /** @type {!Array} code lengths table. */ Huffman.buildHuffmanTable(codeLengths), // decode length table
			lengthTable = /** @type {!(Uint8Array.<number>)} code length table. */ ZU.u8(h);
		for (let i = 0; i < h; ) {
			let bits = /** @type {number} */ 0;
			const c = this.readCodeByTable(codeLengthsTable);
			if (c < 0) ZU.Err('not enough input');
			let repeat;
			switch (c) {
				case 16:
					if ((bits = this.readBits(2)) < 0) ZU.Err('not enough input');
					repeat = 3 + bits;
					while (repeat--) lengthTable[i++] = prev;
					break;
				case 17:
					if ((bits = this.readBits(3)) < 0) ZU.Err('not enough input');
					repeat = 3 + bits;
					while (repeat--) lengthTable[i++] = 0;
					prev = 0;
					break;
				case 18:
					if ((bits = this.readBits(7)) < 0) ZU.Err('not enough input');
					repeat = 11 + bits;
					while (repeat--) lengthTable[i++] = 0;
					prev = 0;
					break;
				default:
					lengthTable[i++] = c;
					prev = c;
					break;
			}
		}
		// litlenLengths = ZU.u8(hlit); // literal and length code
		// distLengths = ZU.u8(hdist); // distance code
		this.litlenTable = Huffman.buildHuffmanTable(lengthTable.subarray(0, hlit));
		this.distTable = Huffman.buildHuffmanTable(lengthTable.subarray(hlit));
	}
	/**
	 * decode huffman code (dynamic)
	 * @return {(number|undefined)} -1 is error.
	 */
	decodeHuffman() {
		const litlen = this.litlenTable,
			dist = this.distTable;
		let o = this.output,
			op = this.op,
			olength = o.length;
		this.status = RawInflateStream.Status.DECODE_BLOCK_START;
		while (o) {
			this.save_();
			const c = /** @type {number} huffman code. */ this.readCodeByTable(litlen);
			if (c < 0) {
				this.op = op;
				this.restore_();
				return -1;
			}
			if (c === 256) break;
			if (c < 256) {
				if (op === olength) {
					o = this.expandBuffer(); // literal
					olength = o.length;
				}
				o[op++] = c;
				continue;
			}
			const ti = /** @type {number} table index. */ c - 257; // length code
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
				o = this.expandBuffer(); // lz77 decode
				olength = o.length;
			}
			while (codeLength--) o[op] = o[op++ - codeDist];
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
	}
	/**
	 * expand output buffer. (dynamic)
	 * @param {Object=} opt_param option parameters.
	 * @return {!(Uint8Array)} output buffer pointer.
	 */
	expandBuffer(opt_param) {
		const input = this.input,
			output = this.output;
		let ratio = /** @type {number} expantion ratio. */ (input.length / this.ip + 1) | 0,
			newSize = /** @type {number} new output buffer size. */ 0;
		if (opt_param) {
			if (typeof opt_param.fixRatio === 'number') ratio = opt_param.fixRatio;
			if (typeof opt_param.addRatio === 'number') ratio += opt_param.addRatio;
		}
		if (ratio < 2) {
			const maxHuffCode =
					/** @type {number} maximum number of huffman code. */ (input.length - this.ip) /
					this.litlenTable[2], // calculate new buffer size
				maxInflateSize = /** @type {number} max inflate size. */ ((maxHuffCode / 2) * 258) | 0;
			newSize = maxInflateSize < output.length ? output.length + maxInflateSize : output.length << 1;
		} else newSize = output.length * ratio;
		const buffer = /** @type {!(Uint8Array)} store buffer. */ ZU.u8(newSize); // buffer expantion
		buffer.set(output);
		this.output = buffer;
		return this.output;
	}
	/**
	 * concat output buffer. (dynamic)
	 * @return {!(Uint8Array)} output buffer.
	 */
	concatBuffer() {
		const op = /** @type {number} */ this.op,
			buffer = /** @type {!(Uint8Array)} output buffer. */ this.resize
				? ZU.u8(this.output.subarray(this.sp, op))
				: this.output.subarray(this.sp, op),
			MBL = RawInflateStream.MaxBackwardLength,
			tmp = /** @type {Uint8Array} */ (this.output);
		this.sp = op;
		if (op > MBL + this.bufferSize) {
			this.op = this.sp = MBL; // compaction
			this.output = ZU.u8(this.bufferSize + MBL);
			this.output.set(tmp.subarray(op - MBL, op));
		}
		return buffer;
	}
}
export class RawInflate {
	//-----------------------------------------------------------------------------
	/** @define {number} buffer block size. */
	static ZLIB_RAW_INFLATE_BUFFER_SIZE = 0x8000; // [ 0x8000 >= ZLIB_BUFFER_BLOCK_SIZE ]
	//-----------------------------------------------------------------------------
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
	static Order = ZU.u16([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
	/**
	 * huffman length code table.
	 * @const
	 * @type {!(Uint16Array)}
	 */
	static LengthCodeTable = ZU.u16([
		0x0003, 0x0004, 0x0005, 0x0006, 0x0007, 0x0008, 0x0009, 0x000a, 0x000b, 0x000d, 0x000f, 0x0011, 0x0013, 0x0017,
		0x001b, 0x001f, 0x0023, 0x002b, 0x0033, 0x003b, 0x0043, 0x0053, 0x0063, 0x0073, 0x0083, 0x00a3, 0x00c3, 0x00e3,
		0x0102, 0x0102, 0x0102,
	]);
	/**
	 * huffman length extra-bits table.
	 * @const
	 * @type {!(Uint8Array)}
	 */
	static LengthExtraTable = ZU.u8([
		0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0,
	]);
	/**
	 * huffman dist code table.
	 * @const
	 * @type {!(Uint16Array)}
	 */
	static DistCodeTable = ZU.u16([
		0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0007, 0x0009, 0x000d, 0x0011, 0x0019, 0x0021, 0x0031, 0x0041, 0x0061,
		0x0081, 0x00c1, 0x0101, 0x0181, 0x0201, 0x0301, 0x0401, 0x0601, 0x0801, 0x0c01, 0x1001, 0x1801, 0x2001, 0x3001,
		0x4001, 0x6001,
	]);
	/**
	 * huffman dist extra-bits table.
	 * @const
	 * @type {!(Uint8Array)}
	 */
	static DistExtraTable = ZU.u8([
		0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
	]);
	/**
	 * fixed huffman length code table
	 * @const
	 * @type {!Array}
	 */
	static FixedLiteralLengthTable = (function () {
		const lengths = ZU.u8(288);
		for (let i = 0; i < 288; ++i) lengths[i] = i <= 143 ? 8 : i <= 255 ? 9 : i <= 279 ? 7 : 8;
		return Huffman.buildHuffmanTable(lengths);
	})();
	/**
	 * fixed huffman distance code table
	 * @const
	 * @type {!Array}
	 */
	static FixedDistanceTable = (function () {
		const lengths = ZU.u8(30);
		for (let i = 0; i < 30; ++i) lengths[i] = 5;
		return Huffman.buildHuffmanTable(lengths);
	})();
	/**
	 * @constructor
	 * @param {!(Uint8Array.<number>)} input input buffer.
	 * @param {Object} opt_params option parameter.
	 *
	 * opt_params は以下のプロパティを指定する事ができます。
	 *   - index: input buffer の deflate コンテナの開始位置.
	 *   - blockSize: バッファのブロックサイズ.
	 *   - bufferType: Zlib.RawInflate.BufferType の値によってバッファの管理方法を指定する.
	 *   - resize: 確保したバッファが実際の大きさより大きかった場合に切り詰める.
	 */
	constructor(input, opt_params = {}) {
		this.buffer = /** @type {!(Uint8Array)} inflated buffer */ void 0;
		this.blocks = /** @type {!Array.<(Uint8Array)>} */ [];
		this.bufferSize = /** @type {number} block size. */ RawInflate.ZLIB_RAW_INFLATE_BUFFER_SIZE;
		this.totalpos = /** @type {!number} total output buffer pointer. */ 0;
		this.ip = /** @type {!number} input buffer pointer. */ 0;
		this.bitsbuf = /** @type {!number} bit stream reader buffer. */ 0;
		this.bitsbuflen = /** @type {!number} bit stream reader buffer size. */ 0;
		this.input = /** @type {!(Uint8Array)} input buffer. */ ZU.u8(input);
		this.output = /** @type {!(Uint8Array.<number>)} output buffer. */ void 0;
		this.op = /** @type {!number} output buffer pointer. */ void 0;
		this.bfinal = /** @type {boolean} is final block flag. */ false;
		this.bufferType = /** @type {RawInflate.BufferType} buffer management. */ RawInflate.BufferType.ADAPTIVE;
		this.resize = /** @type {boolean} resize flag for memory size optimization. */ false;
		if (opt_params.index) this.ip = opt_params.index;
		if (opt_params.bufferSize) this.bufferSize = opt_params.bufferSize;
		if (opt_params.bufferType) this.bufferType = opt_params.bufferType;
		if (opt_params.resize) this.resize = opt_params.resize;
		switch (this.bufferType) {
			case RawInflate.BufferType.BLOCK:
				this.op = RawInflate.MaxBackwardLength;
				this.output = ZU.u8(RawInflate.MaxBackwardLength + this.bufferSize + RawInflate.MaxCopyLength);
				break;
			case RawInflate.BufferType.ADAPTIVE:
				this.op = 0;
				this.output = ZU.u8(this.bufferSize);
				break;
			default:
				ZU.Err('invalid inflate mode');
		}
	}
	/**
	 * decompress.
	 * @return {!(Uint8Array.<number>)} inflated buffer.
	 */
	decompress() {
		while (!this.bfinal) this.parseBlock();
		switch (this.bufferType) {
			case RawInflate.BufferType.BLOCK:
				return this.concatBufferBlock();
			case RawInflate.BufferType.ADAPTIVE:
				return this.concatBufferDynamic();
			default:
				ZU.Err('invalid inflate mode');
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
				ZU.Err(`unknown BTYPE: ${hdr}`); // reserved or other
		}
	}
	/**
	 * read inflate bits
	 * @param {number} length bits length.
	 * @return {number} read bits.
	 */
	readBits(length, msg = '') {
		const z = this,
			input = z.input;
		let bitsbuf = z.bitsbuf,
			bitsbuflen = z.bitsbuflen,
			ip = z.ip;
		if (ip + ((length - bitsbuflen + 7) >> 3) >= input.length) ZU.Err('input buffer is broken'); // input byte
		while (bitsbuflen < length) {
			const a = input[ip++];
			bitsbuf |= a << bitsbuflen; // not enough buffer
			bitsbuflen += 8;
		}
		const octet = bitsbuf & /* MASK */ ((1 << length) - 1); //input and output byte.// output byte
		bitsbuf >>>= length;
		bitsbuflen -= length;
		z.bitsbuf = bitsbuf;
		z.bitsbuflen = bitsbuflen;
		z.ip = ip;
		return octet;
	}
	/**
	 * read huffman code using table
	 * @param {!(Uint8Array|Uint16Array)} table huffman code table.
	 * @return {number} huffman code.
	 */
	readCodeByTable(table) {
		const z = this,
			input = z.input,
			inputLength = input.length,
			codeTable = /** @type {!(Uint8Array)} huffman code table */ table[0],
			maxCodeLength = table[1];
		let bitsbuf = z.bitsbuf,
			bitsbuflen = z.bitsbuflen,
			ip = z.ip;
		while (bitsbuflen < maxCodeLength) {
			if (ip >= inputLength) break; // not enough buffer
			bitsbuf |= input[ip++] << bitsbuflen;
			bitsbuflen += 8;
		}
		const codeWithLength = codeTable[bitsbuf & ((1 << maxCodeLength) - 1)], //code length & code (16bit, 16bit) // read max length
			codeLength = codeWithLength >>> 16; //code bits length
		if (codeLength > bitsbuflen) ZU.Err(`invalid code length: ${codeLength}`);
		z.bitsbuf = bitsbuf >> codeLength;
		z.bitsbuflen = bitsbuflen - codeLength;
		z.ip = ip;
		return codeWithLength & 0xffff;
	}
	/**
	 * parse uncompressed block.
	 */
	parseUncompressedBlock() {
		const z = this,
			input = z.input,
			inputLength = input.length,
			olength = z.output.length; //output buffer length
		let ip = z.ip,
			o = z.output,
			op = z.op;
		z.bitsbuf = 0; // skip buffered header bits
		z.bitsbuflen = 0;
		if (ip + 1 >= inputLength) ZU.Err('invalid uncompressed block header: LEN');
		let len = input[ip++] | (input[ip++] << 8); // len block length
		if (ip + 1 >= inputLength) ZU.Err('invalid uncompressed block header: NLEN');
		const nlen = input[ip++] | (input[ip++] << 8); // nlen number for check block length
		if (len === ~nlen) ZU.Err('invalid uncompressed block header: length verify'); // check len & nlen
		if (ip + len > inputLength) ZU.Err('input buffer is broken'); // check size
		switch (z.bufferType) {
			case RawInflate.BufferType.BLOCK: // pre copy
				while (op + len > o.length) {
					const preCopy = olength - op; //copy counter
					len -= preCopy;
					o.set(input.subarray(ip, ip + preCopy), op);
					op += preCopy;
					ip += preCopy;
					z.op = op;
					o = z.expandBufferBlock(); // expand buffer
					op = z.op;
				}
				break;
			case RawInflate.BufferType.ADAPTIVE:
				while (op + len > o.length) o = z.expandBufferAdaptive({ fixRatio: 2 });
				break;
			default:
				ZU.Err('invalid inflate mode');
		}
		o.set(input.subarray(ip, ip + len), op); // copy
		op += len;
		ip += len;
		z.ip = ip;
		z.op = op;
		z.output = o;
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
				ZU.Err('invalid inflate mode');
		}
	}
	/**
	 * parse dynamic huffman block.
	 */
	parseDynamicHuffmanBlock() {
		const hlit = /** @type {number} number of literal and length codes. */ this.readBits(5) + 257,
			hdist = /** @type {number} number of distance codes. */ this.readBits(5) + 1,
			hclen = /** @type {number} number of code lengths. */ this.readBits(4) + 4,
			codeLengths = /** @type {!(Uint8Array.<number>)} code lengths. */ ZU.u8(RawInflate.Order.length);
		let prev = /** @type {number} */ 0,
			repeat = /** @type {number} */ 0;
		for (let i = 0; i < hclen; ++i) codeLengths[RawInflate.Order[i]] = this.readBits(3); // decode code lengths
		const codeLengthsTable = Huffman.buildHuffmanTable(codeLengths), //code lengths table. decode length table
			len = hlit + hdist,
			lengthTable = ZU.u8(len); //code length table.
		for (let i = 0; i < len; ) {
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
		const litlenTable = Huffman.buildHuffmanTable(lengthTable.subarray(0, hlit)), //literal and length code table.
			distTable = Huffman.buildHuffmanTable(lengthTable.subarray(hlit)); //distance code table.
		switch (this.bufferType) {
			case RawInflate.BufferType.ADAPTIVE:
				this.decodeHuffmanAdaptive(litlenTable, distTable);
				break;
			case RawInflate.BufferType.BLOCK:
				this.decodeHuffmanBlock(litlenTable, distTable);
				break;
			default:
				ZU.Err('invalid inflate mode');
		}
	}
	/**
	 * decode huffman code
	 * @param {!(Uint16Array)} litlen literal and length code table.
	 * @param {!(Uint8Array)} dist distination code table.
	 */
	decodeHuffmanBlock(litlen, dist) {
		let o = this.output,
			op = this.op,
			c; //huffman code.
		this.currentLitlenTable = litlen;
		const olength = o.length - RawInflate.MaxCopyLength, //output position limit.
			lengthCodeTable = RawInflate.LengthCodeTable,
			lengthExtraTable = RawInflate.LengthExtraTable,
			distCodeTable = RawInflate.DistCodeTable,
			distExtraTable = RawInflate.DistExtraTable;
		while ((c = this.readCodeByTable(litlen)) !== 256) {
			if (c === 0) return;
			if (c < 256) {
				if (op >= olength) {
					this.op = op; // literal
					o = this.expandBufferBlock();
					op = this.op;
				}
				o[op++] = c;
				continue;
			}
			const ti = c - 257; // length code
			let codeLength = lengthCodeTable[ti]; //huffman code length.
			if (lengthExtraTable[ti] > 0) codeLength += this.readBits(lengthExtraTable[ti]);
			c = this.readCodeByTable(dist); // dist code
			let codeDist = distCodeTable[c]; //huffman code distination.
			if (distExtraTable[c] > 0) codeDist += this.readBits(distExtraTable[c]);
			if (op >= olength) {
				this.op = op; // lz77 decode
				o = this.expandBufferBlock();
				op = this.op;
			}
			while (codeLength--) o[op] = o[op++ - codeDist];
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
		let o = this.output,
			op = this.op,
			olength = o.length, //output position limit.
			c; //huffman code.
		this.currentLitlenTable = litlen;
		const lengthCodeTable = RawInflate.LengthCodeTable,
			lengthExtraTable = RawInflate.LengthExtraTable,
			distCodeTable = RawInflate.DistCodeTable,
			distExtraTable = RawInflate.DistExtraTable;
		while ((c = this.readCodeByTable(litlen)) !== 256) {
			if (c < 256) {
				if (op >= olength) {
					o = this.expandBufferAdaptive(); // literal
					olength = o.length;
				}
				o[op++] = c;
				continue;
			}
			const ti = c - 257; // length code
			let codeLength = lengthCodeTable[ti]; //huffman code length.
			if (lengthExtraTable[ti] > 0) codeLength += this.readBits(lengthExtraTable[ti]);
			const codeD = this.readCodeByTable(dist); // dist code
			let codeDist = distCodeTable[codeD]; //huffman code distination.
			if (distExtraTable[codeD] > 0) codeDist += this.readBits(distExtraTable[codeD]);
			if (op + codeLength > olength) {
				o = this.expandBufferAdaptive(); // lz77 decode
				olength = o.length;
			}
			while (codeLength--) o[op] = o[op++ - codeDist];
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
		const MBL = RawInflate.MaxBackwardLength,
			backward = this.op - MBL, //backward base point
			buffer = ZU.u8(backward), //store buffer.
			o = this.output;
		buffer.set(o.subarray(MBL, buffer.length)); // copy to output buffer
		this.blocks.push(buffer);
		this.totalpos += buffer.length;
		o.set(o.subarray(backward, backward + MBL)); // copy to backward buffer
		this.op = MBL;
		return o;
	}
	/**
	 * expand output buffer. (adaptive)
	 * @param {Object=} opt_param option parameters.
	 * @return {!(Uint8Array)} output buffer pointer.
	 */
	expandBufferAdaptive(opt_param = {}) {
		let ratio = (this.input.length / this.ip + 1) | 0, //expantion ratio.
			newSize; //new output buffer size.
		const input = this.input,
			o = this.output,
			currentLen = o.length;
		if (currentLen === MAX_FIREFOX_SIZE) ZU.Err('TOO LOG LENGTH OF BUFFER ADAPTIVE!');
		if (typeof opt_param.fixRatio === 'number') ratio = opt_param.fixRatio;
		if (typeof opt_param.addRatio === 'number') ratio += opt_param.addRatio;
		if (ratio < 2) {
			const maxHuffCode = (input.length - this.ip) / this.currentLitlenTable[2], // calculate new buffer size //maximum number of huffman code.
				maxInflateSize = ((maxHuffCode / 2) * 258) | 0; //max inflate size.
			newSize = maxInflateSize < currentLen ? currentLen + maxInflateSize : currentLen << 1;
		} else newSize = currentLen * ratio;
		const newSizeAdaptiveMax = MAX_FIREFOX_SIZE > newSize ? newSize : MAX_FIREFOX_SIZE,
			buf = ZU.u8(newSizeAdaptiveMax); // buffer expantion //store buffer.
		buf.set(o);
		this.output = buf;
		return this.output;
	}
	/**
	 * concat output buffer.
	 * @return {!(Uint8Array)} output buffer.
	 */
	concatBufferBlock() {
		let pos = 0; //buffer pointer.
		const MBL = RawInflate.MaxBackwardLength,
			limit = this.totalpos + (this.op - MBL), //buffer pointer.
			o = this.output, //output block array.
			blocks = this.blocks, //blocks array.
			buf = ZU.u8(limit); //output buffer.
		if (blocks.length === 0) return o.subarray(MBL, this.op); // single buffer
		for (const block of blocks) for (let j = 0, jl = block.length; j < jl; ++j) buf[pos++] = block[j]; // copy to buffer
		for (let i = MBL, il = this.op; i < il; ++i) buf[pos++] = o[i]; // current buffer
		this.blocks = [];
		this.buffer = buf;
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
			buffer = ZU.u8(op);
			buffer.set(this.output.subarray(0, op));
		} else buffer = this.output.subarray(0, op);
		this.buffer = buffer;
		return this.buffer;
	}
}
export class Unzip extends Zip {
	/**
	 * @param {!(Uint8Array)} input input buffer.
	 * @param {Object=} opt_params options.
	 * @constructor
	 */
	constructor(input, opt_params = {}) {
		super();
		this.input = /** @type {!(Uint8Array)} */ input instanceof Array ? ZU.u8(input) : input;
		this.ip = /** @type {number} */ 0;
		this.eocdrOffset = /** @type {number} */ 0;
		this.numberOfThisDisk = /** @type {number} */ 0;
		this.startDisk = /** @type {number} */ 0;
		this.totalEntriesThisDisk = /** @type {number} */ 0;
		this.totalEntries = /** @type {number} */ 0;
		this.centralDirectorySize = /** @type {number} */ 0;
		this.centralDirectoryOffset = /** @type {number} */ void 0;
		this.commentLength = /** @type {number} */ 0;
		this.comment = /** @type {(Uint8Array)} */ void 0;
		this.fileHeaderList = /** @type {Array.<Zlib.Unzip.FileHeader>} */ void 0;
		this.filenameToIndex = /** @type {Object.<string, number>} */ void 0;
		this.verify = /** @type {boolean} */ opt_params.verify || false;
		this.password = /** @type {(Uint8Array)} */ opt_params.password;
	}
	static CompressionMethod = Zip.CompressionMethod;
	static updateKeys = Zip.updateKeys;
	static createDecryptionKey = Zip.createEncryptionKey;
	static getByte = Zip.getByte;
	/**
	 * @type {Array.<number>}
	 * @const
	 */
	static FileHeaderSignature = Zip.FileHeaderSignature;
	/**
	 * @type {Array.<number>}
	 * @const
	 */
	static LocalFileHeaderSignature = Zip.LocalFileHeaderSignature;
	/**
	 * @type {Array.<number>}
	 * @const
	 */
	static CentralDirectorySignature = Zip.CentralDirectorySignature;
	searchEndOfCentralDirectoryRecord() {
		const input = this.input,
			CDS = Unzip.CentralDirectorySignature;
		for (let ip = input.length - 12; ip > 0; --ip) {
			if (
				input[ip] === CDS[0] &&
				input[ip + 1] === CDS[1] &&
				input[ip + 2] === CDS[2] &&
				input[ip + 3] === CDS[3]
			) {
				this.eocdrOffset = ip;
				return;
			}
		}
		ZU.Err('End of Central Directory Record not found');
	}
	parseEndOfCentralDirectoryRecord() {
		const input = this.input,
			CDS = Unzip.CentralDirectorySignature;
		if (!this.eocdrOffset) this.searchEndOfCentralDirectoryRecord();
		let ip = this.eocdrOffset;
		if (input[ip++] !== CDS[0] || input[ip++] !== CDS[1] || input[ip++] !== CDS[2] || input[ip++] !== CDS[3]) {
			ZU.Err('invalid signature'); // signature
		}
		this.numberOfThisDisk = input[ip++] | (input[ip++] << 8); // number of this disk
		this.startDisk = input[ip++] | (input[ip++] << 8); // number of the disk with the start of the central directory
		this.totalEntriesThisDisk = input[ip++] | (input[ip++] << 8); // total number of entries in the central directory on this disk
		this.totalEntries = input[ip++] | (input[ip++] << 8); // total number of entries in the central directory
		this.centralDirectorySize =
			(input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24)) >>> 0; // size of the central directory
		this.centralDirectoryOffset =
			(input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24)) >>> 0; // offset of start of central directory with respect to the starting disk number
		this.commentLength = input[ip++] | (input[ip++] << 8); // .ZIP file comment length
		this.comment = input.subarray(ip, ip + this.commentLength); // .ZIP file comment
	}
	parseFileHeader() {
		if (this.fileHeaderList) return;
		if (this.centralDirectoryOffset === void 0) this.parseEndOfCentralDirectoryRecord();
		let ip = this.centralDirectoryOffset;
		const filelist = [],
			filetable = {};
		for (let i = 0, il = this.totalEntries; i < il; ++i) {
			const fileHeader = new FileHeader(this.input, ip);
			ip += fileHeader.length;
			filelist[i] = fileHeader;
			filetable[fileHeader.filename] = i;
		}
		if (this.centralDirectorySize < ip - this.centralDirectoryOffset) ZU.Err('invalid file header size');
		this.fileHeaderList = filelist;
		this.filenameToIndex = filetable;
	}
	/**
	 * @param {number} index file header index.
	 * @param {Object=} opt_params
	 * @return {!(Uint8Array)} file data.
	 */
	getFileData(index, opt_params = {}) {
		const input = this.input,
			fileHeaderList = this.fileHeaderList;
		if (!fileHeaderList) this.parseFileHeader();
		if (fileHeaderList[index] === void 0) ZU.Err('wrong index');
		let offset = fileHeaderList[index].relativeOffset;
		const lFH = new LocalFileHeader(this.input, offset);
		offset += lFH.length;
		let length = lFH.compressedSize;
		if ((lFH.flags & LocalFileHeader.Flags.ENCRYPT) !== 0) {
			if (!(opt_params.password || this.password)) ZU.Err('please set password'); // decryption
			const key = Unzip.createDecryptionKey(opt_params.password || this.password);
			for (let i = offset, il = offset + 12; i < il; ++i) Unzip.decode(key, input[i]); // encryption header
			offset += 12;
			length -= 12;
			for (let i = offset, il = offset + length; i < il; ++i) input[i] = Unzip.decode(key, input[i]); // decryption
		}
		let buf;
		switch (lFH.compression) {
			case Unzip.CompressionMethod.STORE:
				buf = input.subarray(offset, offset + length);
				break;
			case Unzip.CompressionMethod.DEFLATE:
				buf = new RawInflate(input, {
					index: offset,
					bufferSize: lFH.plainSize,
				}).decompress();
				break;
			default:
				ZU.Err('unknown compression type');
		}
		if (this.verify) {
			const crc32 = CRC32.calc(buf);
			if (lFH.crc32 !== crc32)
				ZU.Err(`wrong crc: file=0x${lFH.crc32.toString(16)}, data=0x${crc32.toString(16)}`);
		}
		return buf;
	}
	/**
	 * @return {Array.<string>}
	 */
	getFilenames() {
		const fNL = [];
		if (!this.fileHeaderList) this.parseFileHeader();
		const fHL = this.fileHeaderList;
		for (let i = 0, il = fHL.length; i < il; ++i) fNL[i] = fHL[i].filename;
		return fNL;
	}
	/**
	 * @param {string} filename extract filename.
	 * @param {Object=} opt_params
	 * @return {!(Uint8Array)} decompressed data.
	 */
	decompress(filename, opt_params) {
		if (!this.filenameToIndex) this.parseFileHeader();
		const idx = this.filenameToIndex[filename];
		if (idx === void 0) ZU.Err(`${filename} not found`);
		return this.getFileData(idx, opt_params);
	}
	/**
	 * @param {(Uint8Array)} password
	 */
	setPassword(password) {
		this.password = password;
	}
	/**
	 * @param {(Uint32Array|Object)} key
	 * @param {number} n
	 * @return {number}
	 */
	static decode(key, n) {
		n ^= Unzip.getByte(/** @type {(Uint32Array)} */ (key));
		Unzip.updateKeys(/** @type {(Uint32Array)} */ (key), n);
		return n;
	}
}
Zlib.Zip = Zip;
Zlib.Zip.CompressionMethod = Zlib.CompressionMethod;
Zlib.Gunzip = Gunzip;
Zlib.Gzip = Gzip;
Zlib.Deflate = Deflate;
Zlib.InflateStream = InflateStream;
Zlib.Inflate = Inflate;
Zlib.RawDeflate = RawDeflate;
Zlib.RawInflateStream = RawInflateStream;
Zlib.RawInflate = RawInflate;
Zlib.Unzip = Unzip;
