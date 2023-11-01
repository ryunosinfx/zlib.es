/**
 * @fileoverview Zlib namespace. Zlib の仕様に準拠した圧縮は Zlib.Deflate で実装
 * されている. これは Inflate との共存を考慮している為.
 */
/** @define {boolean} */
const ZLIB_CRC32_COMPACT = false;
const MAX_FIREFOX_SIZE = 8589934592;
const T = true;
const ff = 255;
/**
 * @fileoverview 雑多な関数群をまとめたモジュール実装.
 */
class ZU {
	/**
	 * Byte String から Byte Array に変換.
	 * @param {!string} s byte string.
	 * @return {!Array.<number>} byte array.
	 */
	static stringToByteArray(s) {
		const t = /** @type {!Array.<(string|number)>} */ s.split('');
		for (let i = 0; i < t.length; i++) t[i] = (t[i].charCodeAt(0) & ff) >>> 0;
		return t;
	}
	static Err = (m) => {
		// console.error(m);
		throw new Error(m);
	};
	static a = (n) => new Array(n);
	static u8 = (n) => new Uint8Array(n);
	static u8s = (n, s) => {
		const a = new Uint8Array(n);
		a.set(s);
		return a;
	};
	static u16 = (n) => new Uint16Array(n);
	static u32 = (n) => new Uint32Array(n);
	static isN = (n) => typeof n === 'number';
	static isAI = (n) => n instanceof Array;
}
class Huffman {
	/**
	 * build huffman table from length list.
	 * @param {!(Uint8Array)} lengths length list.
	 * @return {!Array} huffman table.
	 */
	static bT(lengths) {
		const la = lengths,
			ls = /** @type {number} length list size. */ la.length;
		let maxCLen = /** @type {number} max code length for table size. */ 0,
			minCLen = /** @type {number} min code length for table size. */ Number.POSITIVE_INFINITY;
		for (const l of la) {
			if (l > maxCLen) maxCLen = l; // Math.max は遅いので最長の値は for-loop で取得する
			if (l < minCLen) minCLen = l;
		}
		const sz = 1 << maxCLen, //table size.
			t = ZU.u32(sz); //huffman code table.
		// ビット長の短い順からハフマン符号を割り当てる
		for (let bL = 1, c = 0, s = 2; bL <= maxCLen; ) {
			for (let i = 0; i < ls; ++i)
				if (la[i] === bL) {
					let rvsd = 0; //reversed code.// ビットオーダーが逆になるためビット長分並びを反転する
					for (let rt = c, j = 0; j < bL; ++j) {
						rvsd = (rvsd << 1) | (rt & 1);
						rt >>= 1; //reverse temp.
					}
					// 最大ビット長をもとにテーブルを作るため、
					// 最大ビット長以外では 0 / 1 どちらでも良い箇所ができる
					// そのどちらでも良い場所は同じ値で埋めることで
					// 本来のビット長以上のビット数取得しても問題が起こらないようにする
					const v = (bL << 16) | i;
					for (let j = rvsd; j < sz; j += s) t[j] = v;
					++c;
				}
			++bL; //bit length.// 次のビット長へ
			c <<= 1; //huffman code.
			s <<= 1; //サイズが 2^maxlength 個のテーブルを埋めるためのスキップ長.
		}
		return [t, maxCLen, minCLen];
	}
}
/**
 * Compression Method
 * @enum {number}
 */
export class Zlib {
	/**
	 * @const
	 * @type {number} デフォルトバッファサイズ.
	 */
	static DefaultBufferSize = 32768;
	/**
	 * @enum {number}
	 */
	static CompressionMethod = {
		STORE: 0,
		DEFLATE: 8,
		RESERVED: 15,
	};
	static CM = Zlib.CompressionMethod;
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
	static LCT = Zlib.LengthCodeTable;
	/**
	 * huffman length extra-bits table.
	 * @const
	 * @type {!(Uint8Array)}
	 */
	static LengthExtraTable = ZU.u8([
		0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0,
	]);
	static LET = Zlib.LengthExtraTable;
	/**
	 * huffman dist code table.
	 * @const
	 * @type {!(Uint16Array)}
	 */
	static DistCodeTable = ZU.u16([
		1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097,
		6145, 8193, 12289, 16385, 24577,
	]);
	static DCT = Zlib.DistCodeTable;
	/**
	 * huffman dist extra-bits table.
	 * @const
	 * @type {!(Uint8Array)}
	 */
	static DistExtraTable = ZU.u8([
		0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
	]);
	static DET = Zlib.DistExtraTable;
	/**
	 * fixed huffman length code table
	 * @const
	 * @type {!Array}
	 */
	static FixedLiteralLengthTable = (() => {
		const m = ZU.u8(288);
		for (let i = 0; i < 288; ++i) m[i] = i <= 143 ? 8 : i <= ff ? 9 : i <= 279 ? 7 : 8;
		return Huffman.bT(m);
	})();
	static FLLT = Zlib.FixedLiteralLengthTable;
	/**
	 * fixed huffman distance code table
	 * @const
	 * @type {!Array}
	 */
	static FixedDistanceTable = (() => {
		const m = ZU.u8(30);
		m.fill(5);
		return Huffman.bT(m);
	})();
	static FDT = Zlib.FixedDistanceTable;
	/**
	 * read huffman code using table
	 * @param {!(Uint8Array|Uint16Array)} table huffman code table.
	 * @param {!(obj)} z a this
	 * @return {number} huffman code.
	 */
	static readCodeByTable(table, z) {
		const i = z.input,
			cT = /** @type {!(Uint8Array)} huffman code table */ table[0],
			maxCLen = table[1];
		let bb = z.bitsbuf,
			bbf = z.bitsbuflen,
			p = z.ip;
		while (bbf < maxCLen) {
			if (i.length <= p) return -1; // not enough buffer
			bb |= i[p++] << bbf;
			bbf += 8;
		}
		const cWithLen = cT[bb & ((1 << maxCLen) - 1)], //code length & code (16bit, 16bit) // read max length
			cL = cWithLen >>> 16; //code bits length
		if (cL > bbf) ZU.Err(`invalid code length: ${cL}`);
		z.bitsbuf = bb >> cL;
		z.bitsbuflen = bbf - cL;
		z.ip = p;
		return cWithLen & 0xffff;
	}
	/**
	 * read inflate bits
	 * @param {number} length bits length.
	 * @param {!(obj)} z a this
	 * @return {number} read bits.
	 */
	static rB(length, z, isThrowErr = false) {
		const l = length,
			i = z.input;
		let bb = z.bitsbuf,
			bbf = z.bitsbuflen,
			p = z.ip;
		if (isThrowErr && p + ((l - bbf + 7) >> 3) >= i.length) ZU.Err('input buffer is broken'); // input byte
		while (bbf < l) {
			if (i.length <= p) return -1; // not enough buffer
			bb |= i[p++] << bbf; // not enough buffer
			bbf += 8;
		}
		const o8 = bb & /* MASK */ ((1 << l) - 1); //input and output byte.// output byte
		bb >>>= l;
		bbf -= l;
		z.bitsbuf = bb;
		z.bitsbuflen = bbf;
		z.ip = p;
		return o8;
	}
	static rBt = (length, z) => Zlib.B(length, z, T);

	/** @define {number} buffer block size. */
	static ZLIB_RAW_INFLATE_BUFFER_SIZE = 32768; // [ 0x8000 >= ZLIB_BUFFER_BLOCK_SIZE ]
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
			FS = Zip.FileHeaderSignature;
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
	 * @param {!(Uint8Array|string)} a 算出に使用する byte array.
	 * @return {number} Adler32 ハッシュ値.
	 */
	static mkHash = (a) => Adler32.update(1, typeof a === 'string' ? ZU.stringToByteArray(a) : a);
	/**
	 * Adler32 ハッシュ値の更新
	 * @param {number} adler 現在のハッシュ値.
	 * @param {!(Uint8Array)} a 更新に使用する byte array.
	 * @return {number} Adler32 ハッシュ値.
	 */
	static update(adler, a) {
		let s1 = /** @type {number} */ adler & 0xffff,
			s2 = /** @type {number} */ (adler >>> 16) & 0xffff,
			l = /** @type {number} array length */ a.length,
			i = /** @type {number} array index */ 0;
		const op = Adler32.OptimizationParameter;
		while (l > 0) {
			/** @type {number} loop length (don't overflow) */
			let t = l > op ? op : l;
			l -= t;
			do {
				s1 += a[i++];
				s2 += s1;
			} while (--t);
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
class BS {
	/**
	 * デフォルトブロックサイズ.
	 * @const
	 * @type {number}
	 */
	static DefaultBlockSize = 32768;
	constructor(buffer, bufferPosition) {
		const z = this;
		z.index = /** @type {number} buffer index. */ ZU.isN(bufferPosition) ? bufferPosition : 0;
		z.bitindex = /** @type {number} bit index. */ 0;
		/** @type {!(Uint8Array)} bit-stream output buffer. */
		z.buffer = buffer instanceof Uint8Array ? buffer : ZU.u8(BS.DefaultBlockSize);
		// 入力された index が足りなかったら拡張するが、倍にしてもダメなら不正とする
		if (z.buffer.length * 2 <= z.index) ZU.Err('invalid index');
		else if (z.buffer.length <= z.index) z.expandBuffer();
	}
	/**
	 * expand buffer.
	 * @return {!(Uint8Array)} new buffer.
	 */
	expandBuffer() {
		return (this.buffer = ZU.u8s(this.buffer.length << 1, this.buffer));
	}
	/**
	 * 数値をビットで指定した数だけ書き込む.
	 * @param {number} number 書き込む数値.
	 * @param {number} n 書き込むビット数.
	 * @param {boolean=} reverse 逆順に書き込むならば true.
	 */
	wB(number, n, reverse) {
		const z = this;
		let b = z.buffer,
			j = z.index,
			bIdx = z.bitindex,
			cu = /** @type {number} current octet. */ b[j];
		if (reverse && n > 1) number = n > 8 ? BS.rev32_(number) >> (32 - n) : BS.RT[number] >> (8 - n);
		if (n + bIdx < 8) {
			cu = (cu << n) | number; // Byte 境界を超えないとき
			bIdx += n;
		} else {
			for (let i = 0; i < n; ++i) {
				cu = (cu << 1) | ((number >> (n - i - 1)) & 1); // Byte 境界を超えるとき
				if (++bIdx === 8) {
					bIdx = 0; // next byte
					b[j++] = BS.RT[cu];
					cu = 0;
					if (j === b.length) b = z.expandBuffer(); // expand
				}
			}
		}
		b[j] = cu;
		z.buffer = b;
		z.bitindex = bIdx;
		z.index = j;
	}
	/**
	 * 32-bit 整数のビット順を逆にする
	 * @param {number} n 32-bit integer.
	 * @return {number} reversed 32-bit integer.
	 * @private
	 */
	static rev32_ = (n) =>
		(BS.RT[n & ff] << 24) | (BS.RT[(n >>> 8) & ff] << 16) | (BS.RT[(n >>> 16) & ff] << 8) | BS.RT[(n >>> 24) & ff];

	/**
	 * ストリームの終端処理を行う
	 * @return {!(Uint8Array)} 終端処理後のバッファを byte array で返す.
	 */
	finish() {
		const b = this.buffer,
			x = this.bitindex;
		let i = this.index;
		if (x > 0) {
			b[i] <<= 8 - x; // bitindex が 0 の時は余分に index が進んでいる状態
			b[i] = BS.RT[b[i]];
			i++;
		}
		return b.subarray(0, i); // array truncation;
	}
	static buildReverseTable() {
		const t = /** @type {!(Uint8Array)} reverse table. */ ZU.u8(256);
		for (let i = 0; i < 256; ++i) {
			let n = i,
				r = n,
				s = 7;
			for (n >>>= 1; n; n >>>= 1) {
				r <<= 1;
				r |= n & 1;
				--s;
			}
			t[i] = ((r << s) & ff) >>> 0;
		} // generate
		return t;
	}
	/**
	 * 0-ff のビット順を反転したテーブル
	 * @const
	 * @type {!(Uint8Array.<number>)}
	 */
	static RT = (() => BS.buildReverseTable())();
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
		const d = data,
			t = CRC32.Table,
			il = ZU.isN(length) ? length : d.length;
		let i = ZU.isN(pos) ? pos : (pos = 0);
		crc ^= 0xffffffff;
		for (i = il & 7; i--; ++pos) crc = (crc >>> 8) ^ t[(crc ^ d[pos]) & ff]; // loop unrolling for performance
		for (i = il >> 3; i--; pos += 8) {
			crc = (crc >>> 8) ^ t[(crc ^ d[pos]) & ff];
			crc = (crc >>> 8) ^ t[(crc ^ d[pos + 1]) & ff];
			crc = (crc >>> 8) ^ t[(crc ^ d[pos + 2]) & ff];
			crc = (crc >>> 8) ^ t[(crc ^ d[pos + 3]) & ff];
			crc = (crc >>> 8) ^ t[(crc ^ d[pos + 4]) & ff];
			crc = (crc >>> 8) ^ t[(crc ^ d[pos + 5]) & ff];
			crc = (crc >>> 8) ^ t[(crc ^ d[pos + 6]) & ff];
			crc = (crc >>> 8) ^ t[(crc ^ d[pos + 7]) & ff];
		}
		return (crc ^ 0xffffffff) >>> 0;
	}
	/**
	 * @param {number} num
	 * @param {number} crc
	 * @returns {number}
	 */
	static single = (num, crc) => (CRC32.Table[(num ^ crc) & ff] ^ (num >>> 8)) >>> 0;
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
	 * @param {number} i 子ノードの index.
	 * @return {number} 親ノードの index.
	 *
	 */
	static getParent = (i) => (((i - 2) / 4) | 0) * 2;
	/**
	 * 子ノードの index 取得
	 * @param {number} i 親ノードの index.
	 * @return {number} 子ノードの index.
	 */
	static getChild = (i) => 2 * i + 2;
	/**
	 * Heap に値を追加する
	 * @param {number} i キー index.
	 * @param {number} v 値.
	 * @return {number} 現在のヒープ長.
	 */
	push(i, v) {
		const z = this,
			h = z.buffer; // ルートノードにたどり着くまで入れ替えを試みる
		let cu = z.length;
		h[z.length++] = v;
		h[z.length++] = i;
		while (cu > 0) {
			const p = Heap.getParent(cu); // 親ノードと比較して親の方が小さければ入れ替える
			if (h[cu] > h[p]) {
				const s1 = h[cu];
				h[cu] = h[p];
				h[p] = s1;
				const s2 = h[cu + 1];
				h[cu + 1] = h[p + 1];
				h[p + 1] = s2;
				cu = p;
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
			i = h[1];
		z.length -= 2; // 後ろから値を取る
		const l = z.length;
		h[0] = h[l];
		h[1] = h[l + 1];
		let p = 0; // ルートノードから下がっていく
		while (h) {
			let c = Heap.getChild(p);
			if (c >= l) break; // 範囲チェック
			if (c + 2 < l && h[c + 2] > h[c]) c += 2; // 隣のノードと比較して、隣の方が値が大きければ隣を現在ノードとして選択
			if (h[c] > h[p]) {
				const s1 = h[p]; // 親ノードと比較して親の方が小さい場合は入れ替える
				h[p] = h[c];
				h[c] = s1;
				const s2 = h[p + 1];
				h[p + 1] = h[c + 1];
				h[c + 1] = s2;
			} else break;
			p = c;
		}
		return { index: i, value: v, length: l };
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
	static CT = RawDeflate.CompressionType;
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
	static WindowSize = 32768;
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
	static FixedHuffmanTable = (() => {
		const t = [];
		for (let i = 0; i < 288; i++)
			t.push(
				i <= 143
					? [i + 0x030, 8]
					: i <= ff
					? [i - 144 + 0x190, 9]
					: i <= 279
					? [i - 256 + 0x000, 7]
					: i <= 287
					? [i - 280 + 0x0c0, 8]
					: ZU.Err(`invalid literal: ${i}`)
			);
		return t;
	})();
	static FHT = RawDeflate.FixedHuffmanTable;
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
		const z = this,
			i = input,
			u = opt;
		z.compressionType = /** @type {RawDeflate.CompressionType} */ RawDeflate.CT.DYNAMIC;
		z.lazy = /** @type {number} */ 0;
		z.freqsLitLen = /** @type {!(Uint32Array)} */ void 0;
		z.freqsDist = /** @type {!(Uint32Array)} */ void 0;
		z.input = /** @type {!(Uint8Array)} */ ZU.isAI(i) ? ZU.u8(i) : i;
		z.output = /** @type {!(Uint8Array)} output output buffer. */ void 0;
		z.op = /** @type {number} pos output buffer position. */ 0;
		if (u) {
			const ob = u.outputBuffer,
				oi = u.outputIndex,
				ct = u.compressionType;
			if (u.lazy) z.lazy = u.lazy; // option parameters
			if (ZU.isN(ct)) z.compressionType = ct;
			if (ob) z.output = ZU.isAI(ob) ? ZU.u8(ob) : ob;
			if (ZU.isN(oi)) z.op = oi;
		}
		if (!z.output) z.output = ZU.u8(32768);
	}
	/**
	 * DEFLATE ブロックの作成
	 * @return {!(Uint8Array)} 圧縮済み byte array.
	 */
	compress() {
		const z = this,
			CT = RawDeflate.CT,
			ct = z.compressionType,
			i = z.input; // compression
		if (ct === CT.NONE) {
			for (let p = 0, l = i.length; p < l; ) {
				const bA = i.subarray(p, p + 0xffff); // each 65535-Byte (length header: 16-bit)
				p += bA.length;
				z.output = z.makeNocompressBlock(bA, p === l);
			}
		} else if (ct === CT.FIXED) {
			z.output = z.makeFixedHuffmanBlock(i, T);
			z.op = z.output.length;
		} else if (ct === CT.DYNAMIC) {
			z.output = z.makeDynamicHuffmanBlock(i, T);
			z.op = z.output.length;
		} else ZU.Err('invalid compression type');
		return z.output;
	}
	/**
	 * 非圧縮ブロックの作成
	 * @param {!(Uint8Array)} blockArray ブロックデータ byte array.
	 * @param {!boolean} isFinalBlock 最後のブロックならばtrue.
	 * @return {!(Uint8Array)} 非圧縮ブロック byte array.
	 */
	makeNocompressBlock(blockArray, isFinalBlock) {
		const z = this,
			d = blockArray,
			l = d.length; // length;
		let q = z.op,
			bL = z.output.buffer.byteLength;
		const tg = q + l + 5;
		while (bL <= tg) bL = bL << 1; // expand buffer
		const o = ZU.u8(bL),
			bf = isFinalBlock ? 1 : 0, // header
			bt = RawDeflate.CT.NONE,
			nL = (~l + 0x10000) & 0xffff;
		o.set(z.output);
		o[q++] = bf | (bt << 1);
		o[q++] = l & ff;
		o[q++] = (l >>> 8) & ff;
		o[q++] = nL & ff;
		o[q++] = (nL >>> 8) & ff;
		o.set(d, q); // copy buffer
		q += l;
		z.op = q;
		return o.subarray(0, q);
	}
	/**
	 * 固定ハフマンブロックの作成
	 * @param {!(Uint8Array)} blockArray ブロックデータ byte array.
	 * @param {!boolean} isFinalBlock 最後のブロックならばtrue.
	 * @return {!(Uint8Array)} 固定ハフマン符号化ブロック byte array.
	 */
	makeFixedHuffmanBlock(blockArray, isFinalBlock) {
		const z = this,
			s = new BS(ZU.u8(z.output.buffer), z.op),
			R = RawDeflate,
			bf = isFinalBlock ? 1 : 0, // header
			bt = R.CT.FIXED;
		s.wB(bf, 1, T);
		s.wB(bt, 2, T);
		R.fixedHuffman(z.lz77(blockArray), s);
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
			R = RawDeflate,
			s = new BS(ZU.u8(z.output.buffer), z.op),
			hclenOrder = /** @const @type {Array.<number>} */ [
				16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
			],
			bf = isFinalBlock ? 1 : 0, // header
			tLens = /** @type {Array} */ ZU.a(19), //transLens
			bt = R.CT.DYNAMIC;
		s.wB(bf, 1, T);
		s.wB(bt, 2, T);
		const data = z.lz77(blockArray),
			lLLens = R.getLengths_(z.freqsLitLen, 15), // リテラル・長さ, 距離のハフマン符号と符号長の算出
			lLCs = R.getCodesFromLengths_(lLLens),
			dLens = R.getLengths_(z.freqsDist, 7),
			dCs = R.getCodesFromLengths_(dLens);
		for (hlit = 286; hlit > 257 && lLLens[hlit - 1] === 0; ) hlit--; // HLIT の決定
		for (hdist = 30; hdist > 1 && dLens[hdist - 1] === 0; ) hdist--; // HDIST の決定
		/** @type {{
		 *   codes: !(Uint32Array),
		 *   freqs: !(Uint8Array)
		 * }} */
		const treeSymbols = R.getTreeSymbols_(hlit, lLLens, hdist, dLens), // HCLEN
			treeLens = R.getLengths_(treeSymbols.freqs, 7);
		for (let i = 0; i < 19; i++) tLens[i] = treeLens[hclenOrder[i]];
		for (hclen = 19; hclen > 4 && tLens[hclen - 1] === 0; ) hclen--;
		const treeCodes = R.getCodesFromLengths_(treeLens);
		s.wB(hlit - 257, 5, T); // 出力
		s.wB(hdist - 1, 5, T);
		s.wB(hclen - 4, 4, T);
		for (let i = 0; i < hclen; i++) s.wB(tLens[i], 3, T);
		const cs = treeSymbols.codes; // ツリーの出力
		for (let i = 0, il = cs.length; i < il; i++) {
			const c = cs[i];
			s.wB(treeCodes[c], treeLens[c], T);
			if (c >= 16) s.wB(cs[++i], c === 16 ? 2 : c === 17 ? 3 : c === 18 ? 7 : ZU.Err(`invalid code: ${c}`), T);
		}
		R.dynamicHuffman(data, [lLCs, lLLens], [dCs, dLens], s);
		return s.finish();
	}
	/**
	 * 動的ハフマン符号化(カスタムハフマンテーブル)
	 * @param {!(Uint16Array)} dataArray LZ77 符号化済み byte array.
	 * @param {!BS} stream 書き込み用ビットストリーム.
	 * @return {!BS} ハフマン符号化済みビットストリームオブジェクト.
	 */
	static dynamicHuffman(dataArray, litLen, dist, stream) {
		const d = dataArray,
			s = stream,
			lLCs = litLen[0],
			lLLen = litLen[1],
			dCs = dist[0],
			dLens = dist[1];
		for (let i = 0, il = d.length; i < il; ++i) {
			const l = d[i]; // 符号を BitStream に書き込んでいく
			s.wB(lLCs[l], lLLen[l], T); // literal or length
			if (l > 256) {
				s.wB(d[++i], d[++i], T); // 長さ・距離符号// length extra
				const c = d[++i]; // distance
				s.wB(dCs[c], dLens[c], T);
				s.wB(d[++i], d[++i], T); // distance extra
			} else if (l === 256) break; // 終端
		}
		return s;
	}
	/**
	 * 固定ハフマン符号化
	 * @param {!(Uint16Array)} dataArray LZ77 符号化済み byte array.
	 * @param {!BS} stream 書き込み用ビットストリーム.
	 * @return {!BS} ハフマン符号化済みビットストリームオブジェクト.
	 */
	static fixedHuffman(dataArray, stream) {
		const d = dataArray,
			s = stream;
		for (let i = 0, il = d.length; i < il; i++) {
			const l = d[i]; // 符号を BitStream に書き込んでいく
			BS.prototype.wB.apply(s, RawDeflate.FHT[l]); // 符号の書き込み
			if (l > 0x100) {
				s.wB(d[++i], d[++i], T); // 長さ・距離符号 // length extra
				s.wB(d[++i], 5); // distance
				s.wB(d[++i], d[++i], T); // distance extra
			} else if (l === 0x100) break; // 終端
		}
		return s;
	}
	/**
	 * LZ77 実装
	 * @param {!(Uint8Array)} dataArray LZ77 符号化するバイト配列.
	 * @return {!(Uint16Array)} LZ77 符号化した配列.
	 */
	lz77(dataArray) {
		const d = dataArray,
			R = RawDeflate,
			t = /** @type {Object.<number, Array.<number>>} chained-hash-table */ {},
			wS = /** @const @type {number} */ R.WindowSize,
			dl = d.length,
			b = /** @type {!(Uint16Array)} lz77 buffer */ ZU.u16(dl * 2),
			/** @type {!(Uint32Array)} */
			fqLL = ZU.u32(286),
			/** @type {!(Uint32Array)} */
			fqD = ZU.u32(30),
			/** @type {number} */
			lazy = this.lazy,
			mi = R.Lz77MinLength;
		/** @type {Lz77Match} previous longest match */
		let pvM,
			q = /** @type {number} lz77 output buffer pointer */ 0,
			skipL = /** @type {number} lz77 skip length */ 0;
		fqLL[256] = 1; // EOB の最低出現回数は 1
		/**
		 * マッチデータの書き込み
		 * @param {Lz77Match} m LZ77 Match data.
		 * @param {!number} o スキップ開始位置(相対指定).
		 * @private
		 */
		function wM(m, o) {
			/** @type {Array.<number>} */
			const A = Lz77Match.toLz77Array(m.length, m.backwardDistance);
			for (let i = 0, il = A.length; i < il; ++i) b[q++] = A[i];
			fqLL[A[0]]++;
			fqD[A[3]]++;
			skipL = m.length + o - 1;
			pvM = null;
		}
		// LZ77 符号化
		for (let p = 0; p < dl; ++p) {
			let mK = 0; //chained-hash-table key
			for (let i = 0; i < mi; ++i) {
				if (p + i === dl) break;
				mK = (mK << 8) | d[p + i]; // ハッシュキーの作成
			}
			if (t[mK] === void 0) t[mK] = []; // テーブルが未定義だったら作成する
			const mL = t[mK];
			if (skipL-- > 0) {
				mL.push(p); // skip
				continue;
			}
			while (mL.length > 0 && p - mL[0] > wS) mL.shift(); // マッチテーブルの更新 (最大戻り距離を超えているものを削除する)
			if (p + mi >= dl) {
				if (pvM) wM(pvM, -1); // データ末尾でマッチしようがない場合はそのまま流しこむ
				for (let i = 0, il = dl - p; i < il; ++i) {
					const t = d[p + i];
					b[q++] = t;
					++fqLL[t];
				}
				break;
			}
			if (mL.length > 0) {
				const l = RawDeflate.searchLongestMatch_(d, p, mL); // マッチ候補から最長のものを探す
				if (pvM) {
					if (pvM.length < l.length) {
						const t = d[p - 1]; // 現在のマッチの方が前回のマッチよりも長い// write previous literal
						b[q++] = t;
						++fqLL[t];
						wM(l, 0); // write current match
					} else wM(pvM, -1); // write previous match
				} else if (l.length < lazy) pvM = l;
				else wM(l, 0);
			} else if (pvM) wM(pvM, -1); // 前回マッチしていて今回マッチがなかったら前回のを採用
			else {
				const t = d[p];
				b[q++] = t;
				++fqLL[t];
			}
			mL.push(p); // マッチテーブルに現在の位置を保存
		}
		b[q++] = 256; // 終端処理
		fqLL[256]++;
		this.freqsLitLen = fqLL;
		this.freqsDist = fqD;
		return /** @type {!(Uint16Array.<number>)} */ b.subarray(0, q);
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
		let cuM,
			mMax = 0;
		const d = data,
			dl = d.length,
			p = position;
		permatch: for (let i = 0, l = matchList.length; i < l; i++) {
			const m = matchList[l - i - 1], // 候補を後ろから 1 つずつ絞り込んでゆく
				R = RawDeflate,
				mi = R.Lz77MinLength,
				mx = R.Lz77MaxLength;
			let mL = mi;
			if (mMax > mi) {
				for (let j = mMax; j > mi; j--) if (d[m + j - 1] !== d[p + j - 1]) continue permatch; // 前回までの最長一致を末尾から一致検索する
				mL = mMax;
			}
			while (
				mL < mx && // 最長一致探索
				p + mL < dl &&
				d[m + mL] === d[p + mL]
			)
				++mL;
			if (mL > mMax) {
				cuM = m; // マッチ長が同じ場合は後方を優先
				mMax = mL;
			}
			if (mL === mx) break; // 最長が確定したら後の処理は省略
		}
		return new Lz77Match(mMax, p - cuM);
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
		const sL = hlit + hdist,
			src = ZU.u32(sL),
			r = ZU.u32(286 + 30),
			fqs = ZU.u8(19);
		let j = 0,
			nR = 0; // 符号化
		for (let i = 0; i < hlit; i++) src[j++] = litlenLengths[i];
		for (let i = 0; i < hdist; i++) src[j++] = distLengths[i];
		for (let i = 0; i < sL; i += j) {
			const srcI = src[i];
			for (j = 1; i + j < sL && src[i + j] === srcI; ) ++j; // Run Length Encoding
			let rL = j;
			if (srcI === 0) {
				if (rL < 3)
					while (rL-- > 0) {
						r[nR++] = 0; // 0 の繰り返しが 3 回未満ならばそのまま
						fqs[0]++;
					}
				else
					while (rL > 0) {
						let rpt = rL < 138 ? rL : 138; // 繰り返しは最大 138 までなので切り詰める
						if (rpt > rL - 3 && rpt < rL) rpt = rL - 3;
						if (rpt <= 10) {
							r[nR++] = 17; // 3-10 回 -> 17
							r[nR++] = rpt - 3;
							fqs[17]++;
						} else {
							r[nR++] = 18; // 11-138 回 -> 18
							r[nR++] = rpt - 11;
							fqs[18]++;
						}
						rL -= rpt;
					}
			} else {
				r[nR++] = srcI;
				fqs[srcI]++;
				rL--;
				if (rL < 3)
					while (rL-- > 0) {
						r[nR++] = srcI; // 繰り返し回数が3回未満ならばランレングス符号は要らない
						fqs[srcI]++;
					}
				else
					while (rL > 0) {
						let rpt = rL < 6 ? rL : 6; // 3 回以上ならばランレングス符号化// runLengthを 3-6 で分割
						if (rpt > rL - 3 && rpt < rL) rpt = rL - 3;
						r[nR++] = 16;
						r[nR++] = rpt - 3;
						fqs[16]++;
						rL -= rpt;
					}
			}
		}
		return {
			codes: r.subarray(0, nR),
			freqs: fqs,
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
			R = RawDeflate,
			h = /** @type {Heap} */ new Heap(2 * R.HUFMAX),
			l = /** @type {!(Uint8Array)} */ ZU.u8(nSymbols);
		for (let i = 0; i < nSymbols; ++i) if (freqs[i] > 0) h.push(i, freqs[i]); // ヒープの構築
		const hHLen = h.length / 2,
			ns = ZU.a(hHLen),
			vs = ZU.u32(hHLen),
			nl = ns.length;
		if (nl === 1) {
			l[h.pop().index] = 1; // 非 0 の要素が一つだけだった場合は、そのシンボルに符号長 1 を割り当てて終了
			return l;
		}
		for (let i = 0; i < hHLen; ++i) {
			ns[i] = h.pop(); // Reverse Package Merge Algorithm による Canonical Huffman Code の符号長決定
			vs[i] = ns[i].value;
		}
		const cLen = R.reversePackageMerge_(vs, vs.length, limit);
		for (let i = 0; i < nl; ++i) l[ns[i].index] = cLen[i];
		return l;
	}
	/**
	 * @param {number} j
	 */
	static takePkg(j, type, currentPosition, symbols, codeLength) {
		const p = currentPosition,
			t = type,
			s = symbols,
			c = codeLength,
			x = /** @type {number} */ t[j][p[j]],
			f = RawDeflate.takePkg;
		if (x === s) {
			f(j + 1, t, p, s, c);
			f(j + 1, t, p, s, c);
		} else --c[x];
		++p[j];
	}
	/**
	 * Reverse Package Merge Algorithm.
	 * @param {!(Uint32Array)} freqs sorted probability.
	 * @param {number} symbols number of symbols.
	 * @param {number} limit code length limit.
	 * @return {!(Uint8Array)} code lengths.
	 */
	static reversePackageMerge_(freqs, symbols, limit) {
		const L = limit,
			s = symbols,
			lM1 = L - 1,
			mC = /** @type {!(Uint16Array)} */ ZU.u16(L), //minCost
			flg = /** @type {!(Uint8Array)} */ ZU.u8(L),
			cLen = /** @type {!(Uint8Array)} */ ZU.u8(s),
			v = /** @type {Array} */ ZU.a(L),
			ty = /** @type {Array} */ ZU.a(L),
			cuP = /** @type {Array.<number>} */ ZU.a(L),
			hf = /** @type {number} */ 1 << lM1;
		let excess = /** @type {number} */ (1 << L) - s;
		mC[lM1] = s;
		for (let j = 0; j < L; ++j) {
			if (excess < hf) flg[j] = 0;
			else {
				flg[j] = 1;
				excess -= hf;
			}
			excess <<= 1;
			mC[L - 2 - j] = ((mC[lM1 - j] / 2) | 0) + s;
		}
		mC[0] = flg[0];
		v[0] = ZU.a(mC[0]);
		ty[0] = ZU.a(mC[0]);
		for (let j = 1; j < L; ++j) {
			if (mC[j] > 2 * mC[j - 1] + flg[j]) mC[j] = 2 * mC[j - 1] + flg[j];
			v[j] = ZU.a(mC[j]);
			ty[j] = ZU.a(mC[j]);
		}
		for (let i = 0; i < s; ++i) cLen[i] = L;
		const tml = mC[lM1];
		for (let t = 0; t < tml; ++t) {
			v[lM1][t] = freqs[t];
			ty[lM1][t] = t;
		}
		for (let i = 0; i < L; ++i) cuP[i] = 0;
		if (flg[lM1] === 1) {
			--cLen[0];
			++cuP[lM1];
		}
		for (let j = L - 2; j >= 0; --j) {
			let i = 0,
				nx = cuP[j + 1];
			const vJ0 = v[j],
				vJ1 = v[j + 1],
				tyJ = ty[j],
				mCJ = mC[j];
			for (let t = 0; t < mCJ; t++) {
				const w = vJ1[nx] + vJ1[nx + 1];
				if (w > freqs[i]) {
					vJ0[t] = w;
					tyJ[t] = s;
					nx += 2;
				} else {
					vJ0[t] = freqs[i];
					tyJ[t] = i;
					++i;
				}
			}
			cuP[j] = 0;
			if (flg[j] === 1) RawDeflate.takePkg(j, ty, cuP, s, cLen);
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
		const ls = lengths,
			il = ls.length,
			cs = ZU.u16(il),
			cnt = [],
			sC = []; //startCode
		let c = 0;
		for (const l of ls) cnt[l] = (cnt[l] | 0) + 1; // Count the codes of each length.
		for (let i = 1; i <= RawDeflate.MaxCodeLength; i++) {
			sC[i] = c; // Determine the starting code for each length block.
			c += cnt[i] | 0;
			c <<= 1;
		}
		for (let i = 0; i < il; i++) {
			const l = ls[i]; // Determine the code for each symbol. Mirrored, of course.
			let c = sC[l];
			sC[l] += 1;
			cs[i] = 0;
			for (let j = 0; j < l; j++) {
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
		return l === 3
			? [257, l - 3, 0]
			: l === 4
			? [258, l - 4, 0]
			: l === 5
			? [259, l - 5, 0]
			: l === 6
			? [260, l - 6, 0]
			: l === 7
			? [261, l - 7, 0]
			: l === 8
			? [262, l - 8, 0]
			: l === 9
			? [263, l - 9, 0]
			: l === 10
			? [264, l - 10, 0]
			: l <= 12
			? [265, l - 11, 1]
			: l <= 14
			? [266, l - 13, 1]
			: l <= 16
			? [267, l - 15, 1]
			: l <= 18
			? [268, l - 17, 1]
			: l <= 22
			? [269, l - 19, 2]
			: l <= 26
			? [270, l - 23, 2]
			: l <= 30
			? [271, l - 27, 2]
			: l <= 34
			? [272, l - 31, 2]
			: l <= 42
			? [273, l - 35, 3]
			: l <= 50
			? [274, l - 43, 3]
			: l <= 58
			? [275, l - 51, 3]
			: l <= 66
			? [276, l - 59, 3]
			: l <= 82
			? [277, l - 67, 4]
			: l <= 98
			? [278, l - 83, 4]
			: l <= 114
			? [279, l - 99, 4]
			: l <= 130
			? [280, l - 115, 4]
			: l <= 162
			? [281, l - 131, 5]
			: l <= 194
			? [282, l - 163, 5]
			: l <= 226
			? [283, l - 195, 5]
			: l <= 257
			? [284, l - 227, 5]
			: l === 258
			? [285, l - 258, 0]
			: ZU.Err(`invalid length: ${l}`);
	}
	/**
	 * 距離符号テーブル
	 * @param {!number} d 距離.
	 * @return {!Array.<number>} コード、拡張ビット、拡張ビット長の配列.
	 * @private
	 */
	static getDistanceCode_(d) {
		return d === 1
			? [0, d - 1, 0]
			: d === 2
			? [1, d - 2, 0]
			: d === 3
			? [2, d - 3, 0]
			: d === 4
			? [3, d - 4, 0]
			: d <= 6
			? [4, d - 5, 1]
			: d <= 8
			? [5, d - 7, 1]
			: d <= 12
			? [6, d - 9, 2]
			: d <= 16
			? [7, d - 13, 2]
			: d <= 24
			? [8, d - 17, 3]
			: d <= 32
			? [9, d - 25, 3]
			: d <= 48
			? [10, d - 33, 4]
			: d <= 64
			? [11, d - 49, 4]
			: d <= 96
			? [12, d - 65, 5]
			: d <= 128
			? [13, d - 97, 5]
			: d <= 192
			? [14, d - 129, 6]
			: d <= 256
			? [15, d - 193, 6]
			: d <= 384
			? [16, d - 257, 7]
			: d <= 512
			? [17, d - 385, 7]
			: d <= 768
			? [18, d - 513, 8]
			: d <= 1024
			? [19, d - 769, 8]
			: d <= 1536
			? [20, d - 1025, 9]
			: d <= 2048
			? [21, d - 1537, 9]
			: d <= 3072
			? [22, d - 2049, 10]
			: d <= 4096
			? [23, d - 3073, 10]
			: d <= 6144
			? [24, d - 4097, 11]
			: d <= 8192
			? [25, d - 6145, 11]
			: d <= 12288
			? [26, d - 8193, 12]
			: d <= 16384
			? [27, d - 12289, 12]
			: d <= 24576
			? [28, d - 16385, 13]
			: d <= 32768
			? [29, d - 24577, 13]
			: ZU.Err(`invalid distance ${d}`);
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
			L = Lz77Match,
			c1 = L.LengthCodeTable[length]; // length
		a[p++] = c1 & 0xffff;
		a[p++] = (c1 >> 16) & ff;
		a[p++] = c1 >> 24;
		const c2 = L.getDistanceCode_(backwardDistance); // distance
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
	static Flags = { ENCRYPT: 1, DESCRIPTOR: 8, UTF8: 2048 };
	static CompressionMethod = Zlib.CM;
	/**
	 * @type {Array.<number>}
	 * @const
	 */
	static FileHeaderSignature = [80, 75, 1, 2];
	/**
	 * @type {Array.<number>}
	 * @const
	 */
	static LocalFileHeaderSignature = [80, 75, 3, 4];
	/**
	 * @type {Array.<number>}
	 * @const
	 */
	static CentralDirectorySignature = [80, 75, 5, 6];
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
		const CM = Zlib.CM,
			i = input,
			u = opt;
		const filename = /** @type {string} */ opt.filename ? opt.filename : '';
		let compressed = /** @type {boolean} */ void 0,
			crc32 = /** @type {number} */ 0,
			b = ZU.isAI(i) ? ZU.u8(i) : i;
		if (!ZU.isN(u.compressionMethod)) u.compressionMethod = CM.DEFLATE; // default// その場で圧縮する場合
		const cm = u.compressionMethod;
		if (u.compress)
			if (cm === CM.DEFLATE) {
				crc32 = CRC32.calc(b);
				b = Zip.deflateWithOption(b, u);
				compressed = T;
			} else if (cm !== CM.STORE) ZU.Err(`unknown compression method:${cm}`);
		this.files.push({
			buffer: b,
			option: u,
			compressed,
			encrypted: !!u.password,
			size: i.length,
			crc32,
			filename,
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
			Z = Zip,
			CM = Zlib.CM,
			fs = z.files,
			cmt = z.comment,
			fCnt = fs.length;
		/** @type {{
		 *   buffer: !(Uint8Array),
		 *   option: Object,
		 *   compressed: boolean,
		 *   encrypted: boolean,
		 *   size: number,
		 *   crc32: number
		 * }} */
		let lFSize = /** @type {number} */ 0,
			cDSz = /** @type {number} */ 0; //centralDirectorySize
		for (let i = 0; i < fCnt; ++i) {
			const f = fs[i],
				u = f.option, // ファイルの圧縮
				fn = u.filename,
				fnLen = fn ? fn.length : 0,
				cmt = u.comment,
				cmtLen = cmt ? cmt.length : 0,
				cm = u.compressionMethod,
				pwd = u.password || z.password;
			// const extraFieldLength = opt.extraField ? opt.extraField.length : 0;
			if (!f.compressed) {
				f.crc32 = CRC32.calc(f.buffer); // 圧縮されていなかったら圧縮 // 圧縮前に CRC32 の計算をしておく
				if (cm === CM.DEFLATE) {
					f.buffer = Z.deflateWithOption(f.buffer, u);
					f.compressed = T;
				} else if (cm !== CM.STORE) ZU.Err(`unknown compression method:${cm}`);
			}
			if (pwd) {
				const k = Z.createEncryptionKey(pwd), // encryption// init encryption
					l = f.buffer.length + 12, // add header
					b = ZU.u8(l);
				b.set(f.buffer, 12);
				for (let j = 0; j < 12; ++j) b[j] = Z.encode(k, i === 11 ? f.crc32 & ff : (Math.random() * 256) | 0);
				for (let j = 12; j < l; ++j) b[j] = Z.encode(k, b[j]); // data encryption
				f.buffer = b;
			}
			lFSize += 30 + fnLen + f.buffer.length; // 必要バッファサイズの計算// local file header// file data
			cDSz += 46 + fnLen + cmtLen; // file header
		}
		const eOCDS = 22 + (cmt ? cmt.length : 0), // endOfCentralDirectorySize end of central directory
			o = ZU.u8(lFSize + cDSz + eOCDS),
			cDS = Z.CentralDirectorySignature;
		let q1 = 0,
			q2 = lFSize,
			q3 = q2 + cDSz;
		for (const f of fs) {
			const u = f.option, // ファイルの圧縮
				fn = u.filename,
				fnLen = fn ? fn.length : 0,
				cmt = u.comment,
				cmtLen = cmt ? cmt.length : 0,
				exFldLen = 0, // TODO
				off = q1, //// local file header & file header ////
				LFHS = Z.LocalFileHeaderSignature,
				FHS = Z.FileHeaderSignature;
			o[q1++] = LFHS[0]; // local file header // signature
			o[q1++] = LFHS[1];
			o[q1++] = LFHS[2];
			o[q1++] = LFHS[3];
			o[q2++] = FHS[0]; // file header
			o[q2++] = FHS[1];
			o[q2++] = FHS[2];
			o[q2++] = FHS[3];
			const nv = 20; // compressor info
			o[q2++] = nv & ff;
			o[q2++] =
				/** @type {OperatingSystem} */
				(u.os) || Z.OperatingSystem.MSDOS;
			o[q1++] = o[q2++] = nv & ff; // need version
			o[q1++] = o[q2++] = (nv >> 8) & ff;
			let flags = 0; // general purpose bit flag
			if (u.password || z.password) flags |= Z.Flags.ENCRYPT;
			o[q1++] = o[q2++] = flags & ff;
			o[q1++] = o[q2++] = (flags >> 8) & ff;
			const cm =
				/** @type {CompressionMethod} */
				(u.compressionMethod); // compression method
			o[q1++] = o[q2++] = cm & ff;
			o[q1++] = o[q2++] = (cm >> 8) & ff;
			const dt = /** @type {(Date|undefined)} */ (u.date) || new Date(); // date
			o[q1++] = o[q2++] = ((dt.getMinutes() & 0x7) << 5) | ((dt.getSeconds() / 2) | 0);
			o[q1++] = o[q2++] = (dt.getHours() << 3) | (dt.getMinutes() >> 3);
			o[q1++] = o[q2++] = (((dt.getMonth() + 1) & 0x7) << 5) | dt.getDate();
			o[q1++] = o[q2++] = (((dt.getFullYear() - 1980) & 0x7f) << 1) | ((dt.getMonth() + 1) >> 3);
			const crc32 = f.crc32; // CRC-32
			o[q1++] = o[q2++] = crc32 & ff;
			o[q1++] = o[q2++] = (crc32 >> 8) & ff;
			o[q1++] = o[q2++] = (crc32 >> 16) & ff;
			o[q1++] = o[q2++] = (crc32 >> 24) & ff;
			const size = f.buffer.length; // compressed size
			o[q1++] = o[q2++] = size & ff;
			o[q1++] = o[q2++] = (size >> 8) & ff;
			o[q1++] = o[q2++] = (size >> 16) & ff;
			o[q1++] = o[q2++] = (size >> 24) & ff;
			const plainSize = f.size; // uncompressed size
			o[q1++] = o[q2++] = plainSize & ff;
			o[q1++] = o[q2++] = (plainSize >> 8) & ff;
			o[q1++] = o[q2++] = (plainSize >> 16) & ff;
			o[q1++] = o[q2++] = (plainSize >> 24) & ff;
			o[q1++] = o[q2++] = fnLen & ff; // filename length
			o[q1++] = o[q2++] = (fnLen >> 8) & ff;
			o[q1++] = o[q2++] = exFldLen & ff; // extra field length
			o[q1++] = o[q2++] = (exFldLen >> 8) & ff;
			o[q2++] = cmtLen & ff; // file comment length
			o[q2++] = (cmtLen >> 8) & ff;
			o[q2++] = 0; // disk number start
			o[q2++] = 0;
			o[q2++] = 0; // internal file attributes
			o[q2++] = 0;
			o[q2++] = 0; // external file attributes
			o[q2++] = 0;
			o[q2++] = 0;
			o[q2++] = 0;
			o[q2++] = off & ff; // relative offset of local header
			o[q2++] = (off >> 8) & ff;
			o[q2++] = (off >> 16) & ff;
			o[q2++] = (off >> 24) & ff;
			if (fn) {
				o.set(fn, q1);
				o.set(fn, q2);
				q1 += fnLen;
				q2 += fnLen;
			}
			const exFld = u.extraField; // extra field
			if (exFld) {
				o.set(exFld, q1);
				o.set(exFld, q2);
				q1 += exFldLen;
				q2 += exFldLen;
			}
			if (cmt) {
				o.set(cmt, q2);
				q2 += cmtLen;
			}
			o.set(f.buffer, q1); //// file data ////
			q1 += f.buffer.length;
		}
		o[q3++] = cDS[0]; //// end of central directory //// signature
		o[q3++] = cDS[1];
		o[q3++] = cDS[2];
		o[q3++] = cDS[3];
		o[q3++] = 0; // number of z disk
		o[q3++] = 0;
		o[q3++] = 0; // number of the disk with the start of the central directory
		o[q3++] = 0;
		o[q3++] = fCnt & ff; // total number of entries in the central directory on z disk
		o[q3++] = (fCnt >> 8) & ff;
		o[q3++] = fCnt & ff; // total number of entries in the central directory
		o[q3++] = (fCnt >> 8) & ff;
		o[q3++] = cDSz & ff; // size of the central directory
		o[q3++] = (cDSz >> 8) & ff;
		o[q3++] = (cDSz >> 16) & ff;
		o[q3++] = (cDSz >> 24) & ff;
		o[q3++] = lFSize & ff; // offset of start of central directory with respect to the starting disk number
		o[q3++] = (lFSize >> 8) & ff;
		o[q3++] = (lFSize >> 16) & ff;
		o[q3++] = (lFSize >> 24) & ff;
		const cmtLen = cmt ? cmt.length : 0; // .ZIP file comment length
		o[q3++] = cmtLen & ff;
		o[q3++] = (cmtLen >> 8) & ff;
		if (cmt) {
			o.set(cmt, q3); // .ZIP file comment
			q3 += cmtLen;
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
	 * @param {(Uint32Array)} k
	 * @return {number}
	 */
	static getByte(k) {
		const t = (k[2] & 0xffff) | 2;
		return ((t * (t ^ 1)) >> 8) & ff;
	}
	/**
	 * @param {(Uint32Array|Object)} k
	 * @param {number} n
	 * @return {number}
	 */
	static encode(k, n) {
		const t = Zip.getByte(/** @type {(Uint32Array)} */ k);
		Zip.updateKeys(/** @type {(Uint32Array)} */ k, n);
		return t ^ n;
	}
	/**
	 * @param {(Uint32Array)} k
	 * @param {number} n
	 */
	static updateKeys(k, n) {
		k[0] = CRC32.single(k[0], n);
		k[1] = ((((((k[1] + (k[0] & ff)) * 20173) >>> 0) * 6681) >>> 0) + 1) >>> 0;
		k[2] = CRC32.single(k[2], k[1] >>> 24);
	}
	/**
	 * @param {(Uint8Array)} password
	 * @return {!(Uint32Array|Object)}
	 */
	static createEncryptionKey(password) {
		const k = ZU.u32([305419896, 591751049, 878082192]);
		for (let i = 0, il = password.length; i < il; ++i) Zip.updateKeys(k, password[i] & ff);
		return k;
	}
	/**
	 * @param {(Uint32Array|Object)} k
	 * @param {number} n
	 * @return {number}
	 */
	static decode(k, n) {
		n ^= Zip.getByte(/** @type {(Uint32Array)} */ k);
		Zip.updateKeys(/** @type {(Uint32Array)} */ k, n);
		return n;
	}
}
class LocalFileHeader {
	/**
	 * @param {!(Uint8Array)} input input buffer.
	 * @param {number} ip input position.
	 * @constructor
	 */
	constructor(input, ip) {
		const z = this;
		z.input = /** @type {!(Uint8Array)} */ input;
		z.offset = /** @type {number} */ ip;
		const i = input,
			L = Zip.LocalFileHeaderSignature;
		let p = /** @type {number} */ ip;
		if (i[p++] !== L[0] || i[p++] !== L[1] || i[p++] !== L[2] || i[p++] !== L[3])
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
		z.length = p - ip;
	}
}
/**
 * @fileoverview Deflate (RFC1951) 実装.
 * Deflateアルゴリズム本体は Zlib.RawDeflate で実装されている.
 */
class Deflate {
	static CompressionType = RawDeflate.CompressionType;
	/**
	 * Zlib Deflate
	 * @constructor
	 * @param {!(Uint8Array)} input 符号化する対象の byte array.
	 * @param {Object=} opt option parameters.
	 */
	constructor(input, opt = {}) {
		const z = this,
			u = opt,
			ct = u.compressionType,
			R = RawDeflate,
			r = /** @type {Object} */ {};
		z.input = /** @type {!(Uint8Array)} */ input;
		z.output = /** @type {!(Uint8Array)} */ ZU.u8(Zlib.DefaultBufferSize);
		z.compressionType = /** @type {Deflate.CompressionType} */ R.CT.DYNAMIC;
		if (ZU.isN(ct)) z.compressionType = ct; // option parameters
		for (const p in u) r[p] = u[p]; // copy options
		r.outputBuffer = z.output; // set raw-deflate output buffer
		z.rawDeflate = /** @type {RawDeflate} */ new R(z.input, r);
	}
	/**
	 * 直接圧縮に掛ける.
	 * @param {!(Uint8Array)} input target buffer.
	 * @param {Object=} opt option parameters.
	 * @return {!(Uint8Array)} compressed data byte array.
	 */
	static compress = (input, opt) => new Deflate(input, opt).compress();
	/**
	 * Deflate Compression.
	 * @return {!(Uint8Array)} compressed data byte array.
	 */
	compress() {
		let p = /** @type {number} */ 0;
		const z = this,
			o = z.output,
			R = RawDeflate,
			Z = Zlib,
			E = ZU.Err,
			cm = Z.CM.DEFLATE, // Compression Method and Flags
			ct = z.compressionType,
			ci = cm === Z.CM.DEFLATE ? Math.LOG2E * Math.log(R.WindowSize) - 8 : E('invalid compression method'),
			cmf = (ci << 4) | cm,
			fdict = 0, // Flags
			CT = R.CT;
		o[p++] = cmf;
		const flevel =
			cm !== Z.CM.DEFLATE
				? E('invalid compression method')
				: ct === CT.NONE
				? 0
				: ct === CT.FIXED
				? 1
				: ct === CT.DYNAMIC
				? 2
				: E('unsupported compression type');
		let flg = (flevel << 6) | (fdict << 5);
		const fc = 31 - ((cmf * 256 + flg) % 31),
			r = z.rawDeflate;
		flg |= fc;
		o[p++] = flg;
		r.op = p;
		const a = Adler32.mkHash(z.input), // Adler-32 checksum
			o2 = r.compress();
		let p2 = o2.length,
			o3 = ZU.u8(o2.buffer); // subarray 分を元にもどす
		if (o3.length <= p2 + 4) {
			z.output = ZU.u8s(o3.length + 4, o3); // expand buffer
			o3 = z.output;
		}
		const o4 = o3.subarray(0, p2 + 4);
		o4[p2++] = (a >> 24) & ff; // adler32
		o4[p2++] = (a >> 16) & ff;
		o4[p2++] = (a >> 8) & ff;
		o4[p2++] = a & ff;
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
			G = Gunzip,
			l = z.input.length; //input length.
		while (z.ip < l) G.decodeMember(z);
		z.decompressed = T;
		return G.concatMember(z.member);
	}
	/**
	 * decode gzip member.
	 * @return {!(Obj)} this
	 */
	static decodeMember(z) {
		const m = /** @type {Zlib.GunzipMember} */ new GunzipMember(),
			i = z.input,
			FM = Gzip.FlagsMask,
			E = ZU.Err,
			C = CRC32.calc;
		/** @type {number} character code */
		let c,
			p = z.ip;
		m.id1 = i[p++];
		m.id2 = i[p++];
		if (m.id1 !== 0x1f || m.id2 !== 0x8b) E(`invalid file signature:${m.id1},${m.id2}`); // check signature
		m.cm = i[p] !== 8 ? E(`unknown compression method: ${i[p]}`) : i[p++]; // check compression method
		m.flg = i[p++]; // flags
		const mT = i[p++] | (i[p++] << 8) | (i[p++] << 16) | (i[p++] << 24); // modification time
		m.mtime = new Date(mT * 1000);
		m.xfl = i[p++]; // extra flags
		m.os = i[p++]; // operating system
		if ((m.flg & FM.FEXTRA) > 0) {
			m.xlen = i[p++] | (i[p++] << 8); // extra
			p = Gunzip.decodeSubField(p, m.xlen);
		}
		if ((m.flg & FM.FNAME) > 0) {
			const s = []; // fname
			for (let j = 0; (c = i[p++]) > 0; j++) s[j] = String.fromCharCode(c);
			m.name = s.join('');
		}
		if ((m.flg & FM.FCOMMENT) > 0) {
			const s = []; // fcomment
			for (let j = 0; (c = i[p++]) > 0; j++) s[j] = String.fromCharCode(c);
			m.comment = s.join('');
		}
		if ((m.flg & FM.FHCRC) > 0) {
			m.crc16 = C(i, 0, p) & 0xffff; // fhcrc
			if (m.crc16 !== (i[p++] | (i[p++] << 8))) E('invalid header crc16');
		}
		// isize(x) を事前に取得すると展開後のサイズが分かるため、
		// inflate処理のバッファサイズが事前に分かり、高速になる
		const l = i.length,
			x = i[l - 4] | (i[l - 3] << 8) | (i[l - 2] << 16) | (i[l - 1] << 24);
		// isize(x) の妥当性チェック
		// ハフマン符号では最小 2-bit のため、最大で 1/4 になる
		// LZ77 符号では 長さと距離 2-Byte で最大 258-Byte を表現できるため、
		// 1/128 になるとする
		// ここから入力バッファの残りが isize(x) の 512 倍以上だったら
		// サイズ指定のバッファ確保は行わない事とする
		const rawi = new RawInflate(i, {
				index: p,
				bufferSize: l - p - /* CRC-32 */ 4 - /* ISIZE */ 4 < x * 512 ? x : void 0, // inflate size
			}), // compressed block // RawInflate implementation.
			iftd = rawi.decompress(), // inflated data.
			iL = iftd.length,
			ic = C(iftd);
		m.data = iftd;
		let q = rawi.ip;
		const cr = (i[q++] | (i[q++] << 8) | (i[q++] << 16) | (i[q++] << 24)) >>> 0; // crc32
		m.crc32 = cr;
		if (ic !== cr) E(`invalid CRC-32 checksum: 0x${ic.toString(16)} / 0x${cr.toString(16)}`);
		const y = (i[q++] | (i[q++] << 8) | (i[q++] << 16) | (i[q++] << 24)) >>> 0; // input size
		m.isize = y;
		if ((iL & 0xffffffff) !== y) E(`invalid input size: ${iL & 0xffffffff} / ${y}`);
		z.member.push(m);
		z.ip = q;
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
		const b = ZU.u8(size);
		for (const m of members) {
			b.set(m.data, p);
			p += m.data.length;
		}
		return b;
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
		UNKNOWN: ff,
	};
	/** @enum {number} */
	static FlagsMask = { FTEXT: 1, FHCRC: 2, FEXTRA: 4, FNAME: 8, FCOMMENT: 16 };
	/**
	 * @constructor
	 * @param {!(Uint8Array)} input input buffer.
	 * @param {Object=} opt option parameters.
	 */
	constructor(input, opt = {}) {
		const z = this,
			u = opt;
		z.input = /** @type {!(Uint8Array)} input buffer. */ input;
		z.ip = /** @type {number} input buffer pointer. */ 0;
		z.output = /** @type {!(Uint8Array)} output buffer. */ void 0;
		z.op = /** @type {number} output buffer. */ 0;
		z.flags = /** @type {!Object} flags option flags. */ {};
		z.filename = /** @type {!string} filename. */ void 0;
		z.comment = /** @type {!string} comment. */ void 0;
		z.deflateOptions = /** @type {!Object} deflate options. */ {};
		if (u.flags) z.flags = u.flags; // option parameters
		if (typeof u.filename === 'string') z.filename = u.filename;
		if (typeof u.comment === 'string') z.comment = u.comment;
		if (u.deflateOptions) z.deflateOptions = u.deflateOptions;
	}
	/**
	 * encode gzip members.
	 * @return {!(Uint8Array)} gzip binary array.
	 */
	compress() {
		const z = this,
			G = Gzip,
			C = CRC32.calc,
			o = /** @type {!(Uint8Array)} output buffer. */ ZU.u8(Zlib.DefaultBufferSize),
			ipt = z.input,
			p = z.ip,
			fn = z.filename,
			cmt = z.comment,
			FM = G.FlagsMask,
			f = z.flags,
			d = z.deflateOptions;
		let q = /** @type {number} output buffer pointer. */ 0,
			flg = 0; // flags
		o[q++] = 0x1f; // check signature
		o[q++] = 0x8b;
		o[q++] = 8; /* XXX: use Zlib const */ // check compression method
		if (f.fname) flg |= FM.FNAME;
		if (f.fcomment) flg |= FM.FCOMMENT;
		if (f.fhcrc) flg |= FM.FHCRC;
		// XXX: FTEXT
		// XXX: FEXTRA
		o[q++] = flg;
		const mT = (Date.now() / 1000) | 0; // modification time
		o[q++] = mT & ff;
		o[q++] = (mT >>> 8) & ff;
		o[q++] = (mT >>> 16) & ff;
		o[q++] = (mT >>> 24) & ff;
		o[q++] = 0; // extra flags
		o[q++] = G.OperatingSystem.UNKNOWN; // operating system
		// extra
		/* NOP */
		if (f.fname !== void 0) {
			for (let i = 0, il = fn.length; i < il; ++i) {
				const c = fn.charCodeAt(i); // fname
				if (c > ff) o[q++] = (c >>> 8) & ff;
				o[q++] = c & ff;
			}
			o[q++] = 0; // null termination
		}
		if (f.comment) {
			for (let i = 0, il = cmt.length; i < il; ++i) {
				const c = cmt.charCodeAt(i); // fcomment
				if (c > ff) o[q++] = (c >>> 8) & ff;
				o[q++] = c & ff;
			}
			o[q++] = 0; // null termination
		}
		if (f.fhcrc) {
			const crc16 = C(o, 0, q) & 0xffff; // fhcrc CRC-16 value for FHCRC flag.
			o[q++] = crc16 & ff;
			o[q++] = (crc16 >>> 8) & ff;
		}
		d.outputBuffer = o; // add compress option
		d.outputIndex = q;
		const rd = new RawDeflate(ipt, d); // compress//raw deflate object.
		let o2 = rd.compress(),
			q2 = rd.op;
		if (q2 + 8 > o2.buffer.byteLength) {
			z.output = ZU.u8s(q2 + 8, ZU.u8(o2.buffer)); // expand buffer
			o2 = z.output;
		} else o2 = ZU.u8(o2.buffer);
		const cr = C(ipt); // crc32 CRC-32 value for verification.
		o2[q2++] = cr & ff;
		o2[q2++] = (cr >>> 8) & ff;
		o2[q2++] = (cr >>> 16) & ff;
		o2[q2++] = (cr >>> 24) & ff;
		const il = ipt.length; // input size
		o2[q2++] = il & ff;
		o2[q2++] = (il >>> 8) & ff;
		o2[q2++] = (il >>> 16) & ff;
		o2[q2++] = (il >>> 24) & ff;
		z.ip = p;
		return (z.output = q2 < o2.length ? o2.subarray(0, q2) : o2);
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
		const z = this,
			i = input,
			j = z.input,
			ri = z.rawinflate;
		// /** @type {number} adler-32 checksum */
		// var adler32;
		// 新しい入力を入力バッファに結合する
		// XXX Array, Uint8Array のチェックを行うか確認する
		if (i !== void 0) {
			const t = ZU.u8s(j.length + i.length, j);
			t.set(i, j.length);
			z.input = t;
		}
		if (z.method === void 0 && z.readHeader() < 0) return ZU.u8();
		const b = /** @type {!(Uint8Array)} inflated buffer. */ ri.decompress(z.input, z.ip);
		if (ri.ip !== 0) {
			z.input = z.input.subarray(ri.ip);
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
		return b;
	}
	readHeader() {
		let p = this.ip;
		const z = this,
			D = Zlib.CM.DEFLATE,
			i = z.input,
			cmf = i[p++], // Compression Method and Flags
			flg = i[p++];
		if (cmf === void 0 || flg === void 0) return -1;
		z.method = Inflate.getMethod(cmf, flg);
		z.ip = p;
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
		const z = this,
			i = input,
			u = opt;
		z.input = /** @type {!(Uint8Array)} */ i;
		z.ip = /** @type {number} */ 0;
		if (u.index) z.ip = u.index; // option parameters
		if (u.verify) z.verify = /** @type {(boolean|undefined)} verify flag. */ u.verify;
		const cmf = /** @type {number} */ i[z.ip++], // Compression Method and Flags
			flg = /** @type {number} */ i[z.ip++];
		z.method = Inflate.getMethod(cmf, flg);
		z.rawinflate = /** @type {RawInflate} */ new RawInflate(i, {
			index: z.ip, // RawInflate
			bufferSize: u.bufferSize,
			bufferType: u.bufferType,
			resize: u.resize,
		});
	}
	static getMethod(cmf, flg) {
		const D = Zlib.CM.DEFLATE,
			E = ZU.Err,
			m = (cmf & 0x0f) === D ? D : E('unsupported compression method');
		if (((cmf << 8) + flg) % 31 !== 0) E(`invalid fcheck flag:${((cmf << 8) + flg) % 31}`); // fcheck
		if (flg & 0x20) E('fdict flag is not supported'); // fdict (not supported)
		return m;
	}
	/**
	 * decompress.
	 * @return {!(Uint8Array)} inflated buffer.
	 */
	decompress() {
		const z = this,
			A = Adler32.mkHash,
			i = /** @type {!(Uint8Array)} input buffer. */ z.input,
			r = z.rawinflate,
			b = /** @type {!(Uint8Array)} inflated buffer. */ r.decompress();
		z.ip = r.ip;
		if (z.verify) {
			// console.warn('decompress input:' + JSON.stringify(input), z.ip);
			const a = // verify adler-32
				/** @type {number} adler-32 checksum */
				((i[z.ip++] << 24) | (i[z.ip++] << 16) | (i[z.ip++] << 8) | i[z.ip++]) >>> 0;
			// console.warn('decompress adler32:' + adler32, Adler32.mkHash(buffer), buffer);
			if (a !== A(b)) ZU.Err('invalid adler-32 checksum ' + a + '/' + A(b) + ' ' + '');
		}
		return b;
	}
}
class RawInflateStream {
	//-----------------------------------------------------------------------------
	/** @define {number} buffer block size. */
	static ZLIB_STREAM_RAW_INFLATE_BUFFER_SIZE = 32768;
	//-----------------------------------------------------------------------------
	/**
	 * @param {!(Uint8Array.<number>)} input input buffer.
	 * @param {number} ip input buffer pointer.decompress
	 * @param {number=} opt_buffersize buffer block size.
	 * @constructor
	 */
	constructor(input, ip, opt_buffersize) {
		const z = this,
			ob = opt_buffersize,
			R = RawInflateStream;
		z.blocks = /** @type {!Array.<(Uint8Array)>} */ [];
		z.bufferSize = /** @type {number} block size. */ ob ? ob : R.ZLIB_STREAM_RAW_INFLATE_BUFFER_SIZE;
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
		z.status = /** @type {RawInflateStream.Status} */ R.Status.INITIALIZED;
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
			R = RawInflateStream,
			S = R.Status,
			BT = R.BlockType;
		let stop = /** @type {boolean} */ false;
		if (newInput !== void 0) z.input = newInput;
		if (ip !== void 0) z.ip = ip;
		while (!stop)
			switch (z.status) {
				case S.INITIALIZED: // block header// decompress
				case S.BLOCK_HEADER_START:
					if (z.readBlockHeader() < 0) stop = T;
					break;
				case S.BLOCK_HEADER_END: /* FALLTHROUGH */ // block body
				case S.BLOCK_BODY_START:
					switch (z.currentBT) {
						case BT.UNCOMPRESSED:
							if (z.readUncompressedBlockHeader() < 0) stop = T;
							break;
						case BT.FIXED:
							if (z.parseFixedHuffmanBlock() < 0) stop = T;
							break;
						case BT.DYNAMIC:
							if (z.parseDynamicHuffmanBlock() < 0) stop = T;
							break;
					}
					break;
				case S.BLOCK_BODY_END: // decode data
				case S.DECODE_BLOCK_START:
					switch (z.currentBT) {
						case BT.UNCOMPRESSED:
							if (z.parseUncompressedBlock() < 0) stop = T;
							break;
						case BT.FIXED: /* FALLTHROUGH */
						case BT.DYNAMIC:
							if (z.decodeHuffman() < 0) stop = T;
							break;
					}
					break;
				case S.DECODE_BLOCK_END:
					if (z.bfinal) stop = T;
					else z.status = S.INITIALIZED;
					break;
			}
		return z.concatBuf();
	}
	/**
	 * parse deflated block.
	 */
	readBlockHeader() {
		const z = this,
			R = RawInflateStream,
			S = R.Status,
			BT = R.BlockType;
		let h = /** @type {number} header */ Zlib.rB(3, z);
		z.status = S.BLOCK_HEADER_START;
		z.save_();
		if (h < 0) return z.restore_();
		if (h & 0x1) z.bfinal = T; // BFINAL
		h >>>= 1; // BTYPE
		z.currentBT =
			h === 0 ? BT.UNCOMPRESSED : h === 1 ? BT.FIXED : h == 2 ? BT.DYNAMIC : ZU.Err(`unknown BTYPE: ${h}`);
		z.status = S.BLOCK_HEADER_END;
	}
	/**
	 * read uncompressed block header
	 */
	readUncompressedBlockHeader() {
		const z = this,
			i = z.input,
			S = RawInflateStream.Status;
		let p = z.ip;
		z.status = S.BLOCK_BODY_START;
		if (p + 4 >= i.length) return -1;
		const l = /** @type {number} block length */ i[p++] | (i[p++] << 8),
			nL = /** @type {number} number for check block length */ i[p++] | (i[p++] << 8);
		if (l === ~nL) ZU.Err('invalid uncompressed block header: length verify'); // check len & nlen
		z.bitsbuf = 0; // skip buffered header bits
		z.bitsbuflen = 0;
		z.ip = p;
		z.blockLength = l;
		z.status = S.BLOCK_BODY_END;
	}
	/**
	 * parse uncompressed block.
	 */
	parseUncompressedBlock() {
		const z = this,
			i = z.input,
			S = RawInflateStream.Status;
		let p = z.ip,
			o = z.output,
			q = z.op,
			l = z.blockLength;
		z.status = S.DECODE_BLOCK_START;
		// copy
		// XXX: とりあえず素直にコピー
		while (l--) {
			if (q === o.length) o = z.expandBuf({ fixRatio: 2 });
			if (p >= i.length) {
				z.ip = p; // not enough input buffer
				z.op = q;
				z.blockLength = l + 1; // コピーしてないので戻す
				return -1;
			}
			o[q++] = i[p++];
		}
		if (l < 0) z.status = S.DECODE_BLOCK_END;
		z.ip = p;
		z.op = q;
		return 0;
	}
	/**
	 * parse fixed huffman block.
	 */
	parseFixedHuffmanBlock() {
		const S = RawInflateStream.Status;
		this.status = S.BLOCK_BODY_START;
		this.litlenTable = Zlib.FLLT;
		this.distTable = Zlib.FDT;
		this.status = S.BLOCK_BODY_END;
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
	restore_(q) {
		const z = this;
		if (q !== void 0) z.op = q;
		z.ip = z.ip_;
		z.bitsbuflen = z.bitsbuflen_;
		z.bitsbuf = z.bitsbuf_;
		return -1;
	}
	/**
	 * parse dynamic huffman block.
	 */
	parseDynamicHuffmanBlock() {
		const z = this,
			Z = Zlib,
			R = RawInflate,
			S = RawInflateStream.Status,
			cLens = /** @type {!(Uint8Array)} code lengths. */ ZU.u8(Z.Order.length);
		z.status = S.BLOCK_BODY_START;
		z.save_();
		const hlit = /** @type {number} number of literal and length codes. */ Z.rB(5, z) + 257,
			hdist = /** @type {number} number of distance codes. */ Z.rB(5, z) + 1,
			hclen = /** @type {number} number of code lengths. */ Z.rB(4, z) + 4;
		if (hlit < 0 || hdist < 0 || hclen < 0) return z.restore_();
		try {
			const [a, b] = R.pDHBI(z, hlit, hdist, hclen, cLens);
			// litlenLengths = ZU.u8(hlit); // literal and length code
			// distLengths = ZU.u8(hdist); // distance code
			z.litlenTable = a;
			z.distTable = b;
		} catch (e) {
			return z.restore_();
		}
		z.status = S.BLOCK_BODY_END;
		return 0;
	}
	/**
	 * decode huffman code (dynamic)
	 * @return {(number|undefined)} -1 is error.
	 */
	decodeHuffman() {
		const z = this,
			lL = z.litlenTable,
			dist = z.distTable,
			S = RawInflateStream.Status,
			Z = Zlib;
		let o = z.output,
			q = z.op,
			oL = o.length;
		z.status = S.DECODE_BLOCK_START;
		while (o) {
			z.save_();
			const c = /** @type {number} huffman code. */ Z.readCodeByTable(lL, z);
			if (c < 0) return z.restore_(q);
			if (c === 256) break;
			if (c < 256) {
				if (q === oL) {
					o = z.expandBuf(); // literal
					oL = o.length;
				}
				o[q++] = c;
				continue;
			}
			const ti = /** @type {number} table index. */ c - 257; // length code
			let cLen = /** @type {number} huffman code length. */ Z.LCT[ti];
			if (Z.LET[ti] > 0) {
				const b = Z.rB(Z.LET[ti], z);
				if (b < 0) return z.restore_(q);
				cLen += b;
			}
			const dc = Z.readCodeByTable(dist, z); // dist code
			if (dc < 0) return z.restore_(q);
			let cD = /** @type {number} huffman code distination. */ Z.DCT[dc];
			if (Z.DET[dc] > 0) {
				const b = Z.rB(Z.DET[dc], z);
				if (b < 0) return z.restore_(q);
				cD += b;
			}
			if (q + cLen >= oL) {
				o = z.expandBuf(); // lz77 decode
				oL = o.length;
			}
			while (cLen--) o[q] = o[q++ - cD];
			if (z.ip === z.input.length) {
				z.op = q; // break
				return -1;
			}
		}
		while (z.bitsbuflen >= 8) {
			z.bitsbuflen -= 8;
			z.ip--;
		}
		z.op = q;
		z.status = S.DECODE_BLOCK_END;
	}
	/**
	 * expand output buffer. (dynamic)
	 * @param {Object=} opt option parameters.
	 * @return {!(Uint8Array)} output buffer pointer.
	 */
	expandBuf(opt) {
		const z = this,
			i = z.input,
			iL = i.length,
			o = z.output,
			oL = o.length,
			u = opt;
		let r = /** @type {number} expantion ratio. */ (iL / z.ip + 1) | 0,
			n = /** @type {number} new output buffer size. */ 0;
		if (u) {
			if (ZU.isN(u.fixRatio)) r = u.fixRatio;
			if (ZU.isN(u.addRatio)) r += u.addRatio;
		}
		if (r < 2) {
			const maxHuffCode = /** @type {number} maximum number of huffman code. */ (iL - z.ip) / z.litlenTable[2], // calculate new buffer size
				maxInflSz = /** @type {number} max inflate size. */ ((maxHuffCode / 2) * 258) | 0;
			n = maxInflSz < oL ? oL + maxInflSz : oL << 1;
		} else n = oL * r;
		return (z.output = /** @type {!(Uint8Array)} store buffer. */ ZU.u8s(n, o)); // buffer expantion
	}
	/**
	 * concat output buffer. (dynamic)
	 * @return {!(Uint8Array)} output buffer.
	 */
	concatBuf() {
		const z = this,
			q = /** @type {number} */ z.op,
			t = /** @type {Uint8Array} */ z.output,
			p = t.subarray(z.sp, q),
			M = Zlib.MaxBackwardLength,
			s = z.bufferSize + M;
		z.sp = q;
		if (q > s) {
			z.op = z.sp = M; // compaction
			z.output = ZU.u8s(s, t.subarray(q - M, q));
		}
		return /** @type {!(Uint8Array)} output buffer. */ z.resize ? ZU.u8(p) : p;
	}
}
export class RawInflate {
	/**
	 * @enum {number}
	 */
	static BufferType = {
		BLOCK: 0,
		ADAPTIVE: 1,
	};
	static BT = RawInflate.BufferType;
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
		const z = this,
			Z = Zlib,
			BT = RawInflate.BT,
			u = opt;
		z.buffer = /** @type {!(Uint8Array)} inflated buffer */ void 0;
		z.blocks = /** @type {!Array.<(Uint8Array)>} */ [];
		z.bufferSize = /** @type {number} block size. */ Z.ZLIB_RAW_INFLATE_BUFFER_SIZE;
		z.totalpos = /** @type {!number} total output buffer pointer. */ 0;
		z.ip = /** @type {!number} input buffer pointer. */ 0;
		z.bitsbuf = /** @type {!number} bit stream reader buffer. */ 0;
		z.bitsbuflen = /** @type {!number} bit stream reader buffer size. */ 0;
		z.input = /** @type {!(Uint8Array)} input buffer. */ ZU.u8(input);
		z.output = /** @type {!(Uint8Array.<number>)} output buffer. */ void 0;
		z.op = /** @type {!number} output buffer pointer. */ void 0;
		z.bfinal = /** @type {boolean} is final block flag. */ false;
		z.bufferType = /** @type {RawInflate.BufferType} buffer management. */ BT.ADAPTIVE;
		z.resize = /** @type {boolean} resize flag for memory size optimization. */ false;
		if (u.index) z.ip = u.index;
		if (u.bufferSize) z.bufferSize = u.bufferSize;
		if (u.bufferType) z.bufferType = u.bufferType;
		if (u.resize) z.resize = u.resize;
		const bt = z.bufferType;
		if (bt === BT.BLOCK) {
			z.op = Z.MaxBackwardLength;
			z.output = ZU.u8(z.op + z.bufferSize + Z.MaxCopyLength);
		} else if (bt === BT.ADAPTIVE) {
			z.op = 0;
			z.output = ZU.u8(z.bufferSize);
		} else ZU.Err('invalid inflate mode');
	}
	/**
	 * decompress.
	 * @return {!(Uint8Array.<number>)} inflated buffer.
	 */
	decompress() {
		const z = this,
			BT = RawInflate.BT;
		while (!z.bfinal) z.parseBlock();
		return z.bufferType === BT.BLOCK
			? z.concatBufferBlock()
			: BT.ADAPTIVE
			? z.concatBufferDynamic()
			: ZU.Err('invalid inflate mode');
	}
	/**
	 * parse deflated block.
	 */
	parseBlock() {
		const z = this;
		let h = Zlib.rB(3, z);
		if (h & 0x1) z.bfinal = T; // BFINAL
		h >>>= 1; // BTYPE
		return h === 0
			? z.parseUncompressedBlock() // uncompressed
			: h === 1
			? z.parseFixedHuffmanBlock() // fixed huffman
			: h === 2
			? z.parseDynamicHuffmanBlock() // dynamic huffman
			: ZU.Err(`unknown BTYPE: ${h}`); // reserved or other
	}
	/**
	 * parse uncompressed block.
	 */
	parseUncompressedBlock() {
		const z = this,
			i = z.input,
			iL = i.length,
			oL = z.output.length, //output buffer length
			bt = z.bufferType,
			BT = RawInflate.BT,
			E = ZU.Err;
		let p = z.ip,
			o = z.output,
			q = z.op;
		z.bitsbuf = 0; // skip buffered header bits
		z.bitsbuflen = 0;
		if (p + 1 >= iL) E('invalid uncompressed block header: LEN');
		let l = i[p++] | (i[p++] << 8); // len block length
		if (p + 1 >= iL) E('invalid uncompressed block header: NLEN');
		const nL = i[p++] | (i[p++] << 8); // nlen number for check block length
		if (l === ~nL) E('invalid uncompressed block header: length verify'); // check len & nlen
		if (p + l > iL) E('input buffer is broken'); // check size
		if (bt === BT.BLOCK) {
			while (q + l > o.length) {
				const cc = oL - q; //copy counter
				l -= cc;
				o.set(i.subarray(p, p + cc), q);
				q += cc;
				p += cc;
				z.op = q;
				o = z.expandBufferBlock(); // expand buffer
				q = z.op;
			}
		} else if (bt === BT.ADAPTIVE) while (q + l > o.length) o = z.expandBufferAdaptive({ fixRatio: 2 });
		else E('invalid inflate mode');
		o.set(i.subarray(p, p + l), q); // copy
		q += l;
		p += l;
		z.ip = p;
		z.op = q;
		z.output = o;
	}
	/**
	 * parse fixed huffman block.
	 */
	parseFixedHuffmanBlock() {
		return RawInflate.a(this.bufferType, this, Zlib.FLLT, Zlib.FDT);
	}
	static a = (bt, z, a, b) =>
		bt === RawInflate.BT.ADAPTIVE
			? z.decodeHuffmanAdaptive(a, b)
			: bt === RawInflate.BT.BLOCK
			? z.decodeHuffmanBlock(a, b)
			: ZU.Err('invalid inflate mode');
	/**
	 * parse dynamic huffman block.
	 */
	parseDynamicHuffmanBlock() {
		const z = this,
			Z = Zlib,
			R = RawInflate,
			bt = z.bufferType,
			hlit = /** @type {number} number of literal and length codes. */ Z.rB(5, z) + 257,
			hdist = /** @type {number} number of distance codes. */ Z.rB(5, z) + 1,
			hclen = /** @type {number} number of code lengths. */ Z.rB(4, z) + 4,
			cLens = /** @type {!(Uint8Array.<number>)} code lengths. */ ZU.u8(Z.Order.length);
		const [a, b] = R.pDHBI(z, hlit, hdist, hclen, cLens);
		return R.a(bt, z, a, b);
	}
	static pDHBI(z, hlit, hdist, hclen, cLens) {
		const h = hlit + hdist,
			Z = Zlib,
			H = Huffman,
			E = ZU.Err;
		let pv = /** @type {number} */ 0;
		for (let i = 0; i < hclen; ++i) {
			const b = Z.rB(3, z); // decode code lengths
			if (b < 0) E('not enough input');
			cLens[Z.Order[i]] = b;
		}
		const cLT = /** @type {!Array} code lengths table. */ H.bT(cLens), // decode length table
			lT = /** @type {!(Uint8Array.<number>)} code length table. */ ZU.u8(h);
		for (let i = 0; i < h; ) {
			let b = /** @type {number} */ 0;
			const c = Z.readCodeByTable(cLT, z);
			if (c < 0) E('not enough input');
			let rpt;
			if (c === 16) {
				if ((b = Z.rB(2, z)) < 0) E('not enough input');
				rpt = 3 + b;
				while (rpt--) lT[i++] = pv;
			} else if (c === 17) {
				if ((b = Z.rB(3, z)) < 0) E('not enough input');
				rpt = 3 + b;
				while (rpt--) lT[i++] = 0;
				pv = 0;
			} else if (c === 18) {
				if ((b = Z.rB(7, z)) < 0) E('not enough input');
				rpt = 11 + b;
				while (rpt--) lT[i++] = 0;
				pv = 0;
			} else {
				lT[i++] = c;
				pv = c;
			}
		}
		return [H.bT(lT.subarray(0, hlit)), H.bT(lT.subarray(hlit))];
	}
	/**
	 * decode huffman code
	 * @param {!(Uint16Array)} litlen literal and length code table.
	 * @param {!(Uint8Array)} dist distination code table.
	 */
	decodeHuffmanBlock(litlen, dist) {
		const z = this,
			Z = Zlib,
			oL = o.length - Z.MaxCopyLength, //output position limit.
			lCT = Z.LCT,
			lET = Z.LET,
			dCT = Z.DCT,
			dET = Z.DET,
			l = litlen;
		let o = z.output,
			q = z.op,
			c; //huffman code.
		z.currentLitlenTable = l;
		while ((c = Z.readCodeByTable(l, z)) !== 256) {
			if (c === 0) return;
			if (c < 256) {
				if (q >= oL) {
					z.op = q; // literal
					o = z.expandBufferBlock();
					q = z.op;
				}
				o[q++] = c;
				continue;
			}
			const ti = c - 257; // length code
			let cL = lCT[ti]; //huffman code length.
			if (lET[ti] > 0) cL += Z.rB(lET[ti], z);
			const cD = Z.readCodeByTable(dist, z); // dist code
			let cDist = dCT[cD]; //huffman code distination.
			if (dET[cD] > 0) cDist += Z.rB(dET[cD], z);
			if (q >= oL) {
				z.op = q; // lz77 decode
				o = z.expandBufferBlock();
				q = z.op;
			}
			while (cL--) o[q] = o[q++ - cDist];
		}
		while (z.bitsbuflen >= 8) {
			z.bitsbuflen -= 8;
			z.ip--;
		}
		z.op = q;
	}
	/**
	 * decode huffman code (adaptive)
	 * @param {!(Uint16Array)} litlen literal and length code table.
	 * @param {!(Uint8Array)} dist distination code table.
	 */
	decodeHuffmanAdaptive(litlen, dist) {
		const z = this,
			Z = Zlib,
			lCT = Z.LCT,
			lET = Z.LET,
			dCT = Z.DCT,
			dET = Z.DET,
			l = litlen;
		let o = z.output,
			q = z.op,
			oL = o.length, //output position limit.
			c; //huffman code.
		z.currentLitlenTable = l;
		while ((c = Z.readCodeByTable(l, z)) !== 256) {
			if (c < 256) {
				if (q >= oL) {
					o = z.expandBufferAdaptive(); // literal
					oL = o.length;
				}
				o[q++] = c;
				continue;
			}
			const ti = c - 257; // length code
			let cL = lCT[ti]; //huffman code length.
			if (lET[ti] > 0) cL += Z.rB(lET[ti], z);
			const cD = Z.readCodeByTable(dist, z); // dist code
			let cDist = dCT[cD]; //huffman code distination.
			if (dET[cD] > 0) cDist += Z.rB(dET[cD], z);
			if (q + cL > oL) {
				o = z.expandBufferAdaptive(); // lz77 decode
				oL = o.length;
			}
			while (cL--) o[q] = o[q++ - cDist];
		}
		while (z.bitsbuflen >= 8) {
			z.bitsbuflen -= 8;
			z.ip--;
		}
		z.op = q;
	}
	/**
	 * expand output buffer.
	 * @param {Object=} opt option parameters.
	 * @return {!(Uint8Array)} output buffer.
	 */
	expandBufferBlock() {
		const z = this,
			M = Zlib.MaxBackwardLength,
			bw = z.op - M, //backward base point
			o = z.output,
			b = ZU.u8s(bw, o.subarray(M, bw)); //store buffer.// copy to output buffer
		z.blocks.push(b);
		z.totalpos += b.length;
		o.set(o.subarray(bw, bw + M)); // copy to backward buffer
		z.op = M;
		return o;
	}
	/**
	 * expand output buffer. (adaptive)
	 * @param {Object=} opt option parameters.
	 * @return {!(Uint8Array)} output buffer pointer.
	 */
	expandBufferAdaptive(opt = {}) {
		const z = this,
			u = opt,
			i = z.input,
			iL = i.length,
			o = z.output,
			cuL = o.length,
			MFS = MAX_FIREFOX_SIZE;
		let r = (iL / z.ip + 1) | 0, //expantion ratio.
			n; //new output buffer size.
		if (cuL === MFS) ZU.Err('TOO LOG LENGTH OF BUFFER ADAPTIVE!');
		if (ZU.isN(u.fixRatio)) r = u.fixRatio;
		if (ZU.isN(u.addRatio)) r += u.addRatio;
		if (r < 2) {
			const maxHuffCode = (iL - z.ip) / z.currentLitlenTable[2], // calculate new buffer size //maximum number of huffman code.
				maxInflateSize = ((maxHuffCode / 2) * 258) | 0; //max inflate size.
			n = maxInflateSize < cuL ? cuL + maxInflateSize : cuL << 1;
		} else n = cuL * r;
		return (z.output = ZU.u8s(MFS > n ? n : MFS, o)); // buffer expantion //store buffer.
	}
	/**
	 * concat output buffer.
	 * @return {!(Uint8Array)} output buffer.
	 */
	concatBufferBlock() {
		let p = 0; //buffer pointer.
		const z = this,
			MBL = Zlib.MaxBackwardLength,
			lmt = z.totalpos + (z.op - MBL), //buffer pointer.
			o = z.output, //output block array.
			bs = z.blocks, //blocks array.
			b = ZU.u8(lmt); //output buffer.
		if (bs.length === 0) return o.subarray(MBL, z.op); // single buffer
		for (const b of bs) for (let j = 0, jl = b.length; j < jl; ++j) b[p++] = b[j]; // copy to buffer
		for (let i = MBL, il = z.op; i < il; ++i) b[p++] = o[i]; // current buffer
		z.blocks = [];
		return (z.buffer = b);
	}
	/**
	 * concat output buffer. (dynamic)
	 * @return {!(Uint8Array)} output buffer.
	 */
	concatBufferDynamic() {
		const z = this,
			q = z.op,
			s = z.output.subarray(0, q);
		return (z.buffer = z.resize ? ZU.u8s(q, s) : s); //output buffer.
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
		const z = this,
			i = input;
		z.input = /** @type {!(Uint8Array)} */ ZU.isAI(i) ? ZU.u8(i) : i;
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
	static CompressionMethod = Zip.CM;
	searchEndOfCentralDirectoryRecord() {
		const z = this,
			i = z.input,
			l = i.length,
			v = z.eocdrOffset,
			C = Zip.CentralDirectorySignature;
		if (v) return v;
		for (let p = l - 12; p > 0; --p)
			if (i[p] === C[0] && i[p + 1] === C[1] && i[p + 2] === C[2] && i[p + 3] === C[3])
				return (z.eocdrOffset = p);
		ZU.Err('End of Central Directory Record not found');
	}
	parseEndOfCentralDirectoryRecord() {
		const z = this,
			i = z.input,
			C = Zip.CentralDirectorySignature,
			v = z.centralDirectoryOffset;
		if (v) return v;
		let p = z.searchEndOfCentralDirectoryRecord();
		if (i[p++] !== C[0] || i[p++] !== C[1] || i[p++] !== C[2] || i[p++] !== C[3]) ZU.Err('invalid signature'); // signature
		z.numberOfThisDisk = i[p++] | (i[p++] << 8); // number of z disk
		z.startDisk = i[p++] | (i[p++] << 8); // number of the disk with the start of the central directory
		z.totalEntriesThisDisk = i[p++] | (i[p++] << 8); // total number of entries in the central directory on z disk
		z.totalEntries = i[p++] | (i[p++] << 8); // total number of entries in the central directory
		z.centralDirectorySize = (i[p++] | (i[p++] << 8) | (i[p++] << 16) | (i[p++] << 24)) >>> 0; // size of the central directory
		z.centralDirectoryOffset = (i[p++] | (i[p++] << 8) | (i[p++] << 16) | (i[p++] << 24)) >>> 0; // offset of start of central directory with respect to the starting disk number
		z.commentLength = i[p++] | (i[p++] << 8); // .ZIP file comment length
		z.comment = i.subarray(p, p + z.commentLength); // .ZIP file comment
		return z.centralDirectoryOffset;
	}
	parseFileHeader(isRetT) {
		const z = this,
			c = z.fileHeaderList,
			t = z.filenameToIndex;
		if (c) return isRetT ? t : c;
		const fL = [],
			fT = {},
			v = z.parseEndOfCentralDirectoryRecord(),
			il = z.totalEntries;
		let p = v;
		for (let i = 0; i < il; ++i) {
			const fH = new FileHeader(z.input, p);
			p += fH.length;
			fL[i] = fH;
			fT[fH.filename] = i;
		}
		if (z.centralDirectorySize < p - v) ZU.Err('invalid file header size');
		z.fileHeaderList = fL;
		z.filenameToIndex = fT;
		return isRetT ? fT : fL;
	}
	/**
	 * @param {number} index file header index.
	 * @param {Object=} opt
	 * @return {!(Uint8Array)} file data.
	 */
	getFileData(index, opt = {}) {
		const z = this,
			ipt = z.input,
			fHL = z.fileHeaderList,
			U = Zip,
			E = ZU.Err;
		if (!fHL) z.parseFileHeader();
		if (fHL[index] === void 0) E('wrong index');
		let p = fHL[index].relativeOffset,
			a = 0;
		const lFH = new LocalFileHeader(z.input, p),
			c = lFH.compression,
			pwd = opt.password || z.password;
		p += lFH.length;
		let l = lFH.compressedSize;
		if ((lFH.flags & U.Flags.ENCRYPT) !== 0) {
			if (!pwd) E('please set password'); // decryption
			const k = U.createEncryptionKey(pwd);
			for (let i = p, il = p + 12; i < il; ++i) U.decode(k, ipt[i]); // encryption header
			p += 12;
			l -= 12;
			for (let i = p, il = p + l; i < il; ++i) ipt[i] = U.decode(k, ipt[i]); // decryption
		}
		const CM = Zlib.CM,
			d = {
				index: p,
				bufferSize: lFH.plainSize,
			},
			b =
				c === CM.STORE
					? ipt.subarray(p, p + l)
					: c === CM.DEFLATE
					? new RawInflate(ipt, d).decompress()
					: E('unknown compression type');
		if (z.verify) {
			const cr = CRC32.calc(b);
			if (lFH.crc32 !== cr) E(`wrong crc: file=0x${lFH.crc32.toString(16)}, data=0x${cr.toString(16)}`);
		}
		return b;
	}
	/**
	 * @return {Array.<string>}
	 */
	getFilenames() {
		const fNL = [],
			fHL = this.parseFileHeader(),
			l = fHL.length;
		for (let i = 0; i < l; ++i) fNL[i] = fHL[i].filename;
		return fNL;
	}
	/**
	 * @param {string} filename extract filename.
	 * @param {Object=} opt
	 * @return {!(Uint8Array)} decompressed data.
	 */
	decompress(filename, opt) {
		const z = this,
			fn = filename,
			t = z.parseFileHeader(T);
		return t[fn] >= 0 ? z.getFileData(t[fn], opt) : ZU.Err(`${fn} not found`);
	}
	/**
	 * @param {(Uint8Array)} password
	 */
	setPassword(password) {
		this.password = password;
	}
}
Zlib.Zip = Zip;
Zlib.Zip.CompressionMethod = Zlib.CM;
Zlib.Gunzip = Gunzip;
Zlib.Gzip = Gzip;
Zlib.Deflate = Deflate;
Zlib.InflateStream = InflateStream;
Zlib.Inflate = Inflate;
Zlib.RawDeflate = RawDeflate;
Zlib.RawInflateStream = RawInflateStream;
Zlib.RawInflate = RawInflate;
Zlib.Unzip = Unzip;
