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
		const t = /** @type {!Array.<(string|number)>} */ str.split('');
		for (let i = 0, il = t.length; i < il; i++) t[i] = (t[i].charCodeAt(0) & 0xff) >>> 0;
		return t;
	}
	static Err = (m) => {
		// console.error(m);
		throw new Error(m);
	};
	static a = (n) => new Array(n);
	static u8 = (n) => new Uint8Array(n);
	static u16 = (n) => new Uint16Array(n);
	static u32 = (n) => new Uint32Array(n);
	static isN = (n) => typeof n === 'number';
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
		3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227,
		258, 258, 258,
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
		1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097,
		6145, 8193, 12289, 16385, 24577,
	]);
	/**
	 * huffman dist extra-bits table.
	 * @const
	 * @type {!(Uint8Array)}
	 */
	static DistExtraTable = ZU.u8([
		0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
	]);
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
		const z = this,
			i = z.input,
			FS = Unzip.FileHeaderSignature;
		let p = z.offset;
		if (i[p++] !== FS[0] || i[p++] !== FS[1] || i[p++] !== FS[2] || i[p++] !== FS[3])
			ZU.Err('invalid file header signature'); // central file header signature
		z.version = i[p++]; // version made by
		z.os = i[p++];
		z.needVersion = i[p++] | (i[p++] << 8); // version needed to extract
		z.flags = i[p++] | (i[p++] << 8); // general purpose bit flag
		z.compression = i[p++] | (i[p++] << 8); // compression method
		z.time = i[p++] | (i[p++] << 8); // last mod file time
		z.date = i[p++] | (i[p++] << 8); //last mod file date
		z.crc32 = (i[p++] | (i[p++] << 8) | (i[p++] << 16) | (i[p++] << 24)) >>> 0; // crc-32
		z.compressedSize = (i[p++] | (i[p++] << 8) | (i[p++] << 16) | (i[p++] << 24)) >>> 0; // compressed size
		z.plainSize = (i[p++] | (i[p++] << 8) | (i[p++] << 16) | (i[p++] << 24)) >>> 0; // uncompressed size
		z.fileNameLength = i[p++] | (i[p++] << 8); // file name length
		z.extraFieldLength = i[p++] | (i[p++] << 8); // extra field length
		z.fileCommentLength = i[p++] | (i[p++] << 8); // file comment length
		z.diskNumberStart = i[p++] | (i[p++] << 8); // disk number start
		z.internalFileAttributes = i[p++] | (i[p++] << 8); // internal file attributes
		z.externalFileAttributes = i[p++] | (i[p++] << 8) | (i[p++] << 16) | (i[p++] << 24); // external file attributes
		z.relativeOffset = (i[p++] | (i[p++] << 8) | (i[p++] << 16) | (i[p++] << 24)) >>> 0; // relative offset of local header
		z.filename = String.fromCharCode.apply(null, i.subarray(p, (p += z.fileNameLength))); // file name
		z.extraField = i.subarray(p, (p += z.extraFieldLength)); // extra field
		z.comment = i.subarray(p, p + z.fileCommentLength); // file comment
		z.length = p - z.offset;
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
			l = /** @type {number} array length */ array.length,
			i = /** @type {number} array index */ 0;
		while (l > 0) {
			/** @type {number} loop length (don't overflow) */
			let tlen = l > Adler32.OptimizationParameter ? Adler32.OptimizationParameter : l;
			l -= tlen;
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
		const z = this;
		z.index = /** @type {number} buffer index. */ ZU.isN(bufferPosition) ? bufferPosition : 0;
		z.bitindex = /** @type {number} bit index. */ 0;
		/** @type {!(Uint8Array)} bit-stream output buffer. */
		z.buffer = buffer instanceof Uint8Array ? buffer : ZU.u8(BitStream.DefaultBlockSize);
		// 入力された index が足りなかったら拡張するが、倍にしてもダメなら不正とする
		if (z.buffer.length * 2 <= z.index) ZU.Err('invalid index');
		else if (z.buffer.length <= z.index) z.expandBuffer();
	}
	/**
	 * expand buffer.
	 * @return {!(Uint8Array)} new buffer.
	 */
	expandBuffer() {
		const oldbuf = /** @type {!(Uint8Array)} old buffer. */ this.buffer,
			buf = /** @type {!(Uint8Array)} new buffer. */ ZU.u8(oldbuf.length << 1);
		buf.set(oldbuf); // copy buffer
		return (this.buffer = buf);
	}
	/**
	 * 数値をビットで指定した数だけ書き込む.
	 * @param {number} number 書き込む数値.
	 * @param {number} n 書き込むビット数.
	 * @param {boolean=} reverse 逆順に書き込むならば true.
	 */
	writeBits(number, n, reverse) {
		const z = this;
		let buf = z.buffer,
			idx = z.index,
			bIdx = z.bitindex,
			current = /** @type {number} current octet. */ buf[idx];
		if (reverse && n > 1)
			number = n > 8 ? BitStream.rev32_(number) >> (32 - n) : BitStream.ReverseTable[number] >> (8 - n);
		if (n + bIdx < 8) {
			current = (current << n) | number; // Byte 境界を超えないとき
			bIdx += n;
		} else {
			for (let i = 0; i < n; ++i) {
				current = (current << 1) | ((number >> (n - i - 1)) & 1); // Byte 境界を超えるとき
				if (++bIdx === 8) {
					bIdx = 0; // next byte
					buf[idx++] = BitStream.ReverseTable[current];
					current = 0;
					if (idx === buf.length) buf = z.expandBuffer(); // expand
				}
			}
		}
		buf[idx] = current;
		z.buffer = buf;
		z.bitindex = bIdx;
		z.index = idx;
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
			fn = (n) => {
				let r = n,
					s = 7;
				for (n >>>= 1; n; n >>>= 1) {
					r <<= 1;
					r |= n & 1;
					--s;
				}
				return ((r << s) & 0xff) >>> 0;
			};
		for (let i = 0; i < 256; ++i) t[i] = fn(i); // generate
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
			il = ZU.isN(length) ? length : data.length;
		let i = ZU.isN(pos) ? pos : (pos = 0);
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
		0, 1996959894, 3993919788, 2567524794, 124634137, 1886057615, 3915621685, 2657392035, 249268274, 2044508324,
		3772115230, 2547177864, 162941995, 2125561021, 3887607047, 2428444049, 498536548, 1789927666, 4089016648,
		2227061214, 450548861, 1843258603, 4107580753, 2211677639, 325883990, 1684777152, 4251122042, 2321926636,
		335633487, 1661365465, 4195302755, 2366115317, 997073096, 1281953886, 3579855332, 2724688242, 1006888145,
		1258607687, 3524101629, 2768942443, 901097722, 1119000684, 3686517206, 2898065728, 853044451, 1172266101,
		3705015759, 2882616665, 651767980, 1373503546, 3369554304, 3218104598, 565507253, 1454621731, 3485111705,
		3099436303, 671266974, 1594198024, 3322730930, 2970347812, 795835527, 1483230225, 3244367275, 3060149565,
		1994146192, 31158534, 2563907772, 4023717930, 1907459465, 112637215, 2680153253, 3904427059, 2013776290,
		251722036, 2517215374, 3775830040, 2137656763, 141376813, 2439277719, 3865271297, 1802195444, 476864866,
		2238001368, 4066508878, 1812370925, 453092731, 2181625025, 4111451223, 1706088902, 314042704, 2344532202,
		4240017532, 1658658271, 366619977, 2362670323, 4224994405, 1303535960, 984961486, 2747007092, 3569037538,
		1256170817, 1037604311, 2765210733, 3554079995, 1131014506, 879679996, 2909243462, 3663771856, 1141124467,
		855842277, 2852801631, 3708648649, 1342533948, 654459306, 3188396048, 3373015174, 1466479909, 544179635,
		3110523913, 3462522015, 1591671054, 702138776, 2966460450, 3352799412, 1504918807, 783551873, 3082640443,
		3233442989, 3988292384, 2596254646, 62317068, 1957810842, 3939845945, 2647816111, 81470997, 1943803523,
		3814918930, 2489596804, 225274430, 2053790376, 3826175755, 2466906013, 167816743, 2097651377, 4027552580,
		2265490386, 503444072, 1762050814, 4150417245, 2154129355, 426522225, 1852507879, 4275313526, 2312317920,
		282753626, 1742555852, 4189708143, 2394877945, 397917763, 1622183637, 3604390888, 2714866558, 953729732,
		1340076626, 3518719985, 2797360999, 1068828381, 1219638859, 3624741850, 2936675148, 906185462, 1090812512,
		3747672003, 2825379669, 829329135, 1181335161, 3412177804, 3160834842, 628085408, 1382605366, 3423369109,
		3138078467, 570562233, 1426400815, 3317316542, 2998733608, 733239954, 1555261956, 3268935591, 3050360625,
		752459403, 1541320221, 2607071920, 3965973030, 1969922972, 40735498, 2617837225, 3943577151, 1913087877,
		83908371, 2512341634, 3803740692, 2075208622, 213261112, 2463272603, 3855990285, 2094854071, 198958881,
		2262029012, 4057260610, 1759359992, 534414190, 2176718541, 4139329115, 1873836001, 414664567, 2282248934,
		4279200368, 1711684554, 285281116, 2405801727, 4167216745, 1634467795, 376229701, 2685067896, 3608007406,
		1308918612, 956543938, 2808555105, 3495958263, 1231636301, 1047427035, 2932959818, 3654703836, 1088359270,
		936918e3, 2847714899, 3736837829, 1202900863, 817233897, 3183342108, 3401237130, 1404277552, 615818150,
		3134207493, 3453421203, 1423857449, 601450431, 3009837614, 3294710456, 1567103746, 711928724, 3020668471,
		3272380065, 1510334235, 755167117,
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
		const z = this,
			h = z.buffer; // ルートノードにたどり着くまで入れ替えを試みる
		let current = z.length;
		h[z.length++] = value;
		h[z.length++] = index;
		while (current > 0) {
			const pt = Heap.getParent(current); // 親ノードと比較して親の方が小さければ入れ替える
			if (h[current] > h[pt]) {
				const swap1 = h[current];
				h[current] = h[pt];
				h[pt] = swap1;
				const swap2 = h[current + 1];
				h[current + 1] = h[pt + 1];
				h[pt + 1] = swap2;
				current = pt;
			} else break; // 入れ替えが必要なくなったらそこで抜ける
		}
		return z.length;
	}
	/**
	 * Heapから一番大きい値を返す
	 * @return {{index: number, value: number, length: number}} {index: キーindex,
	 *     value: 値, length: ヒープ長} の Object.
	 */
	pop() {
		const z = this,
			h = z.buffer,
			v = h[0],
			idx = h[1];
		z.length -= 2; // 後ろから値を取る
		h[0] = h[z.length];
		h[1] = h[z.length + 1];
		let pt = 0; // ルートノードから下がっていく
		while (h) {
			let child = Heap.getChild(pt);
			if (child >= z.length) break; // 範囲チェック
			if (child + 2 < z.length && h[child + 2] > h[child]) child += 2; // 隣のノードと比較して、隣の方が値が大きければ隣を現在ノードとして選択
			if (h[child] > h[pt]) {
				const swap1 = h[pt]; // 親ノードと比較して親の方が小さい場合は入れ替える
				h[pt] = h[child];
				h[child] = swap1;
				const swap2 = h[pt + 1];
				h[pt + 1] = h[child + 1];
				h[child + 1] = swap2;
			} else break;
			pt = child;
		}
		return { index: idx, value: v, length: z.length };
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
		let maxCLen = /** @type {number} max code length for table size. */ 0,
			minCLen = /** @type {number} min code length for table size. */ Number.POSITIVE_INFINITY;
		for (const l of lengths) {
			if (l > maxCLen) maxCLen = l; // Math.max は遅いので最長の値は for-loop で取得する
			if (l < minCLen) minCLen = l;
		}
		const size = 1 << maxCLen, //table size.
			t = ZU.u32(size); //huffman code table.
		// ビット長の短い順からハフマン符号を割り当てる
		for (let bitLen = 1, c = 0, skip = 2; bitLen <= maxCLen; ) {
			for (let i = 0; i < listSize; ++i)
				if (lengths[i] === bitLen) {
					let reversed = 0; //reversed code.// ビットオーダーが逆になるためビット長分並びを反転する
					for (let rtemp = c, j = 0; j < bitLen; ++j) {
						reversed = (reversed << 1) | (rtemp & 1);
						rtemp >>= 1; //reverse temp.
					}
					// 最大ビット長をもとにテーブルを作るため、
					// 最大ビット長以外では 0 / 1 どちらでも良い箇所ができる
					// そのどちらでも良い場所は同じ値で埋めることで
					// 本来のビット長以上のビット数取得しても問題が起こらないようにする
					const v = (bitLen << 16) | i;
					for (let j = reversed; j < size; j += skip) t[j] = v;
					++c;
				}
			++bitLen; //bit length.// 次のビット長へ
			c <<= 1; //huffman code.
			skip <<= 1; //サイズが 2^maxlength 個のテーブルを埋めるためのスキップ長.
		}
		return [t, maxCLen, minCLen];
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
	 * @param {Object=} opt option parameters.
	 *
	 * typed array が使用可能なとき、outputBuffer が Array は自動的に Uint8Array に
	 * 変換されます.
	 * 別のオブジェクトになるため出力バッファを参照している変数などは
	 * 更新する必要があります.
	 */
	constructor(input, opt) {
		const z = this;
		z.compressionType = /** @type {RawDeflate.CompressionType} */ RawDeflate.CompressionType.DYNAMIC;
		z.lazy = /** @type {number} */ 0;
		z.freqsLitLen = /** @type {!(Uint32Array)} */ void 0;
		z.freqsDist = /** @type {!(Uint32Array)} */ void 0;
		z.input = /** @type {!(Uint8Array)} */ input instanceof Array ? ZU.u8(input) : input;
		z.output = /** @type {!(Uint8Array)} output output buffer. */ void 0;
		z.op = /** @type {number} pos output buffer position. */ 0;
		if (opt) {
			if (opt.lazy) z.lazy = opt.lazy; // option parameters
			if (ZU.isN(opt.compressionType)) z.compressionType = opt.compressionType;
			if (opt.outputBuffer)
				z.output = opt.outputBuffer instanceof Array ? ZU.u8(opt.outputBuffer) : opt.outputBuffer;
			if (ZU.isN(opt.outputIndex)) z.op = opt.outputIndex;
		}
		if (!z.output) z.output = ZU.u8(0x8000);
	}
	/**
	 * DEFLATE ブロックの作成
	 * @return {!(Uint8Array)} 圧縮済み byte array.
	 */
	compress() {
		const z = this,
			i = z.input; // compression
		switch (z.compressionType) {
			case RawDeflate.CompressionType.NONE:
				for (let position = 0, length = i.length; position < length; ) {
					const blockArray = i.subarray(position, position + 0xffff); // each 65535-Byte (length header: 16-bit)
					position += blockArray.length;
					z.makeNocompressBlock(blockArray, position === length);
				}
				break;
			case RawDeflate.CompressionType.FIXED:
				z.output = z.makeFixedHuffmanBlock(i, true);
				z.op = z.output.length;
				break;
			case RawDeflate.CompressionType.DYNAMIC:
				z.output = z.makeDynamicHuffmanBlock(i, true);
				z.op = z.output.length;
				break;
			default:
				ZU.Err('invalid compression type');
		}
		return z.output;
	}
	/**
	 * 非圧縮ブロックの作成
	 * @param {!(Uint8Array)} blockArray ブロックデータ byte array.
	 * @param {!boolean} isFinalBlock 最後のブロックならばtrue.
	 * @return {!(Uint8Array)} 非圧縮ブロック byte array.
	 */
	makeNocompressBlock(blockArray, isFinalBlock) {
		const z = this;
		let op = z.op,
			bL = z.output.buffer.byteLength;
		const tg = op + blockArray.length + 5;
		while (bL <= tg) bL = bL << 1; // expand buffer
		const o = ZU.u8(bL),
			bfinal = isFinalBlock ? 1 : 0, // header
			btype = RawDeflate.CompressionType.NONE,
			l = blockArray.length, // length
			nL = (~l + 0x10000) & 0xffff;
		o.set(z.output);
		o[op++] = bfinal | (btype << 1);
		o[op++] = l & 0xff;
		o[op++] = (l >>> 8) & 0xff;
		o[op++] = nL & 0xff;
		o[op++] = (nL >>> 8) & 0xff;
		o.set(blockArray, op); // copy buffer
		op += blockArray.length;
		const sa = o.subarray(0, op);
		z.op = op;
		z.output = sa;
		return sa;
	}
	/**
	 * 固定ハフマンブロックの作成
	 * @param {!(Uint8Array)} blockArray ブロックデータ byte array.
	 * @param {!boolean} isFinalBlock 最後のブロックならばtrue.
	 * @return {!(Uint8Array)} 固定ハフマン符号化ブロック byte array.
	 */
	makeFixedHuffmanBlock(blockArray, isFinalBlock) {
		const s = new BitStream(ZU.u8(this.output.buffer), this.op),
			bfinal = isFinalBlock ? 1 : 0, // header
			btype = RawDeflate.CompressionType.FIXED;
		s.writeBits(bfinal, 1, true);
		s.writeBits(btype, 2, true);
		RawDeflate.fixedHuffman(this.lz77(blockArray), s);
		return s.finish();
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
		const z = this,
			s = new BitStream(ZU.u8(z.output.buffer), z.op),
			hclenOrder = /** @const @type {Array.<number>} */ [
				16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
			],
			bfinal = isFinalBlock ? 1 : 0, // header
			transLens = /** @type {Array} */ ZU.a(19),
			btype = RawDeflate.CompressionType.DYNAMIC;
		s.writeBits(bfinal, 1, true);
		s.writeBits(btype, 2, true);
		const data = z.lz77(blockArray),
			litLenLens = RawDeflate.getLengths_(z.freqsLitLen, 15), // リテラル・長さ, 距離のハフマン符号と符号長の算出
			litLenCs = RawDeflate.getCodesFromLengths_(litLenLens),
			distLens = RawDeflate.getLengths_(z.freqsDist, 7),
			distCs = RawDeflate.getCodesFromLengths_(distLens);
		for (hlit = 286; hlit > 257 && litLenLens[hlit - 1] === 0; ) hlit--; // HLIT の決定
		for (hdist = 30; hdist > 1 && distLens[hdist - 1] === 0; ) hdist--; // HDIST の決定
		/** @type {{
		 *   codes: !(Uint32Array),
		 *   freqs: !(Uint8Array)
		 * }} */
		const treeSymbols = RawDeflate.getTreeSymbols_(hlit, litLenLens, hdist, distLens), // HCLEN
			treeLengths = RawDeflate.getLengths_(treeSymbols.freqs, 7);
		for (let i = 0; i < 19; i++) transLens[i] = treeLengths[hclenOrder[i]];
		for (hclen = 19; hclen > 4 && transLens[hclen - 1] === 0; ) hclen--;
		const treeCodes = RawDeflate.getCodesFromLengths_(treeLengths);
		s.writeBits(hlit - 257, 5, true); // 出力
		s.writeBits(hdist - 1, 5, true);
		s.writeBits(hclen - 4, 4, true);
		for (let i = 0; i < hclen; i++) s.writeBits(transLens[i], 3, true);
		const cs = treeSymbols.codes; // ツリーの出力
		for (let i = 0, il = cs.length; i < il; i++) {
			const c = cs[i];
			let bitlen = 0;
			s.writeBits(treeCodes[c], treeLengths[c], true);
			if (c >= 16) {
				i++; // extra bits
				switch (c) {
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
						ZU.Err(`invalid code: ${c}`);
				}
				s.writeBits(cs[i], bitlen, true);
			}
		}
		RawDeflate.dynamicHuffman(data, [litLenCs, litLenLens], [distCs, distLens], s);
		return s.finish();
	}
	/**
	 * 動的ハフマン符号化(カスタムハフマンテーブル)
	 * @param {!(Uint16Array)} dataArray LZ77 符号化済み byte array.
	 * @param {!BitStream} stream 書き込み用ビットストリーム.
	 * @return {!BitStream} ハフマン符号化済みビットストリームオブジェクト.
	 */
	static dynamicHuffman(dataArray, litLen, dist, stream) {
		const d = dataArray,
			s = stream,
			litLenCs = litLen[0],
			litLenLen = litLen[1],
			distCs = dist[0],
			distLens = dist[1];
		for (let i = 0, il = d.length; i < il; ++i) {
			const literal = d[i]; // 符号を BitStream に書き込んでいく
			s.writeBits(litLenCs[literal], litLenLen[literal], true); // literal or length
			if (literal > 256) {
				s.writeBits(d[++i], d[++i], true); // 長さ・距離符号// length extra
				const c = d[++i]; // distance
				s.writeBits(distCs[c], distLens[c], true);
				s.writeBits(d[++i], d[++i], true); // distance extra
			} else if (literal === 256) break; // 終端
		}
		return s;
	}
	/**
	 * 固定ハフマン符号化
	 * @param {!(Uint16Array)} dataArray LZ77 符号化済み byte array.
	 * @param {!BitStream} stream 書き込み用ビットストリーム.
	 * @return {!BitStream} ハフマン符号化済みビットストリームオブジェクト.
	 */
	static fixedHuffman(dataArray, stream) {
		const d = dataArray,
			s = stream;
		for (let i = 0, il = d.length; i < il; i++) {
			const literal = d[i]; // 符号を BitStream に書き込んでいく
			BitStream.prototype.writeBits.apply(s, RawDeflate.FixedHuffmanTable[literal]); // 符号の書き込み
			if (literal > 0x100) {
				s.writeBits(d[++i], d[++i], true); // 長さ・距離符号 // length extra
				s.writeBits(d[++i], 5); // distance
				s.writeBits(d[++i], d[++i], true); // distance extra
			} else if (literal === 0x100) break; // 終端
		}
		return s;
	}
	/**
	 * LZ77 実装
	 * @param {!(Uint8Array)} dataArray LZ77 符号化するバイト配列.
	 * @return {!(Uint16Array)} LZ77 符号化した配列.
	 */
	lz77(dataArray) {
		const t = /** @type {Object.<number, Array.<number>>} chained-hash-table */ {},
			wS = /** @const @type {number} */ RawDeflate.WindowSize,
			lz77buf = /** @type {!(Uint16Array)} lz77 buffer */ ZU.u16(dataArray.length * 2),
			/** @type {!(Uint32Array)} */
			fqLitLen = ZU.u32(286),
			/** @type {!(Uint32Array)} */
			fqDist = ZU.u32(30),
			/** @type {number} */
			lazy = this.lazy;
		/** @type {Lz77Match} previous longest match */
		let prevM,
			ip = /** @type {number} lz77 output buffer pointer */ 0,
			skipL = /** @type {number} lz77 skip length */ 0;
		fqLitLen[256] = 1; // EOB の最低出現回数は 1
		/**
		 * マッチデータの書き込み
		 * @param {Lz77Match} m LZ77 Match data.
		 * @param {!number} o スキップ開始位置(相対指定).
		 * @private
		 */
		function writeMatch(m, o) {
			/** @type {Array.<number>} */
			const lz77Array = Lz77Match.toLz77Array(m.length, m.backwardDistance);
			for (let i = 0, il = lz77Array.length; i < il; ++i) lz77buf[ip++] = lz77Array[i];
			fqLitLen[lz77Array[0]]++;
			fqDist[lz77Array[3]]++;
			skipL = m.length + o - 1;
			prevM = null;
		}
		// LZ77 符号化
		for (let p = 0, l = dataArray.length; p < l; ++p) {
			let mKey = 0; //chained-hash-table key
			for (let i = 0, il = RawDeflate.Lz77MinLength; i < il; ++i) {
				if (p + i === l) break;
				mKey = (mKey << 8) | dataArray[p + i]; // ハッシュキーの作成
			}
			if (t[mKey] === void 0) t[mKey] = []; // テーブルが未定義だったら作成する
			const mList = t[mKey];
			if (skipL-- > 0) {
				mList.push(p); // skip
				continue;
			}
			while (mList.length > 0 && p - mList[0] > wS) mList.shift(); // マッチテーブルの更新 (最大戻り距離を超えているものを削除する)
			if (p + RawDeflate.Lz77MinLength >= l) {
				if (prevM) writeMatch(prevM, -1); // データ末尾でマッチしようがない場合はそのまま流しこむ
				for (let i = 0, il = l - p; i < il; ++i) {
					const t = dataArray[p + i];
					lz77buf[ip++] = t;
					++fqLitLen[t];
				}
				break;
			}
			if (mList.length > 0) {
				const longestM = RawDeflate.searchLongestMatch_(dataArray, p, mList); // マッチ候補から最長のものを探す
				if (prevM) {
					if (prevM.length < longestM.length) {
						const t = dataArray[p - 1]; // 現在のマッチの方が前回のマッチよりも長い// write previous literal
						lz77buf[ip++] = t;
						++fqLitLen[t];
						writeMatch(longestM, 0); // write current match
					} else writeMatch(prevM, -1); // write previous match
				} else if (longestM.length < lazy) prevM = longestM;
				else writeMatch(longestM, 0);
			} else if (prevM) writeMatch(prevM, -1); // 前回マッチしていて今回マッチがなかったら前回のを採用
			else {
				const t = dataArray[p];
				lz77buf[ip++] = t;
				++fqLitLen[t];
			}
			mList.push(p); // マッチテーブルに現在の位置を保存
		}
		lz77buf[ip++] = 256; // 終端処理
		fqLitLen[256]++;
		this.freqsLitLen = fqLitLen;
		this.freqsDist = fqDist;
		return /** @type {!(Uint16Array.<number>)} */ lz77buf.subarray(0, ip);
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
		let currentM,
			mMax = 0;
		const dl = data.length;
		permatch: for (let i = 0, l = matchList.length; i < l; i++) {
			const m = matchList[l - i - 1]; // 候補を後ろから 1 つずつ絞り込んでゆく
			let mLen = RawDeflate.Lz77MinLength;
			if (mMax > RawDeflate.Lz77MinLength) {
				for (let j = mMax; j > RawDeflate.Lz77MinLength; j--)
					if (data[m + j - 1] !== data[position + j - 1]) continue permatch; // 前回までの最長一致を末尾から一致検索する
				mLen = mMax;
			}
			while (
				mLen < RawDeflate.Lz77MaxLength && // 最長一致探索
				position + mLen < dl &&
				data[m + mLen] === data[position + mLen]
			)
				++mLen;
			if (mLen > mMax) {
				currentM = m; // マッチ長が同じ場合は後方を優先
				mMax = mLen;
			}
			if (mLen === RawDeflate.Lz77MaxLength) break; // 最長が確定したら後の処理は省略
		}
		return new Lz77Match(mMax, position - currentM);
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
			r = ZU.u32(286 + 30),
			freqs = ZU.u8(19);
		let j = 0,
			nR = 0; // 符号化
		for (let i = 0; i < hlit; i++) src[j++] = litlenLengths[i];
		for (let i = 0; i < hdist; i++) src[j++] = distLengths[i];
		for (let i = 0; i < srcLen; i += j) {
			const srcI = src[i];
			for (j = 1; i + j < srcLen && src[i + j] === srcI; ) ++j; // Run Length Encoding
			let rL = j;
			if (srcI === 0) {
				if (rL < 3)
					while (rL-- > 0) {
						r[nR++] = 0; // 0 の繰り返しが 3 回未満ならばそのまま
						freqs[0]++;
					}
				else
					while (rL > 0) {
						let rpt = rL < 138 ? rL : 138; // 繰り返しは最大 138 までなので切り詰める
						if (rpt > rL - 3 && rpt < rL) rpt = rL - 3;
						if (rpt <= 10) {
							r[nR++] = 17; // 3-10 回 -> 17
							r[nR++] = rpt - 3;
							freqs[17]++;
						} else {
							r[nR++] = 18; // 11-138 回 -> 18
							r[nR++] = rpt - 11;
							freqs[18]++;
						}
						rL -= rpt;
					}
			} else {
				r[nR++] = srcI;
				freqs[srcI]++;
				rL--;
				if (rL < 3)
					while (rL-- > 0) {
						r[nR++] = srcI; // 繰り返し回数が3回未満ならばランレングス符号は要らない
						freqs[srcI]++;
					}
				else
					while (rL > 0) {
						let rpt = rL < 6 ? rL : 6; // 3 回以上ならばランレングス符号化// runLengthを 3-6 で分割
						if (rpt > rL - 3 && rpt < rL) rpt = rL - 3;
						r[nR++] = 16;
						r[nR++] = rpt - 3;
						freqs[16]++;
						rL -= rpt;
					}
			}
		}
		return {
			codes: r.subarray(0, nR),
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
			h = /** @type {Heap} */ new Heap(2 * RawDeflate.HUFMAX),
			l = /** @type {!(Uint8Array)} */ ZU.u8(nSymbols);
		for (let i = 0; i < nSymbols; ++i) if (freqs[i] > 0) h.push(i, freqs[i]); // ヒープの構築
		const heapHalfLen = h.length / 2,
			ns = ZU.a(heapHalfLen),
			vs = ZU.u32(heapHalfLen);
		if (ns.length === 1) {
			l[h.pop().index] = 1; // 非 0 の要素が一つだけだった場合は、そのシンボルに符号長 1 を割り当てて終了
			return l;
		}
		for (let i = 0; i < heapHalfLen; ++i) {
			ns[i] = h.pop(); // Reverse Package Merge Algorithm による Canonical Huffman Code の符号長決定
			vs[i] = ns[i].value;
		}
		const codeLength = RawDeflate.reversePackageMerge_(vs, vs.length, limit);
		for (let i = 0, il = ns.length; i < il; ++i) l[ns[i].index] = codeLength[i];
		return l;
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
			minCost = /** @type {!(Uint16Array)} */ ZU.u16(limit),
			flg = /** @type {!(Uint8Array)} */ ZU.u8(limit),
			cLen = /** @type {!(Uint8Array)} */ ZU.u8(symbols),
			v = /** @type {Array} */ ZU.a(limit),
			type = /** @type {Array} */ ZU.a(limit),
			currentP = /** @type {Array.<number>} */ ZU.a(limit),
			half = /** @type {number} */ 1 << limitM1;
		let excess = /** @type {number} */ (1 << limit) - symbols;
		minCost[limitM1] = symbols;
		for (let j = 0; j < limit; ++j) {
			if (excess < half) flg[j] = 0;
			else {
				flg[j] = 1;
				excess -= half;
			}
			excess <<= 1;
			minCost[limit - 2 - j] = ((minCost[limitM1 - j] / 2) | 0) + symbols;
		}
		minCost[0] = flg[0];
		v[0] = ZU.a(minCost[0]);
		type[0] = ZU.a(minCost[0]);
		for (let j = 1; j < limit; ++j) {
			if (minCost[j] > 2 * minCost[j - 1] + flg[j]) minCost[j] = 2 * minCost[j - 1] + flg[j];
			v[j] = ZU.a(minCost[j]);
			type[j] = ZU.a(minCost[j]);
		}
		for (let i = 0; i < symbols; ++i) cLen[i] = limit;
		const tml = minCost[limitM1];
		for (let t = 0; t < tml; ++t) {
			v[limitM1][t] = freqs[t];
			type[limitM1][t] = t;
		}
		for (let i = 0; i < limit; ++i) currentP[i] = 0;
		if (flg[limitM1] === 1) {
			--cLen[0];
			++currentP[limitM1];
		}
		for (let j = limit - 2; j >= 0; --j) {
			let i = 0,
				next = currentP[j + 1];
			const vJ0 = v[j],
				vJ1 = v[j + 1],
				typeJ = type[j],
				minCostJ = minCost[j];
			for (let t = 0; t < minCostJ; t++) {
				const w = vJ1[next] + vJ1[next + 1];
				if (w > freqs[i]) {
					vJ0[t] = w;
					typeJ[t] = symbols;
					next += 2;
				} else {
					vJ0[t] = freqs[i];
					typeJ[t] = i;
					++i;
				}
			}
			currentP[j] = 0;
			if (flg[j] === 1) RawDeflate.takePackage(j, type, currentP, symbols, cLen);
		}
		return cLen;
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
			cs = ZU.u16(il),
			cnt = [],
			startCode = [];
		let c = 0;
		for (const len of lengths) cnt[len] = (cnt[len] | 0) + 1; // Count the codes of each length.
		for (let i = 1; i <= RawDeflate.MaxCodeLength; i++) {
			startCode[i] = c; // Determine the starting code for each length block.
			c += cnt[i] | 0;
			c <<= 1;
		}
		for (let i = 0; i < il; i++) {
			const len = lengths[i]; // Determine the code for each symbol. Mirrored, of course.
			let c = startCode[len];
			startCode[len] += 1;
			cs[i] = 0;
			for (let j = 0; j < len; j++) {
				cs[i] = (cs[i] << 1) | (c & 1);
				c >>>= 1;
			}
		}
		return cs;
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
		let p = 0;
		const a = [],
			c1 = Lz77Match.LengthCodeTable[length]; // length
		a[p++] = c1 & 0xffff;
		a[p++] = (c1 >> 16) & 0xff;
		a[p++] = c1 >> 24;
		const c2 = Lz77Match.getDistanceCode_(backwardDistance); // distance
		a[p++] = c2[0];
		a[p++] = c2[1];
		a[p++] = c2[2];
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
	 * @param {Object=} opt options.
	 * @constructor
	 */
	constructor(opt = {}) {
		/** @type {Array.<{
		 *   buffer: !(Uint8Array),
		 *   option: Object,
		 *   compressed: boolean,
		 *   encrypted: boolean,
		 *   size: number,
		 *   crc32: number
		 * }>} */
		this.files = [];
		this.comment = /** @type {(Uint8Array)} */ opt.comment;
		this.password = /** @type {(Uint8Array)} */ void 0;
	}
	/**
	 * @param {Uint8Array} input
	 * @param {Object=} opt options.
	 */
	addFile(input, opt = {}) {
		// const filename = /** @type {string} */ opt.filename ? opt.filename : '';
		let compressed = /** @type {boolean} */ void 0,
			crc32 = /** @type {number} */ 0,
			buf = input instanceof Array ? ZU.u8(input) : input;
		if (!ZU.isN(opt.compressionMethod)) opt.compressionMethod = Zlib.CompressionMethod.DEFLATE; // default// その場で圧縮する場合
		if (opt.compress)
			switch (opt.compressionMethod) {
				case Zlib.CompressionMethod.STORE:
					break;
				case Zlib.CompressionMethod.DEFLATE:
					crc32 = CRC32.calc(buf);
					buf = Zip.deflateWithOption(buf, opt);
					compressed = true;
					break;
				default:
					ZU.Err(`unknown compression method:${opt.compressionMethod}`);
			}
		this.files.push({
			buffer: buf,
			option: opt,
			compressed,
			encrypted: !!opt.password,
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
		const z = this,
			fs = z.files,
			fCnt = fs.length;
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
		for (let i = 0; i < fCnt; ++i) {
			const f = fs[i],
				opt = f.option, // ファイルの圧縮
				fNameLen = opt.filename ? opt.filename.length : 0,
				cmtLen = opt.comment ? opt.comment.length : 0;
			// const extraFieldLength = opt.extraField ? opt.extraField.length : 0;
			if (!f.compressed) {
				f.crc32 = CRC32.calc(f.buffer); // 圧縮されていなかったら圧縮 // 圧縮前に CRC32 の計算をしておく
				switch (opt.compressionMethod) {
					case Zlib.CompressionMethod.STORE:
						break;
					case Zlib.CompressionMethod.DEFLATE:
						f.buffer = Zip.deflateWithOption(f.buffer, opt);
						f.compressed = true;
						break;
					default:
						ZU.Err(`unknown compression method:${opt.compressionMethod}`);
				}
			}
			if (opt.password !== void 0 || z.password !== void 0) {
				const k = Zip.createEncryptionKey(opt.password || z.password), // encryption// init encryption
					l = f.buffer.length + 12, // add header
					buf = ZU.u8(l);
				buf.set(f.buffer, 12);
				for (let j = 0; j < 12; ++j)
					buf[j] = Zip.encode(k, i === 11 ? f.crc32 & 0xff : (Math.random() * 256) | 0);
				for (let j = 12; j < l; ++j) buf[j] = Zip.encode(k, buf[j]); // data encryption
				f.buffer = buf;
			}
			localFileSize += 30 + fNameLen + f.buffer.length; // 必要バッファサイズの計算// local file header// file data
			centralDirectorySize += 46 + fNameLen + cmtLen; // file header
		}
		const endOfCentralDirectorySize = 22 + (z.comment ? z.comment.length : 0), // end of central directory
			o = ZU.u8(localFileSize + centralDirectorySize + endOfCentralDirectorySize),
			cDS = Zip.CentralDirectorySignature;
		let op1 = 0,
			op2 = localFileSize,
			op3 = op2 + centralDirectorySize;
		for (const f of fs) {
			const opt = f.option, // ファイルの圧縮
				fNameLen = opt.filename ? opt.filename.length : 0,
				exFldLen = 0, // TODO
				cmtLen = opt.comment ? opt.comment.length : 0,
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
			const needVer = 20; // compressor info
			o[op2++] = needVer & 0xff;
			o[op2++] =
				/** @type {OperatingSystem} */
				(opt.os) || Zip.OperatingSystem.MSDOS;
			o[op1++] = o[op2++] = needVer & 0xff; // need version
			o[op1++] = o[op2++] = (needVer >> 8) & 0xff;
			let flags = 0; // general purpose bit flag
			if (opt.password || z.password) flags |= Zip.Flags.ENCRYPT;
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
			const crc32 = f.crc32; // CRC-32
			o[op1++] = o[op2++] = crc32 & 0xff;
			o[op1++] = o[op2++] = (crc32 >> 8) & 0xff;
			o[op1++] = o[op2++] = (crc32 >> 16) & 0xff;
			o[op1++] = o[op2++] = (crc32 >> 24) & 0xff;
			const size = f.buffer.length; // compressed size
			o[op1++] = o[op2++] = size & 0xff;
			o[op1++] = o[op2++] = (size >> 8) & 0xff;
			o[op1++] = o[op2++] = (size >> 16) & 0xff;
			o[op1++] = o[op2++] = (size >> 24) & 0xff;
			const plainSize = f.size; // uncompressed size
			o[op1++] = o[op2++] = plainSize & 0xff;
			o[op1++] = o[op2++] = (plainSize >> 8) & 0xff;
			o[op1++] = o[op2++] = (plainSize >> 16) & 0xff;
			o[op1++] = o[op2++] = (plainSize >> 24) & 0xff;
			o[op1++] = o[op2++] = fNameLen & 0xff; // filename length
			o[op1++] = o[op2++] = (fNameLen >> 8) & 0xff;
			o[op1++] = o[op2++] = exFldLen & 0xff; // extra field length
			o[op1++] = o[op2++] = (exFldLen >> 8) & 0xff;
			o[op2++] = cmtLen & 0xff; // file comment length
			o[op2++] = (cmtLen >> 8) & 0xff;
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
			const fName = opt.filename; // filename
			if (fName) {
				o.set(fName, op1);
				o.set(fName, op2);
				op1 += fNameLen;
				op2 += fNameLen;
			}
			const exFld = opt.extraField; // extra field
			if (exFld) {
				o.set(exFld, op1);
				o.set(exFld, op2);
				op1 += exFldLen;
				op2 += exFldLen;
			}
			const cmt = opt.comment; // comment
			if (cmt) {
				o.set(cmt, op2);
				op2 += cmtLen;
			}
			o.set(f.buffer, op1); //// file data ////
			op1 += f.buffer.length;
		}
		o[op3++] = cDS[0]; //// end of central directory //// signature
		o[op3++] = cDS[1];
		o[op3++] = cDS[2];
		o[op3++] = cDS[3];
		o[op3++] = 0; // number of z disk
		o[op3++] = 0;
		o[op3++] = 0; // number of the disk with the start of the central directory
		o[op3++] = 0;
		o[op3++] = fCnt & 0xff; // total number of entries in the central directory on z disk
		o[op3++] = (fCnt >> 8) & 0xff;
		o[op3++] = fCnt & 0xff; // total number of entries in the central directory
		o[op3++] = (fCnt >> 8) & 0xff;
		o[op3++] = centralDirectorySize & 0xff; // size of the central directory
		o[op3++] = (centralDirectorySize >> 8) & 0xff;
		o[op3++] = (centralDirectorySize >> 16) & 0xff;
		o[op3++] = (centralDirectorySize >> 24) & 0xff;
		o[op3++] = localFileSize & 0xff; // offset of start of central directory with respect to the starting disk number
		o[op3++] = (localFileSize >> 8) & 0xff;
		o[op3++] = (localFileSize >> 16) & 0xff;
		o[op3++] = (localFileSize >> 24) & 0xff;
		const cmtLen = z.comment ? z.comment.length : 0; // .ZIP file comment length
		o[op3++] = cmtLen & 0xff;
		o[op3++] = (cmtLen >> 8) & 0xff;
		if (z.comment) {
			o.set(z.comment, op3); // .ZIP file comment
			op3 += cmtLen;
		}
		return o;
	}
	/**
	 * @param {!(Uint8Array)} input
	 * @param {Object=} opt options.
	 * @return {!(Uint8Array)}
	 */
	static deflateWithOption = (input, opt) => new RawDeflate(input, opt.deflateOption).compress();
	/**
	 * @param {(Uint32Array)} key
	 * @return {number}
	 */
	static getByte(key) {
		const t = (key[2] & 0xffff) | 2;
		return ((t * (t ^ 1)) >> 8) & 0xff;
	}
	/**
	 * @param {(Uint32Array|Object)} key
	 * @param {number} n
	 * @return {number}
	 */
	static encode(key, n) {
		const t = Zip.getByte(/** @type {(Uint32Array)} */ (key));
		Zip.updateKeys(/** @type {(Uint32Array)} */ (key), n);
		return t ^ n;
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
		const k = ZU.u32([305419896, 591751049, 878082192]);
		for (let i = 0, il = password.length; i < il; ++i) Zip.updateKeys(k, password[i] & 0xff);
		return k;
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
		const z = this,
			i = z.input,
			LFHS = Unzip.LocalFileHeaderSignature;
		let p = /** @type {number} */ z.offset;
		if (i[p++] !== LFHS[0] || i[p++] !== LFHS[1] || i[p++] !== LFHS[2] || i[p++] !== LFHS[3])
			ZU.Err('invalid local file header signature'); // local file header signature
		z.needVersion = i[p++] | (i[p++] << 8); // version needed to extract
		z.flags = i[p++] | (i[p++] << 8); // general purpose bit flag
		z.compression = i[p++] | (i[p++] << 8); // compression method
		z.time = i[p++] | (i[p++] << 8); // last mod file time
		z.date = i[p++] | (i[p++] << 8); //last mod file date
		z.crc32 = (i[p++] | (i[p++] << 8) | (i[p++] << 16) | (i[p++] << 24)) >>> 0; // crc-32
		z.compressedSize = (i[p++] | (i[p++] << 8) | (i[p++] << 16) | (i[p++] << 24)) >>> 0; // compressed size
		z.plainSize = (i[p++] | (i[p++] << 8) | (i[p++] << 16) | (i[p++] << 24)) >>> 0; // uncompressed size
		z.fileNameLength = i[p++] | (i[p++] << 8); // file name length
		z.extraFieldLength = i[p++] | (i[p++] << 8); // extra field length
		z.filename = String.fromCharCode.apply(null, i.subarray(p, (p += z.fileNameLength))); // file name
		z.extraField = i.subarray(p, (p += z.extraFieldLength)); // extra field
		z.length = p - z.offset;
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
	 * @param {Object=} opt option parameters.
	 */
	constructor(input, opt = {}) {
		const z = this;
		z.input = /** @type {!(Uint8Array)} */ input;
		z.output = /** @type {!(Uint8Array)} */ ZU.u8(Deflate.DefaultBufferSize);
		z.compressionType = /** @type {Deflate.CompressionType} */ Deflate.CompressionType.DYNAMIC;
		const rawDeflateOpt = /** @type {Object} */ {};
		if (ZU.isN(opt.compressionType)) z.compressionType = opt.compressionType; // option parameters
		for (const prop in opt) rawDeflateOpt[prop] = opt[prop]; // copy options
		rawDeflateOpt.outputBuffer = z.output; // set raw-deflate output buffer
		z.rawDeflate = /** @type {RawDeflate} */ new RawDeflate(z.input, rawDeflateOpt);
	}
	/**
	 * 直接圧縮に掛ける.
	 * @param {!(Uint8Array)} input target buffer.
	 * @param {Object=} opt option parameters.
	 * @return {!(Uint8Array)} compressed data byte array.
	 */
	static compress(input, opt) {
		return new Deflate(input, opt).compress();
	}
	/**
	 * Deflate Compression.
	 * @return {!(Uint8Array)} compressed data byte array.
	 */
	compress() {
		let cinfo = /** @type {number} */ 0,
			flevel = /** @type {number} */ 0,
			p = /** @type {number} */ 0;
		const z = this,
			o = z.output,
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
		o[p++] = cmf;
		switch (cm) {
			case Zlib.CompressionMethod.DEFLATE:
				switch (z.compressionType) {
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
		o[p++] = flg;
		z.rawDeflate.op = p;
		const adler = Adler32.mkHash(z.input), // Adler-32 checksum
			o2 = z.rawDeflate.compress();
		let p2 = o2.length,
			o3 = ZU.u8(o2.buffer); // subarray 分を元にもどす
		if (o3.length <= p2 + 4) {
			z.output = ZU.u8(o3.length + 4); // expand buffer
			z.output.set(o3);
			o3 = z.output;
		}
		const o4 = o3.subarray(0, p2 + 4);
		o4[p2++] = (adler >> 24) & 0xff; // adler32
		o4[p2++] = (adler >> 16) & 0xff;
		o4[p2++] = (adler >> 8) & 0xff;
		o4[p2++] = adler & 0xff;
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
	 * @param {Object=} opt option parameters.
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
		const z = this,
			il = z.input.length; //input length.
		while (z.ip < il) z.decodeMember();
		z.decompressed = true;
		return Gunzip.concatMember(z.member);
	}
	/**
	 * decode gzip member.
	 */
	decodeMember() {
		const m = /** @type {Zlib.GunzipMember} */ new GunzipMember(),
			i = this.input;
		/** @type {number} character code */
		let c,
			ip = this.ip;
		m.id1 = i[ip++];
		m.id2 = i[ip++];
		if (m.id1 !== 0x1f || m.id2 !== 0x8b) ZU.Err(`invalid file signature:${m.id1},${m.id2}`); // check signature
		m.cm = i[ip++]; // check compression method
		switch (m.cm) {
			case 8 /* XXX: use Zlib const */:
				break;
			default:
				ZU.Err(`unknown compression method: ${m.cm}`);
		}
		m.flg = i[ip++]; // flags
		const mT = i[ip++] | (i[ip++] << 8) | (i[ip++] << 16) | (i[ip++] << 24); // modification time
		m.mtime = new Date(mT * 1000);
		m.xfl = i[ip++]; // extra flags
		m.os = i[ip++]; // operating system
		if ((m.flg & Gzip.FlagsMask.FEXTRA) > 0) {
			m.xlen = i[ip++] | (i[ip++] << 8); // extra
			ip = Gunzip.decodeSubField(ip, m.xlen);
		}
		if ((m.flg & Gzip.FlagsMask.FNAME) > 0) {
			const s = []; // fname
			for (let ci = 0; (c = i[ip++]) > 0; ci++) s[ci] = String.fromCharCode(c);
			m.name = s.join('');
		}
		if ((m.flg & Gzip.FlagsMask.FCOMMENT) > 0) {
			const s = []; // fcomment
			for (let ci = 0; (c = i[ip++]) > 0; ci++) s[ci] = String.fromCharCode(c);
			m.comment = s.join('');
		}
		if ((m.flg & Gzip.FlagsMask.FHCRC) > 0) {
			m.crc16 = CRC32.calc(i, 0, ip) & 0xffff; // fhcrc
			if (m.crc16 !== (i[ip++] | (i[ip++] << 8))) ZU.Err('invalid header crc16');
		}
		// isize を事前に取得すると展開後のサイズが分かるため、
		// inflate処理のバッファサイズが事前に分かり、高速になる
		const l = i.length,
			isize = i[l - 4] | (i[l - 3] << 8) | (i[l - 2] << 16) | (i[l - 1] << 24);
		// isize の妥当性チェック
		// ハフマン符号では最小 2-bit のため、最大で 1/4 になる
		// LZ77 符号では 長さと距離 2-Byte で最大 258-Byte を表現できるため、
		// 1/128 になるとする
		// ここから入力バッファの残りが isize の 512 倍以上だったら
		// サイズ指定のバッファ確保は行わない事とする
		const bufSize = l - ip - /* CRC-32 */ 4 - /* ISIZE */ 4 < isize * 512 ? isize : void 0, // inflate size
			rawinflate = new RawInflate(i, { index: ip, bufferSize: bufSize }), // compressed block // RawInflate implementation.
			inflated = rawinflate.decompress(); // inflated data.
		m.data = inflated;
		let ipr = rawinflate.ip;
		const crc32 = (i[ipr++] | (i[ipr++] << 8) | (i[ipr++] << 16) | (i[ipr++] << 24)) >>> 0; // crc32
		m.crc32 = crc32;
		if (CRC32.calc(inflated) !== crc32)
			ZU.Err(`invalid CRC-32 checksum: 0x${CRC32.calc(inflated).toString(16)} / 0x${crc32.toString(16)}`);
		const isize2 = (i[ipr++] | (i[ipr++] << 8) | (i[ipr++] << 16) | (i[ipr++] << 24)) >>> 0; // input size
		m.isize = isize2;
		if ((inflated.length & 0xffffffff) !== isize2)
			ZU.Err(`invalid input size: ${inflated.length & 0xffffffff} / ${isize2}`);
		this.member.push(m);
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
		for (const m of members) size += m.data.length;
		const buf = ZU.u8(size);
		for (const m of members) {
			buf.set(m.data, p);
			p += m.data.length;
		}
		return buf;
	}
}
class GunzipMember {
	constructor() {
		const z = this;
		z.id1 = /** @type {number} signature first byte. */ void 0;
		z.id2 = /** @type {number} signature second byte. */ void 0;
		z.cm = /** @type {number} compression method. */ void 0;
		z.flg = /** @type {number} flags. */ void 0;
		z.mtime = /** @type {Date} modification time. */ void 0;
		z.xfl = /** @type {number} extra flags. */ void 0;
		z.os = /** @type {number} operating system number. */ void 0;
		z.crc16 = /** @type {number} CRC-16 value for FHCRC flag. */ void 0;
		z.xlen = /** @type {number} extra length. */ void 0;
		z.crc32 = /** @type {number} CRC-32 value for verification. */ void 0;
		z.isize = /** @type {number} input size modulo 32 value. */ void 0;
		z.name = /** @type {string} filename. */ void 0;
		z.comment = /** @type {string} comment. */ void 0;
		z.data = /** @type {!(Uint8Array|)} */ void 0;
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
	 * @param {Object=} opt option parameters.
	 */
	constructor(input, opt = {}) {
		const z = this;
		z.input = /** @type {!(Uint8Array)} input buffer. */ input;
		z.ip = /** @type {number} input buffer pointer. */ 0;
		z.output = /** @type {!(Uint8Array)} output buffer. */ void 0;
		z.op = /** @type {number} output buffer. */ 0;
		z.flags = /** @type {!Object} flags option flags. */ {};
		z.filename = /** @type {!string} filename. */ void 0;
		z.comment = /** @type {!string} comment. */ void 0;
		z.deflateOptions = /** @type {!Object} deflate options. */ void 0;
		if (opt.flags) z.flags = opt.flags; // option parameters
		if (typeof opt.filename === 'string') z.filename = opt.filename;
		if (typeof opt.comment === 'string') z.comment = opt.comment;
		if (opt.deflateOptions) z.deflateOptions = opt.deflateOptions;
		if (!z.deflateOptions) z.deflateOptions = {};
	}
	/**
	 * encode gzip members.
	 * @return {!(Uint8Array)} gzip binary array.
	 */
	compress() {
		const z = this,
			o = /** @type {!(Uint8Array)} output buffer. */ ZU.u8(Gzip.DefaultBufferSize),
			ipt = z.input,
			ip = z.ip,
			fName = z.filename,
			cmt = z.comment,
			FM = Gzip.FlagsMask;
		let op = /** @type {number} output buffer pointer. */ 0,
			flg = 0; // flags
		o[op++] = 0x1f; // check signature
		o[op++] = 0x8b;
		o[op++] = 8; /* XXX: use Zlib const */ // check compression method
		if (z.flags.fname) flg |= FM.FNAME;
		if (z.flags.fcomment) flg |= FM.FCOMMENT;
		if (z.flags.fhcrc) flg |= FM.FHCRC;
		// XXX: FTEXT
		// XXX: FEXTRA
		o[op++] = flg;
		const mT = ((Date.now ? Date.now() : +new Date()) / 1000) | 0; // modification time
		o[op++] = mT & 0xff;
		o[op++] = (mT >>> 8) & 0xff;
		o[op++] = (mT >>> 16) & 0xff;
		o[op++] = (mT >>> 24) & 0xff;
		o[op++] = 0; // extra flags
		o[op++] = Gzip.OperatingSystem.UNKNOWN; // operating system
		// extra
		/* NOP */
		if (z.flags.fname !== void 0) {
			for (let i = 0, il = fName.length; i < il; ++i) {
				const c = fName.charCodeAt(i); // fname
				if (c > 0xff) o[op++] = (c >>> 8) & 0xff;
				o[op++] = c & 0xff;
			}
			o[op++] = 0; // null termination
		}
		if (z.flags.comment) {
			for (let i = 0, il = cmt.length; i < il; ++i) {
				const c = cmt.charCodeAt(i); // fcomment
				if (c > 0xff) o[op++] = (c >>> 8) & 0xff;
				o[op++] = c & 0xff;
			}
			o[op++] = 0; // null termination
		}
		if (z.flags.fhcrc) {
			const crc16 = CRC32.calc(o, 0, op) & 0xffff; // fhcrc CRC-16 value for FHCRC flag.
			o[op++] = crc16 & 0xff;
			o[op++] = (crc16 >>> 8) & 0xff;
		}
		z.deflateOptions.outputBuffer = o; // add compress option
		z.deflateOptions.outputIndex = op;
		const rawdeflate = new RawDeflate(ipt, z.deflateOptions); // compress//raw deflate object.
		let o2 = rawdeflate.compress(),
			op2 = rawdeflate.op;
		if (op2 + 8 > o2.buffer.byteLength) {
			z.output = ZU.u8(op2 + 8); // expand buffer
			z.output.set(ZU.u8(o2.buffer));
			o2 = z.output;
		} else o2 = ZU.u8(o2.buffer);
		const crc32 = CRC32.calc(ipt); // crc32 CRC-32 value for verification.
		o2[op2++] = crc32 & 0xff;
		o2[op2++] = (crc32 >>> 8) & 0xff;
		o2[op2++] = (crc32 >>> 16) & 0xff;
		o2[op2++] = (crc32 >>> 24) & 0xff;
		const il = ipt.length; // input size
		o2[op2++] = il & 0xff;
		o2[op2++] = (il >>> 8) & 0xff;
		o2[op2++] = (il >>> 16) & 0xff;
		o2[op2++] = (il >>> 24) & 0xff;
		z.ip = ip;
		const o3 = op2 < o2.length ? o2.subarray(0, op2) : o2;
		z.output = o3;
		return o3;
	}
}
class InflateStream {
	/**
	 * @param {!(Uint8Array)} input deflated buffer.
	 * @constructor
	 */
	constructor(input) {
		const z = this;
		z.input = /** @type {!(Uint8Array)} */ input === void 0 ? ZU.u8() : input;
		z.ip = /** @type {number} */ 0;
		z.rawinflate = /** @type {RawInflateStream} */ new RawInflateStream(z.input, z.ip);
		z.method = /** @type {Zlib.CompressionMethod} */ void 0;
		z.output = /** @type {!(Uint8Array)} */ z.rawinflate.output;
	}
	/**
	 * decompress.
	 * @return {!(Uint8Array)} inflated buffer.
	 */
	decompress(input) {
		const z = this;
		// /** @type {number} adler-32 checksum */
		// var adler32;
		// 新しい入力を入力バッファに結合する
		// XXX Array, Uint8Array のチェックを行うか確認する
		if (input !== void 0) {
			const t = ZU.u8(z.input.length + input.length);
			t.set(z.input, 0);
			t.set(input, z.input.length);
			z.input = t;
		}
		if (z.method === void 0) if (z.readHeader() < 0) return ZU.u8();
		const buf = /** @type {!(Uint8Array)} inflated buffer. */ z.rawinflate.decompress(z.input, z.ip);
		if (z.rawinflate.ip !== 0) {
			z.input = z.input.subarray(z.rawinflate.ip);
			z.ip = 0;
		}
		// verify adler-32
		/*
    if (z.verify) {
      adler32 =
        input[z.ip++] << 24 | input[z.ip++] << 16 |
        input[z.ip++] << 8 | input[z.ip++];
      if (adler32 !== Zlib.Adler32(buffer)) {
        ZU.Err('invalid adler-32 checksum');
      }
    }
    */
		return buf;
	}
	readHeader() {
		let ip = this.ip;
		const i = this.input,
			cmf = i[ip++], // Compression Method and Flags
			flg = i[ip++];
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
	 * @param {Object=} opt option parameters.
	 *
	 * opt は以下のプロパティを指定する事ができます。
	 *   - index: input buffer の deflate コンテナの開始位置.
	 *   - blockSize: バッファのブロックサイズ.
	 *   - verify: 伸張が終わった後 adler-32 checksum の検証を行うか.
	 *   - bufferType: Zlib.Inflate.BufferType の値によってバッファの管理方法を指定する.
	 *       Zlib.Inflate.BufferType は Zlib.RawInflate.BufferType のエイリアス.
	 */
	constructor(input, opt = {}) {
		const z = this;
		z.input = /** @type {!(Uint8Array)} */ input;
		z.ip = /** @type {number} */ 0;
		if (opt.index) z.ip = opt.index; // option parameters
		if (opt.verify) z.verify = /** @type {(boolean|undefined)} verify flag. */ opt.verify;
		const cmf = /** @type {number} */ input[z.ip++], // Compression Method and Flags
			flg = /** @type {number} */ input[z.ip++];
		switch (cmf & 0x0f) {
			case Zlib.CompressionMethod.DEFLATE:
				z.method = Zlib.CompressionMethod.DEFLATE; // compression method
				break;
			default:
				ZU.Err('unsupported compression method');
		}
		if (((cmf << 8) + flg) % 31 !== 0) ZU.Err(`invalid fcheck flag:${((cmf << 8) + flg) % 31}`); // fcheck
		if (flg & 0x20) ZU.Err('fdict flag is not supported'); // fdict (not supported)
		z.rawinflate = /** @type {RawInflate} */ new RawInflate(input, {
			index: z.ip, // RawInflate
			bufferSize: opt.bufferSize,
			bufferType: opt.bufferType,
			resize: opt.resize,
		});
	}
	/**
	 * decompress.
	 * @return {!(Uint8Array)} inflated buffer.
	 */
	decompress() {
		const z = this,
			i = /** @type {!(Uint8Array)} input buffer. */ z.input,
			buf = /** @type {!(Uint8Array)} inflated buffer. */ z.rawinflate.decompress();
		z.ip = z.rawinflate.ip;
		if (z.verify) {
			// console.warn('decompress input:' + JSON.stringify(input), z.ip);
			const adler32 = // verify adler-32
				/** @type {number} adler-32 checksum */
				((i[z.ip++] << 24) | (i[z.ip++] << 16) | (i[z.ip++] << 8) | i[z.ip++]) >>> 0;
			// console.warn('decompress adler32:' + adler32, Adler32.mkHash(buffer), buffer);
			if (adler32 !== Adler32.mkHash(buf))
				ZU.Err('invalid adler-32 checksum ' + adler32 + '/' + Adler32.mkHash(buf) + ' ' + '');
		}
		return buf;
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
		const z = this;
		z.blocks = /** @type {!Array.<(Uint8Array)>} */ [];
		z.bufferSize = /** @type {number} block size. */ opt_buffersize
			? opt_buffersize
			: RawInflateStream.ZLIB_STREAM_RAW_INFLATE_BUFFER_SIZE;
		z.totalpos = /** @type {!number} total output buffer pointer. */ 0;
		z.ip = ip === /** @type {!number} input buffer pointer. */ void 0 ? 0 : ip;
		z.bitsbuf = /** @type {!number} bit stream reader buffer. */ 0;
		z.bitsbuflen = /** @type {!number} bit stream reader buffer size. */ 0;
		z.input = /** @type {!(Uint8Array)} input buffer. */ ZU.u8(input);
		z.output = /** @type {!(Uint8Array)} output buffer. */ ZU.u8(z.bufferSize);
		z.op = /** @type {!number} output buffer pointer. */ 0;
		z.bfinal = /** @type {boolean} is final block flag. */ false;
		z.blockLength = /** @type {number} uncompressed block length. */ 0;
		z.resize = /** @type {boolean} resize flag for memory size optimization. */ false;
		z.litlenTable = /** @type {Array} */ void 0;
		z.distTable = /** @type {Array} */ void 0;
		z.sp = /** @type {number} */ 0; // stream pointer
		z.status = /** @type {RawInflateStream.Status} */ RawInflateStream.Status.INITIALIZED;
		//backup  //
		z.ip_ = /** @type {!number} */ void 0;
		z.bitsbuflen_ = /** @type {!number} */ void 0;
		z.bitsbuf_ = /** @type {!number} */ void 0;
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
		const z = this,
			S = RawInflateStream.Status,
			BT = RawInflateStream.BlockType;
		let stop = /** @type {boolean} */ false;
		if (newInput !== void 0) z.input = newInput;
		if (ip !== void 0) z.ip = ip;
		while (!stop)
			switch (z.status) {
				case S.INITIALIZED: // block header// decompress
				case S.BLOCK_HEADER_START:
					if (z.readBlockHeader() < 0) stop = true;
					break;
				case S.BLOCK_HEADER_END: /* FALLTHROUGH */ // block body
				case S.BLOCK_BODY_START:
					switch (z.currentBlockType) {
						case BT.UNCOMPRESSED:
							if (z.readUncompressedBlockHeader() < 0) stop = true;
							break;
						case BT.FIXED:
							if (z.parseFixedHuffmanBlock() < 0) stop = true;
							break;
						case BT.DYNAMIC:
							if (z.parseDynamicHuffmanBlock() < 0) stop = true;
							break;
					}
					break;
				case S.BLOCK_BODY_END: // decode data
				case S.DECODE_BLOCK_START:
					switch (z.currentBlockType) {
						case BT.UNCOMPRESSED:
							if (z.parseUncompressedBlock() < 0) stop = true;
							break;
						case BT.FIXED: /* FALLTHROUGH */
						case BT.DYNAMIC:
							if (z.decodeHuffman() < 0) stop = true;
							break;
					}
					break;
				case S.DECODE_BLOCK_END:
					if (z.bfinal) stop = true;
					else z.status = S.INITIALIZED;
					break;
			}
		return z.concatBuffer();
	}
	/**
	 * fixed huffman length code table
	 * @const
	 * @type {!Array}
	 */
	static FixedLiteralLengthTable = (function () {
		const ls = ZU.u8(288);
		for (let i = 0, il = ls.length; i < il; ++i) ls[i] = i <= 143 ? 8 : i <= 255 ? 9 : i <= 279 ? 7 : 8;
		return Huffman.buildHuffmanTable(ls);
	})();
	/**
	 * fixed huffman distance code table
	 * @const
	 * @type {!Array}
	 */
	static FixedDistanceTable = (function () {
		const ls = ZU.u8(30);
		for (let i = 0, il = ls.length; i < il; ++i) ls[i] = 5;
		return Huffman.buildHuffmanTable(ls);
	})();
	/**
	 * parse deflated block.
	 */
	readBlockHeader() {
		const z = this,
			S = RawInflateStream.Status,
			BT = RawInflateStream.BlockType;
		let hdr = /** @type {number} header */ z.readBits(3);
		z.status = S.BLOCK_HEADER_START;
		z.save_();
		if (hdr < 0) {
			z.restore_();
			return -1;
		}
		if (hdr & 0x1) z.bfinal = true; // BFINAL
		hdr >>>= 1; // BTYPE
		switch (hdr) {
			case 0: // uncompressed
				z.currentBlockType = BT.UNCOMPRESSED;
				break;
			case 1: // fixed huffman
				z.currentBlockType = BT.FIXED;
				break;
			case 2: // dynamic huffman
				z.currentBlockType = BT.DYNAMIC;
				break;
			default: // reserved or other
				ZU.Err(`unknown BTYPE: ${hdr}`);
		}
		z.status = S.BLOCK_HEADER_END;
	}
	/**
	 * read inflate bits
	 * @param {number} length bits length.
	 * @return {number} read bits.
	 */
	readBits(length) {
		const z = this,
			i = z.input;
		let bitsbuf = z.bitsbuf,
			bitsbuflen = z.bitsbuflen,
			ip = z.ip,
			octet = /** @type {number} input and output byte. */ 0;
		while (bitsbuflen < length) {
			if (i.length <= ip) return -1; // not enough buffer
			octet = i[ip++]; // input byte
			bitsbuf |= octet << bitsbuflen; // concat octet
			bitsbuflen += 8;
		}
		const octetOut = bitsbuf & /* MASK */ ((1 << length) - 1); // output byte
		bitsbuf >>>= length;
		bitsbuflen -= length;
		z.bitsbuf = bitsbuf;
		z.bitsbuflen = bitsbuflen;
		z.ip = ip;
		return octetOut;
	}
	/**
	 * read huffman code using table
	 * @param {Array} table huffman code table.
	 * @return {number} huffman code.
	 */
	readCodeByTable(table) {
		const z = this,
			i = z.input,
			cT = /** @type {!(Uint8Array)} huffman code table */ table[0],
			maxCLen = /** @type {number} */ table[1];
		let bitsbuf = z.bitsbuf,
			bitsbuflen = z.bitsbuflen,
			ip = z.ip,
			octet;
		/** @type {number} input byte */
		while (bitsbuflen < maxCLen) {
			if (i.length <= ip) return -1; // not enough buffer
			octet = i[ip++];
			bitsbuf |= octet << bitsbuflen;
			bitsbuflen += 8;
		}
		const cWithLen = /** @type {number} code length & code (16bit, 16bit) */ cT[bitsbuf & ((1 << maxCLen) - 1)], // read max length
			cLen = /** @type {number} code bits length */ cWithLen >>> 16;
		if (cLen > bitsbuflen) ZU.Err(`invalid code length: ${cLen}`);
		z.bitsbuf = bitsbuf >> cLen;
		z.bitsbuflen = bitsbuflen - cLen;
		z.ip = ip;
		return cWithLen & 0xffff;
	}
	/**
	 * read uncompressed block header
	 */
	readUncompressedBlockHeader() {
		const z = this,
			i = z.input;
		let ip = z.ip;
		z.status = RawInflateStream.Status.BLOCK_BODY_START;
		if (ip + 4 >= i.length) return -1;
		const l = /** @type {number} block length */ i[ip++] | (i[ip++] << 8),
			nL = /** @type {number} number for check block length */ i[ip++] | (i[ip++] << 8);
		if (l === ~nL) ZU.Err('invalid uncompressed block header: length verify'); // check len & nlen
		z.bitsbuf = 0; // skip buffered header bits
		z.bitsbuflen = 0;
		z.ip = ip;
		z.blockLength = l;
		z.status = RawInflateStream.Status.BLOCK_BODY_END;
	}
	/**
	 * parse uncompressed block.
	 */
	parseUncompressedBlock() {
		const z = this,
			i = z.input;
		let ip = z.ip,
			o = z.output,
			op = z.op,
			l = z.blockLength;
		z.status = RawInflateStream.Status.DECODE_BLOCK_START;
		// copy
		// XXX: とりあえず素直にコピー
		while (l--) {
			if (op === o.length) o = z.expandBuffer({ fixRatio: 2 });
			if (ip >= i.length) {
				z.ip = ip; // not enough input buffer
				z.op = op;
				z.blockLength = l + 1; // コピーしてないので戻す
				return -1;
			}
			o[op++] = i[ip++];
		}
		if (l < 0) z.status = RawInflateStream.Status.DECODE_BLOCK_END;
		z.ip = ip;
		z.op = op;
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
		const z = this;
		z.ip_ = z.ip;
		z.bitsbuflen_ = z.bitsbuflen;
		z.bitsbuf_ = z.bitsbuf;
	}
	/**
	 * 別のプロパティに退避したコンテキストを復元する.
	 * @private
	 */
	restore_() {
		const z = this;
		z.ip = z.ip_;
		z.bitsbuflen = z.bitsbuflen_;
		z.bitsbuf = z.bitsbuf_;
	}
	/**
	 * parse dynamic huffman block.
	 */
	parseDynamicHuffmanBlock() {
		const z = this,
			cLens = /** @type {!(Uint8Array)} code lengths. */ ZU.u8(Zlib.Order.length);
		z.status = RawInflateStream.Status.BLOCK_BODY_START;
		z.save_();
		const hlit = /** @type {number} number of literal and length codes. */ z.readBits(5) + 257,
			hdist = /** @type {number} number of distance codes. */ z.readBits(5) + 1,
			hclen = /** @type {number} number of code lengths. */ z.readBits(4) + 4;
		if (hlit < 0 || hdist < 0 || hclen < 0) {
			z.restore_();
			return -1;
		}
		try {
			z.parseDynamicHuffmanBlockImpl(cLens, hlit, hdist, hclen);
		} catch (e) {
			z.restore_();
			return -1;
		}
		z.status = RawInflateStream.Status.BLOCK_BODY_END;
		return 0;
	}
	parseDynamicHuffmanBlockImpl(codeLengths, hlit, hdist, hclen) {
		const z = this;
		let prev = 0;
		for (let i = 0; i < hclen; ++i) {
			const bits = z.readBits(3); // decode code lengths
			if (bits < 0) ZU.Err('not enough input');
			codeLengths[Zlib.Order[i]] = bits;
		}
		const h = hlit + hdist,
			cLensT = /** @type {!Array} code lengths table. */ Huffman.buildHuffmanTable(codeLengths), // decode length table
			lenT = /** @type {!(Uint8Array.<number>)} code length table. */ ZU.u8(h);
		for (let i = 0; i < h; ) {
			let bits = /** @type {number} */ 0;
			const c = z.readCodeByTable(cLensT);
			if (c < 0) ZU.Err('not enough input');
			let repeat;
			switch (c) {
				case 16:
					if ((bits = z.readBits(2)) < 0) ZU.Err('not enough input');
					repeat = 3 + bits;
					while (repeat--) lenT[i++] = prev;
					break;
				case 17:
					if ((bits = z.readBits(3)) < 0) ZU.Err('not enough input');
					repeat = 3 + bits;
					while (repeat--) lenT[i++] = 0;
					prev = 0;
					break;
				case 18:
					if ((bits = z.readBits(7)) < 0) ZU.Err('not enough input');
					repeat = 11 + bits;
					while (repeat--) lenT[i++] = 0;
					prev = 0;
					break;
				default:
					lenT[i++] = c;
					prev = c;
					break;
			}
		}
		// litlenLengths = ZU.u8(hlit); // literal and length code
		// distLengths = ZU.u8(hdist); // distance code
		z.litlenTable = Huffman.buildHuffmanTable(lenT.subarray(0, hlit));
		z.distTable = Huffman.buildHuffmanTable(lenT.subarray(hlit));
	}
	/**
	 * decode huffman code (dynamic)
	 * @return {(number|undefined)} -1 is error.
	 */
	decodeHuffman() {
		const z = this,
			lL = z.litlenTable,
			dist = z.distTable;
		let o = z.output,
			op = z.op,
			oL = o.length;
		z.status = RawInflateStream.Status.DECODE_BLOCK_START;
		while (o) {
			z.save_();
			const c = /** @type {number} huffman code. */ z.readCodeByTable(lL);
			if (c < 0) {
				z.op = op;
				z.restore_();
				return -1;
			}
			if (c === 256) break;
			if (c < 256) {
				if (op === oL) {
					o = z.expandBuffer(); // literal
					oL = o.length;
				}
				o[op++] = c;
				continue;
			}
			const ti = /** @type {number} table index. */ c - 257; // length code
			let cLen = /** @type {number} huffman code length. */ Zlib.LengthCodeTable[ti];
			if (Zlib.LengthExtraTable[ti] > 0) {
				const bits = z.readBits(Zlib.LengthExtraTable[ti]);
				if (bits < 0) {
					z.op = op;
					z.restore_();
					return -1;
				}
				cLen += bits;
			}
			const dcode = z.readCodeByTable(dist); // dist code
			if (dcode < 0) {
				z.op = op;
				z.restore_();
				return -1;
			}
			let codeDist = /** @type {number} huffman code distination. */ Zlib.DistCodeTable[dcode];
			if (Zlib.DistExtraTable[dcode] > 0) {
				const bits = z.readBits(Zlib.DistExtraTable[dcode]);
				if (bits < 0) {
					z.op = op;
					z.restore_();
					return -1;
				}
				codeDist += bits;
			}
			if (op + cLen >= oL) {
				o = z.expandBuffer(); // lz77 decode
				oL = o.length;
			}
			while (cLen--) o[op] = o[op++ - codeDist];
			if (z.ip === z.input.length) {
				z.op = op; // break
				return -1;
			}
		}
		while (z.bitsbuflen >= 8) {
			z.bitsbuflen -= 8;
			z.ip--;
		}
		z.op = op;
		z.status = RawInflateStream.Status.DECODE_BLOCK_END;
	}
	/**
	 * expand output buffer. (dynamic)
	 * @param {Object=} opt option parameters.
	 * @return {!(Uint8Array)} output buffer pointer.
	 */
	expandBuffer(opt) {
		const z = this,
			i = z.input,
			o = z.output;
		let ratio = /** @type {number} expantion ratio. */ (i.length / z.ip + 1) | 0,
			newSize = /** @type {number} new output buffer size. */ 0;
		if (opt) {
			if (ZU.isN(opt.fixRatio)) ratio = opt.fixRatio;
			if (ZU.isN(opt.addRatio)) ratio += opt.addRatio;
		}
		if (ratio < 2) {
			const maxHuffCode =
					/** @type {number} maximum number of huffman code. */ (i.length - z.ip) / z.litlenTable[2], // calculate new buffer size
				maxInflateSize = /** @type {number} max inflate size. */ ((maxHuffCode / 2) * 258) | 0;
			newSize = maxInflateSize < o.length ? o.length + maxInflateSize : o.length << 1;
		} else newSize = o.length * ratio;
		const buf = /** @type {!(Uint8Array)} store buffer. */ ZU.u8(newSize); // buffer expantion
		buf.set(o);
		z.output = buf;
		return z.output;
	}
	/**
	 * concat output buffer. (dynamic)
	 * @return {!(Uint8Array)} output buffer.
	 */
	concatBuffer() {
		const z = this,
			op = /** @type {number} */ z.op,
			buf = /** @type {!(Uint8Array)} output buffer. */ z.resize
				? ZU.u8(z.output.subarray(z.sp, op))
				: z.output.subarray(z.sp, op),
			MBL = Zlib.MaxBackwardLength,
			t = /** @type {Uint8Array} */ (z.output);
		z.sp = op;
		if (op > MBL + z.bufferSize) {
			z.op = z.sp = MBL; // compaction
			z.output = ZU.u8(z.bufferSize + MBL);
			z.output.set(t.subarray(op - MBL, op));
		}
		return buf;
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
	 * @param {Object} opt option parameter.
	 *
	 * opt は以下のプロパティを指定する事ができます。
	 *   - index: input buffer の deflate コンテナの開始位置.
	 *   - blockSize: バッファのブロックサイズ.
	 *   - bufferType: Zlib.RawInflate.BufferType の値によってバッファの管理方法を指定する.
	 *   - resize: 確保したバッファが実際の大きさより大きかった場合に切り詰める.
	 */
	constructor(input, opt = {}) {
		const z = this;
		z.buffer = /** @type {!(Uint8Array)} inflated buffer */ void 0;
		z.blocks = /** @type {!Array.<(Uint8Array)>} */ [];
		z.bufferSize = /** @type {number} block size. */ RawInflate.ZLIB_RAW_INFLATE_BUFFER_SIZE;
		z.totalpos = /** @type {!number} total output buffer pointer. */ 0;
		z.ip = /** @type {!number} input buffer pointer. */ 0;
		z.bitsbuf = /** @type {!number} bit stream reader buffer. */ 0;
		z.bitsbuflen = /** @type {!number} bit stream reader buffer size. */ 0;
		z.input = /** @type {!(Uint8Array)} input buffer. */ ZU.u8(input);
		z.output = /** @type {!(Uint8Array.<number>)} output buffer. */ void 0;
		z.op = /** @type {!number} output buffer pointer. */ void 0;
		z.bfinal = /** @type {boolean} is final block flag. */ false;
		z.bufferType = /** @type {RawInflate.BufferType} buffer management. */ RawInflate.BufferType.ADAPTIVE;
		z.resize = /** @type {boolean} resize flag for memory size optimization. */ false;
		if (opt.index) z.ip = opt.index;
		if (opt.bufferSize) z.bufferSize = opt.bufferSize;
		if (opt.bufferType) z.bufferType = opt.bufferType;
		if (opt.resize) z.resize = opt.resize;
		switch (z.bufferType) {
			case RawInflate.BufferType.BLOCK:
				z.op = Zlib.MaxBackwardLength;
				z.output = ZU.u8(Zlib.MaxBackwardLength + z.bufferSize + Zlib.MaxCopyLength);
				break;
			case RawInflate.BufferType.ADAPTIVE:
				z.op = 0;
				z.output = ZU.u8(this.bufferSize);
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
	readBits(length) {
		const z = this,
			i = z.input;
		let bitsbuf = z.bitsbuf,
			bitsbuflen = z.bitsbuflen,
			ip = z.ip;
		if (ip + ((length - bitsbuflen + 7) >> 3) >= i.length) ZU.Err('input buffer is broken'); // input byte
		while (bitsbuflen < length) {
			const a = i[ip++];
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
			i = z.input,
			iL = i.length,
			cT = /** @type {!(Uint8Array)} huffman code table */ table[0],
			maxCLen = table[1];
		let bitsbuf = z.bitsbuf,
			bitsbuflen = z.bitsbuflen,
			ip = z.ip;
		while (bitsbuflen < maxCLen) {
			if (ip >= iL) break; // not enough buffer
			bitsbuf |= i[ip++] << bitsbuflen;
			bitsbuflen += 8;
		}
		const cWithLen = cT[bitsbuf & ((1 << maxCLen) - 1)], //code length & code (16bit, 16bit) // read max length
			cLen = cWithLen >>> 16; //code bits length
		if (cLen > bitsbuflen) ZU.Err(`invalid code length: ${cLen}`);
		z.bitsbuf = bitsbuf >> cLen;
		z.bitsbuflen = bitsbuflen - cLen;
		z.ip = ip;
		return cWithLen & 0xffff;
	}
	/**
	 * parse uncompressed block.
	 */
	parseUncompressedBlock() {
		const z = this,
			i = z.input,
			iL = i.length,
			oL = z.output.length; //output buffer length
		let ip = z.ip,
			o = z.output,
			op = z.op;
		z.bitsbuf = 0; // skip buffered header bits
		z.bitsbuflen = 0;
		if (ip + 1 >= iL) ZU.Err('invalid uncompressed block header: LEN');
		let l = i[ip++] | (i[ip++] << 8); // len block length
		if (ip + 1 >= iL) ZU.Err('invalid uncompressed block header: NLEN');
		const nlen = i[ip++] | (i[ip++] << 8); // nlen number for check block length
		if (l === ~nlen) ZU.Err('invalid uncompressed block header: length verify'); // check len & nlen
		if (ip + l > iL) ZU.Err('input buffer is broken'); // check size
		switch (z.bufferType) {
			case RawInflate.BufferType.BLOCK: // pre copy
				while (op + l > o.length) {
					const preCopy = oL - op; //copy counter
					l -= preCopy;
					o.set(i.subarray(ip, ip + preCopy), op);
					op += preCopy;
					ip += preCopy;
					z.op = op;
					o = z.expandBufferBlock(); // expand buffer
					op = z.op;
				}
				break;
			case RawInflate.BufferType.ADAPTIVE:
				while (op + l > o.length) o = z.expandBufferAdaptive({ fixRatio: 2 });
				break;
			default:
				ZU.Err('invalid inflate mode');
		}
		o.set(i.subarray(ip, ip + l), op); // copy
		op += l;
		ip += l;
		z.ip = ip;
		z.op = op;
		z.output = o;
	}
	/**
	 * parse fixed huffman block.
	 */
	parseFixedHuffmanBlock() {
		const FLLT = RawInflate.FixedLiteralLengthTable,
			FDT = RawInflate.FixedDistanceTable;
		switch (this.bufferType) {
			case RawInflate.BufferType.ADAPTIVE:
				this.decodeHuffmanAdaptive(FLLT, FDT);
				break;
			case RawInflate.BufferType.BLOCK:
				this.decodeHuffmanBlock(FLLT, FDT);
				break;
			default:
				ZU.Err('invalid inflate mode');
		}
	}
	/**
	 * parse dynamic huffman block.
	 */
	parseDynamicHuffmanBlock() {
		const z = this,
			hlit = /** @type {number} number of literal and length codes. */ z.readBits(5) + 257,
			hdist = /** @type {number} number of distance codes. */ z.readBits(5) + 1,
			hclen = /** @type {number} number of code lengths. */ z.readBits(4) + 4,
			cLens = /** @type {!(Uint8Array.<number>)} code lengths. */ ZU.u8(Zlib.Order.length);
		let prev = /** @type {number} */ 0,
			rpt = /** @type {number} */ 0;
		for (let i = 0; i < hclen; ++i) cLens[Zlib.Order[i]] = z.readBits(3); // decode code lengths
		const cLT = Huffman.buildHuffmanTable(cLens), //code lengths table. decode length table
			len = hlit + hdist,
			lT = ZU.u8(len); //code length table.
		for (let i = 0; i < len; ) {
			const c = z.readCodeByTable(cLT);
			switch (c) {
				case 16:
					rpt = 3 + z.readBits(2);
					while (rpt--) lT[i++] = prev;
					break;
				case 17:
					rpt = 3 + z.readBits(3);
					while (rpt--) lT[i++] = 0;
					prev = 0;
					break;
				case 18:
					rpt = 11 + z.readBits(7);
					while (rpt--) lT[i++] = 0;
					prev = 0;
					break;
				default:
					lT[i++] = c;
					prev = c;
					break;
			}
		}
		const lLT = Huffman.buildHuffmanTable(lT.subarray(0, hlit)), //literal and length code table.
			dT = Huffman.buildHuffmanTable(lT.subarray(hlit)); //distance code table.
		switch (z.bufferType) {
			case RawInflate.BufferType.ADAPTIVE:
				z.decodeHuffmanAdaptive(lLT, dT);
				break;
			case RawInflate.BufferType.BLOCK:
				z.decodeHuffmanBlock(lLT, dT);
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
		const z = this,
			oL = o.length - Zlib.MaxCopyLength, //output position limit.
			lCT = Zlib.LengthCodeTable,
			lET = Zlib.LengthExtraTable,
			dCT = Zlib.DistCodeTable,
			dET = Zlib.DistExtraTable;
		let o = z.output,
			op = z.op,
			c; //huffman code.
		z.currentLitlenTable = litlen;
		while ((c = z.readCodeByTable(litlen)) !== 256) {
			if (c === 0) return;
			if (c < 256) {
				if (op >= oL) {
					z.op = op; // literal
					o = z.expandBufferBlock();
					op = z.op;
				}
				o[op++] = c;
				continue;
			}
			const ti = c - 257; // length code
			let cL = lCT[ti]; //huffman code length.
			if (lET[ti] > 0) cL += z.readBits(lET[ti]);
			c = z.readCodeByTable(dist); // dist code
			let codeDist = dCT[c]; //huffman code distination.
			if (dET[c] > 0) codeDist += z.readBits(dET[c]);
			if (op >= oL) {
				z.op = op; // lz77 decode
				o = z.expandBufferBlock();
				op = z.op;
			}
			while (cL--) o[op] = o[op++ - codeDist];
		}
		while (z.bitsbuflen >= 8) {
			z.bitsbuflen -= 8;
			z.ip--;
		}
		z.op = op;
	}
	/**
	 * decode huffman code (adaptive)
	 * @param {!(Uint16Array)} litlen literal and length code table.
	 * @param {!(Uint8Array)} dist distination code table.
	 */
	decodeHuffmanAdaptive(litlen, dist) {
		const z = this,
			lCT = Zlib.LengthCodeTable,
			lET = Zlib.LengthExtraTable,
			dCT = Zlib.DistCodeTable,
			dET = Zlib.DistExtraTable;
		let o = z.output,
			op = z.op,
			oL = o.length, //output position limit.
			c; //huffman code.
		z.currentLitlenTable = litlen;
		while ((c = z.readCodeByTable(litlen)) !== 256) {
			if (c < 256) {
				if (op >= oL) {
					o = z.expandBufferAdaptive(); // literal
					oL = o.length;
				}
				o[op++] = c;
				continue;
			}
			const ti = c - 257; // length code
			let cL = lCT[ti]; //huffman code length.
			if (lET[ti] > 0) cL += z.readBits(lET[ti]);
			const codeD = z.readCodeByTable(dist); // dist code
			let codeDist = dCT[codeD]; //huffman code distination.
			if (dET[codeD] > 0) codeDist += z.readBits(dET[codeD]);
			if (op + cL > oL) {
				o = z.expandBufferAdaptive(); // lz77 decode
				oL = o.length;
			}
			while (cL--) o[op] = o[op++ - codeDist];
		}
		while (z.bitsbuflen >= 8) {
			z.bitsbuflen -= 8;
			z.ip--;
		}
		z.op = op;
	}
	/**
	 * expand output buffer.
	 * @param {Object=} opt option parameters.
	 * @return {!(Uint8Array)} output buffer.
	 */
	expandBufferBlock() {
		const z = this,
			MBL = Zlib.MaxBackwardLength,
			backward = z.op - MBL, //backward base point
			buf = ZU.u8(backward), //store buffer.
			o = z.output;
		buf.set(o.subarray(MBL, buf.length)); // copy to output buffer
		z.blocks.push(buf);
		z.totalpos += buf.length;
		o.set(o.subarray(backward, backward + MBL)); // copy to backward buffer
		z.op = MBL;
		return o;
	}
	/**
	 * expand output buffer. (adaptive)
	 * @param {Object=} opt option parameters.
	 * @return {!(Uint8Array)} output buffer pointer.
	 */
	expandBufferAdaptive(opt = {}) {
		const z = this,
			i = z.input,
			o = z.output,
			currentLen = o.length;
		let ratio = (z.input.length / z.ip + 1) | 0, //expantion ratio.
			newSize; //new output buffer size.
		if (currentLen === MAX_FIREFOX_SIZE) ZU.Err('TOO LOG LENGTH OF BUFFER ADAPTIVE!');
		if (ZU.isN(opt.fixRatio)) ratio = opt.fixRatio;
		if (ZU.isN(opt.addRatio)) ratio += opt.addRatio;
		if (ratio < 2) {
			const maxHuffCode = (i.length - z.ip) / z.currentLitlenTable[2], // calculate new buffer size //maximum number of huffman code.
				maxInflateSize = ((maxHuffCode / 2) * 258) | 0; //max inflate size.
			newSize = maxInflateSize < currentLen ? currentLen + maxInflateSize : currentLen << 1;
		} else newSize = currentLen * ratio;
		const newSizeAdaptiveMax = MAX_FIREFOX_SIZE > newSize ? newSize : MAX_FIREFOX_SIZE,
			buf = ZU.u8(newSizeAdaptiveMax); // buffer expantion //store buffer.
		buf.set(o);
		z.output = buf;
		return z.output;
	}
	/**
	 * concat output buffer.
	 * @return {!(Uint8Array)} output buffer.
	 */
	concatBufferBlock() {
		let p = 0; //buffer pointer.
		const z = this,
			MBL = Zlib.MaxBackwardLength,
			limit = z.totalpos + (z.op - MBL), //buffer pointer.
			o = z.output, //output block array.
			bs = z.blocks, //blocks array.
			buf = ZU.u8(limit); //output buffer.
		if (bs.length === 0) return o.subarray(MBL, z.op); // single buffer
		for (const b of bs) for (let j = 0, jl = b.length; j < jl; ++j) buf[p++] = b[j]; // copy to buffer
		for (let i = MBL, il = z.op; i < il; ++i) buf[p++] = o[i]; // current buffer
		z.blocks = [];
		z.buffer = buf;
		return z.buffer;
	}
	/**
	 * concat output buffer. (dynamic)
	 * @return {!(Uint8Array)} output buffer.
	 */
	concatBufferDynamic() {
		let buf; //output buffer.
		const z = this,
			op = z.op;
		if (z.resize) {
			buf = ZU.u8(op);
			buf.set(z.output.subarray(0, op));
		} else buf = z.output.subarray(0, op);
		z.buffer = buf;
		return z.buffer;
	}
}
export class Unzip extends Zip {
	/**
	 * @param {!(Uint8Array)} input input buffer.
	 * @param {Object=} opt options.
	 * @constructor
	 */
	constructor(input, opt = {}) {
		super();
		const z = this;
		z.input = /** @type {!(Uint8Array)} */ input instanceof Array ? ZU.u8(input) : input;
		z.ip = /** @type {number} */ 0;
		z.eocdrOffset = /** @type {number} */ 0;
		z.numberOfThisDisk = /** @type {number} */ 0;
		z.startDisk = /** @type {number} */ 0;
		z.totalEntriesThisDisk = /** @type {number} */ 0;
		z.totalEntries = /** @type {number} */ 0;
		z.centralDirectorySize = /** @type {number} */ 0;
		z.centralDirectoryOffset = /** @type {number} */ void 0;
		z.commentLength = /** @type {number} */ 0;
		z.comment = /** @type {(Uint8Array)} */ void 0;
		z.fileHeaderList = /** @type {Array.<Zlib.Unzip.FileHeader>} */ void 0;
		z.filenameToIndex = /** @type {Object.<string, number>} */ void 0;
		z.verify = /** @type {boolean} */ opt.verify || false;
		z.password = /** @type {(Uint8Array)} */ opt.password;
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
		const i = this.input,
			CDS = Unzip.CentralDirectorySignature;
		for (let ip = i.length - 12; ip > 0; --ip) {
			if (i[ip] === CDS[0] && i[ip + 1] === CDS[1] && i[ip + 2] === CDS[2] && i[ip + 3] === CDS[3]) {
				this.eocdrOffset = ip;
				return;
			}
		}
		ZU.Err('End of Central Directory Record not found');
	}
	parseEndOfCentralDirectoryRecord() {
		const z = this,
			i = z.input,
			CDS = Unzip.CentralDirectorySignature;
		if (!z.eocdrOffset) z.searchEndOfCentralDirectoryRecord();
		let ip = z.eocdrOffset;
		if (i[ip++] !== CDS[0] || i[ip++] !== CDS[1] || i[ip++] !== CDS[2] || i[ip++] !== CDS[3]) {
			ZU.Err('invalid signature'); // signature
		}
		z.numberOfThisDisk = i[ip++] | (i[ip++] << 8); // number of z disk
		z.startDisk = i[ip++] | (i[ip++] << 8); // number of the disk with the start of the central directory
		z.totalEntriesThisDisk = i[ip++] | (i[ip++] << 8); // total number of entries in the central directory on z disk
		z.totalEntries = i[ip++] | (i[ip++] << 8); // total number of entries in the central directory
		z.centralDirectorySize = (i[ip++] | (i[ip++] << 8) | (i[ip++] << 16) | (i[ip++] << 24)) >>> 0; // size of the central directory
		z.centralDirectoryOffset = (i[ip++] | (i[ip++] << 8) | (i[ip++] << 16) | (i[ip++] << 24)) >>> 0; // offset of start of central directory with respect to the starting disk number
		z.commentLength = i[ip++] | (i[ip++] << 8); // .ZIP file comment length
		z.comment = i.subarray(ip, ip + z.commentLength); // .ZIP file comment
	}
	parseFileHeader() {
		const z = this;
		if (z.fileHeaderList) return;
		if (z.centralDirectoryOffset === void 0) z.parseEndOfCentralDirectoryRecord();
		let ip = z.centralDirectoryOffset;
		const fileL = [],
			fileT = {};
		for (let i = 0, il = z.totalEntries; i < il; ++i) {
			const fileH = new FileHeader(z.input, ip);
			ip += fileH.length;
			fileL[i] = fileH;
			fileT[fileH.filename] = i;
		}
		if (z.centralDirectorySize < ip - z.centralDirectoryOffset) ZU.Err('invalid file header size');
		z.fileHeaderList = fileL;
		z.filenameToIndex = fileT;
	}
	/**
	 * @param {number} index file header index.
	 * @param {Object=} opt
	 * @return {!(Uint8Array)} file data.
	 */
	getFileData(index, opt = {}) {
		const z = this,
			ipt = z.input,
			fileHL = z.fileHeaderList;
		if (!fileHL) z.parseFileHeader();
		if (fileHL[index] === void 0) ZU.Err('wrong index');
		let offset = fileHL[index].relativeOffset;
		const lFH = new LocalFileHeader(z.input, offset);
		offset += lFH.length;
		let l = lFH.compressedSize;
		if ((lFH.flags & LocalFileHeader.Flags.ENCRYPT) !== 0) {
			if (!(opt.password || z.password)) ZU.Err('please set password'); // decryption
			const key = Unzip.createDecryptionKey(opt.password || z.password);
			for (let i = offset, il = offset + 12; i < il; ++i) Unzip.decode(key, ipt[i]); // encryption header
			offset += 12;
			l -= 12;
			for (let i = offset, il = offset + l; i < il; ++i) ipt[i] = Unzip.decode(key, ipt[i]); // decryption
		}
		let buf;
		switch (lFH.compression) {
			case Unzip.CompressionMethod.STORE:
				buf = ipt.subarray(offset, offset + l);
				break;
			case Unzip.CompressionMethod.DEFLATE:
				buf = new RawInflate(ipt, {
					index: offset,
					bufferSize: lFH.plainSize,
				}).decompress();
				break;
			default:
				ZU.Err('unknown compression type');
		}
		if (z.verify) {
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
	 * @param {Object=} opt
	 * @return {!(Uint8Array)} decompressed data.
	 */
	decompress(filename, opt) {
		if (!this.filenameToIndex) this.parseFileHeader();
		const idx = this.filenameToIndex[filename];
		if (idx === void 0) ZU.Err(`${filename} not found`);
		return this.getFileData(idx, opt);
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
