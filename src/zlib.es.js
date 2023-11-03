/**
 * @fileoverview Zlib namespace. Zlib の仕様に準拠した圧縮は Zlib.Deflate で実装
 * されている. これは Inflate との共存を考慮している為.
 */
/** @define {boolean} */
const ZLIB_CRC32_COMPACT = false,
	MAX_FIREFOX_SIZE = 8589934592,
	T = true,
	ff = 255,
	fi = 258,
	f4 = 65535,
	f8 = 0xffffffff,
	z2 = 256,
	z83 = 32768;
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
	static U = (n) => n === void 0;
	static isAI = (n) => n instanceof Array;
	static s = (a, b, e) => a.subarray(b, e);
	static M = (n, m) => (n >>> m) & ff;
	static N = (n, m) => (n >> m) & ff;
}
class Huffman {
	/**
	 * build huffman table from length list.
	 * @param {!(Uint8Array)} la length list.
	 * @return {!Array} huffman table.
	 */
	static bT(la) {
		const l = /** @type {number} length list size. */ la.length;
		let x = /** @type {number} max code length for table size. */ 0,
			i = /** @type {number} min code length for table size. */ Infinity;
		for (const v of la) {
			if (v > x) x = v; // Math.max は遅いので最長の値は for-loop で取得する
			if (v < i) i = v;
		}
		const S = 1 << x, //table size.
			t = ZU.u32(S); //huffman code table.
		// ビット長の短い順からハフマン符号を割り当てる
		for (let b = 1, c = 0, s = 2; b <= x; ) {
			for (let j = 0; j < l; ++j)
				if (la[j] === b) {
					let rv = 0; //reversed code.// ビットオーダーが逆になるためビット長分並びを反転する
					for (let rt = c, k = 0; k < b; ++k) {
						rv = (rv << 1) | (rt & 1);
						rt >>= 1; //reverse temp.
					}
					// 最大ビット長をもとにテーブルを作るため、
					// 最大ビット長以外では 0 / 1 どちらでも良い箇所ができる
					// そのどちらでも良い場所は同じ値で埋めることで
					// 本来のビット長以上のビット数取得しても問題が起こらないようにする
					const v = (b << 16) | j;
					for (let k = rv; k < S; k += s) t[k] = v;
					++c;
				}
			++b; //bit length.// 次のビット長へ
			c <<= 1; //huffman code.
			s <<= 1; //サイズが 2^maxlength 個のテーブルを埋めるためのスキップ長.
		}
		return [t, x, i];
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
	static DefaultBufferSize = z83;
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
	 * MaxBackwardLength
	 * @const
	 * @type {number} max backward length for LZ77.
	 */
	static MBL = z83;
	/**
	 * MaxCopyLength
	 * @const
	 * @type {number} max copy length for LZ77.
	 */
	static MCL = fi;
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
		3,
		4,
		5,
		6,
		7,
		8,
		9,
		10,
		11,
		13,
		15,
		17,
		19,
		23,
		27,
		31,
		35,
		43,
		51,
		59,
		67,
		83,
		99,
		115,
		131,
		163,
		195,
		227,
		fi,
		fi,
		fi,
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
		const C = /** @type {!(Uint8Array)} huffman code table */ table[0],
			X = table[1],
			i = z.input;
		let b = z.bitsbuf,
			l = z.bitsbuflen,
			p = z.ip;
		while (l < X) {
			if (i.length <= p) return -1; // not enough buffer
			b |= i[p++] << l;
			l += 8;
		}
		const M = C[b & ((1 << X) - 1)], //code length & code (16bit, 16bit) // read max length
			c = M >>> 16; //code bits length
		if (c > l) ZU.Err(`invalid code length: ${c}`);
		z.bitsbuf = b >> c;
		z.bitsbuflen = l - c;
		z.ip = p;
		return M & f4;
	}
	/**
	 * read inflate bits
	 * @param {number} length bits length.
	 * @param {!(obj)} z a this
	 * @return {number} read bits.
	 */
	static rB(length, z, isThrowErr = false) {
		const L = length,
			i = z.input,
			I = i.length;
		let b = z.bitsbuf,
			l = z.bitsbuflen,
			p = z.ip;
		if (isThrowErr && p + ((L - l + 7) >> 3) >= I) ZU.Err('input buffer is broken'); // input byte
		while (l < L) {
			if (I <= p) return -1; // not enough buffer
			b |= i[p++] << l; // not enough buffer
			l += 8;
		}
		z.bitsbuf = b >>> L;
		z.bitsbuflen = l - L;
		z.ip = p;
		return b & /* MASK */ ((1 << L) - 1); //input and output byte.// output byte
	}
	static rBt = (l, z) => Zlib.B(l, z, T);

	/** @define {number} buffer block size. */
	static ZLIB_RAW_INFLATE_BUFFER_SIZE = z83; // [ 0x8000 >= ZLIB_BUFFER_BLOCK_SIZE ]
}
class FileHeader {
	/**
	 * @param {!(Uint8Array)} input input buffer.
	 * @param {number} ip input position.
	 * @constructor
	 */
	constructor(input, ip) {
		const z = this,
			i = input,
			F = Zip.FileHeaderSignature,
			S = ZU.s;
		z.input = /** @type {!(Uint8Array)} */ i;
		z.offset = /** @type {number} */ ip;
		let p = z.offset;
		if (i[p++] !== F[0] || i[p++] !== F[1] || i[p++] !== F[2] || i[p++] !== F[3])
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
		z.filename = String.fromCharCode.apply(null, S(i, p, (p += z.fileNameLength))); // file name
		z.extraField = S(i, p, (p += z.extraFieldLength)); // extra field
		z.comment = S(i, p, p + z.fileCommentLength); // file comment
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
	static mkH = (a) => Adler32.update(1, typeof a === 'string' ? ZU.stringToByteArray(a) : a);
	/**
	 * Adler32 ハッシュ値の更新
	 * @param {number} adler 現在のハッシュ値.
	 * @param {!(Uint8Array)} a 更新に使用する byte array.
	 * @return {number} Adler32 ハッシュ値.
	 */
	static update(adler, a) {
		const o = Adler32.OptimizationParameter,
			A = adler;
		let x = /** @type {number} */ A & f4,
			y = /** @type {number} */ (A >>> 16) & f4,
			l = /** @type {number} array length */ a.length,
			i = /** @type {number} array index */ 0;
		while (l > 0) {
			/** @type {number} loop length (don't overflow) */
			let t = l > o ? o : l;
			l -= t;
			do {
				x += a[i++];
				y += x;
			} while (--t);
			x %= 65521;
			y %= 65521;
		}
		return ((y << 16) | x) >>> 0;
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
	static DefaultBlockSize = z83;
	constructor(buffer, bufferPosition) {
		const z = this,
			b = bufferPosition,
			i = /** @type {number} buffer index. */ ZU.isN(b) ? b : 0,
			f = buffer,
			u = f instanceof Uint8Array ? f : ZU.u8(BS.DefaultBlockSize),
			l = u.length;
		z.index = i;
		z.bitindex = /** @type {number} bit index. */ 0;
		/** @type {!(Uint8Array)} bit-stream output buffer. */
		z.buffer = u;
		// 入力された index が足りなかったら拡張するが、倍にしてもダメなら不正とする
		if (l * 2 <= i) ZU.Err('invalid index');
		else if (l <= i) BS.exBuf(z);
	}
	/**
	 * expand buffer.
	 * @return {!(Uint8Array)} new buffer.
	 */
	static exBuf = (z) => (z.buffer = ZU.u8s(z.buffer.length << 1, z.buffer));
	/**
	 * 数値をビットで指定した数だけ書き込む.
	 * @param {number} number 書き込む数値.
	 * @param {number} n 書き込むビット数.
	 * @param {boolean=} reverse 逆順に書き込むならば true.
	 */
	wB(number, n, reverse) {
		const z = this,
			T = BS.RT,
			N = number;
		let b = z.buffer,
			j = z.index,
			i = z.bitindex,
			c = /** @type {number} current octet. */ b[j];
		if (reverse && n > 1) number = n > 8 ? BS.rev32_(N, T) >> (32 - n) : T[N] >> (8 - n);
		if (n + i < 8) {
			c = (c << n) | number; // Byte 境界を超えないとき
			i += n;
		} else
			for (let k = 0; k < n; ++k) {
				c = (c << 1) | ((number >> (n - k - 1)) & 1); // Byte 境界を超えるとき
				if (++i === 8) {
					i = 0; // next byte
					b[j++] = T[c];
					c = 0;
					if (j === b.length) b = BS.exBuf(z); // expand
				}
			}
		b[j] = c;
		z.buffer = b;
		z.bitindex = i;
		z.index = j;
	}
	/**
	 * 32-bit 整数のビット順を逆にする
	 * @param {number} n 32-bit integer.
	 * @return {number} reversed 32-bit integer.
	 * @private
	 */
	static rev32_ = (n, T) => (T[n & ff] << 24) | (T[ZU.M(n, 8)] << 16) | (T[ZU.M(n, 16)] << 8) | T[ZU.M(n, 24)];

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
		return ZU.s(b, 0, i); // array truncation;
	}
	//buildReverseTable
	static bRT() {
		const t = /** @type {!(Uint8Array)} reverse table. */ ZU.u8(z2);
		for (let i = 0; i < z2; ++i) {
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
	static RT = (() => BS.bRT())();
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
			S = CRC32.C,
			l = length,
			N = ZU.isN,
			L = N(l) ? l : d.length;
		let i = N(pos) ? pos : (pos = 0);
		crc ^= f8;
		for (i = L & 7; i--; ++pos) crc = S(crc, d[pos]); // (crc >>> 8) ^ t[(crc ^ d[pos]) & ff]; // loop unrolling for performance
		for (i = L >> 3; i--; pos += 8) for (let j = 0; j < 8; j++) crc = S(crc, d[pos + j]);
		return (crc ^ f8) >>> 0;
	}
	static C = (crc, a) => (crc >>> 8) ^ CRC32.T[(crc ^ a) & ff];
	/**
	 * @param {number} num
	 * @param {number} crc
	 * @returns {number}
	 */
	static single = (num, crc) => (CRC32.T[(num ^ crc) & ff] ^ (num >>> 8)) >>> 0;
	/**
	 * @type {Array.<number>}
	 * @const
	 * @private
	 */
	static T_ = [
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
	//buildCompactTable
	static bCT() {
		const t = /** @type {!(Uint32Array)} */ ZU.u32(z2);
		for (let i = 0; i < z2; ++i) {
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
	static T = ZLIB_CRC32_COMPACT ? CRC32.bCT() : ZU.u32(CRC32.T_);
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
	static gP = (i) => (((i - 2) / 4) | 0) * 2;
	/**
	 * 子ノードの index 取得
	 * @param {number} i 親ノードの index.
	 * @return {number} 子ノードの index.
	 */
	static gC = (i) => 2 * i + 2;
	/**
	 * Heap に値を追加する
	 * @param {number} i キー index.
	 * @param {number} v 値.
	 * @return {number} 現在のヒープ長.
	 */
	push(i, v) {
		const z = this,
			h = z.buffer; // ルートノードにたどり着くまで入れ替えを試みる
		let c = z.length;
		h[z.length++] = v;
		h[z.length++] = i;
		while (c > 0) {
			const p = Heap.gP(c); // 親ノードと比較して親の方が小さければ入れ替える
			if (h[c] > h[p]) {
				const x = h[c];
				h[c] = h[p];
				h[p] = x;
				const y = h[c + 1];
				h[c + 1] = h[p + 1];
				h[p + 1] = y;
				c = p;
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
			let c = Heap.gC(p);
			if (c >= l) break; // 範囲チェック
			if (c + 2 < l && h[c + 2] > h[c]) c += 2; // 隣のノードと比較して、隣の方が値が大きければ隣を現在ノードとして選択
			if (h[c] > h[p]) {
				const x = h[p]; // 親ノードと比較して親の方が小さい場合は入れ替える
				h[p] = h[c];
				h[c] = x;
				const y = h[p + 1];
				h[p + 1] = h[c + 1];
				h[c + 1] = y;
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
	//CompressionType
	static CT = {
		NONE: 0,
		FIXED: 1,
		DYNAMIC: 2,
		RESERVED: 3,
	};
	static CompressionType = RawDeflate.CT;
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
	static Lz77MaxLength = fi;
	/**dynamic random data
	 * LZ77 のウィンドウサイズ WindowSize
	 * @const
	 * @type {number}
	 */
	static WS = z83;
	/**
	 * 最長の符号長 MaxCodeLength
	 * @const
	 * @type {number}
	 */
	static MCL = 16;
	/**
	 * ハフマン符号の最大数値
	 * @const
	 * @type {number}
	 */
	static HUFMAX = 286;
	/**
	 * 固定ハフマン符号の符号化テーブル FixedHuffmanTable
	 * @const
	 * @type {Array.<Array.<number, number>>}
	 */
	static FHT = (() => {
		const t = [];
		for (let i = 0; i < 288; i++)
			t.push(
				i <= 143
					? [i + 48, 8]
					: i <= ff
					? [i - 144 + 400, 9]
					: i <= 279
					? [i - z2 + 0, 7]
					: i <= 287
					? [i - 280 + 192, 8]
					: ZU.Err(`invalid literal: ${i}`)
			);
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
		const z = this,
			i = input,
			u = opt,
			Z = ZU,
			A = Z.isAI,
			N = Z.isN,
			U = Z.u8,
			V = void 0;
		z.compressionType = /** @type {RawDeflate.CompressionType} */ RawDeflate.CT.DYNAMIC;
		z.lazy = /** @type {number} */ 0;
		z.freqsLitLen = /** @type {!(Uint32Array)} */ V;
		z.freqsDist = /** @type {!(Uint32Array)} */ V;
		z.input = /** @type {!(Uint8Array)} */ A(i) ? U(i) : i;
		z.output = /** @type {!(Uint8Array)} output output buffer. */ V;
		z.op = /** @type {number} pos output buffer position. */ 0;
		if (u) {
			const o = u.outputBuffer,
				x = u.outputIndex,
				c = u.compressionType;
			if (u.lazy) z.lazy = u.lazy; // option parameters
			if (N(c)) z.compressionType = c;
			if (o) z.output = A(o) ? U(o) : o;
			if (N(x)) z.op = x;
		}
		if (!z.output) z.output = U(z83);
	}
	/**
	 * DEFLATE ブロックの作成
	 * @return {!(Uint8Array)} 圧縮済み byte array.
	 */
	compress() {
		const z = this,
			C = RawDeflate.CT,
			c = z.compressionType,
			i = z.input; // compression
		if (c === C.NONE) {
			for (let p = 0, l = i.length; p < l; ) {
				const b = ZU.s(i, p, p + f4); // each f4-Byte (length header: 16-bit)
				p += b.length;
				z.output = z.makeNocompressBlock(b, p === l);
			}
		} else if (c === C.FIXED) {
			z.output = z.makeFixedHuffmanBlock(i, T);
			z.op = z.output.length;
		} else if (c === C.DYNAMIC) {
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
			L = d.length; // length;
		let q = z.op,
			l = z.output.buffer.byteLength;
		const t = q + L + 5;
		while (l <= t) l = l << 1; // expand buffer
		const o = ZU.u8(l),
			b = isFinalBlock ? 1 : 0, // header
			N = RawDeflate.CT.NONE,
			n = (~L + 65536) & f4;
		o.set(z.output);
		o[q++] = b | (N << 1);
		o[q++] = L & ff;
		o[q++] = ZU.M(L, 8);
		o[q++] = n & ff;
		o[q++] = ZU.M(n, 8);
		o.set(d, q); // copy buffer
		q += L;
		z.op = q;
		return ZU.s(o, 0, q);
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
			R = RawDeflate;
		s.wB(isFinalBlock ? 1 : 0, 1, T); // header
		s.wB(R.CT.FIXED, 2, T);
		R.fH(z.lz77(blockArray), s);
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
			gLs = R.gLs,
			gCL = R.gCFLs,
			s = new BS(ZU.u8(z.output.buffer), z.op),
			H = /** @const @type {Array.<number>} */ [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], //hclenOrder
			tLs = /** @type {Array} */ ZU.a(19); //transLens
		s.wB(isFinalBlock ? 1 : 0, 1, T); // header
		s.wB(R.CT.DYNAMIC, 2, T);
		const dt = z.lz77(blockArray),
			lL = gLs(z.freqsLitLen, 15), // リテラル・長さ, 距離のハフマン符号と符号長の算出//litLenLengths
			lC = gCL(lL), //litLenCodes
			dL = gLs(z.freqsDist, 7), //distLengths
			dC = gCL(dL); //distCodes
		for (hlit = 286; hlit > 257 && lL[hlit - 1] === 0; ) hlit--; // HLIT の決定
		for (hdist = 30; hdist > 1 && dL[hdist - 1] === 0; ) hdist--; // HDIST の決定
		/** @type {{
		 *   codes: !(Uint32Array),
		 *   freqs: !(Uint8Array)
		 * }} */
		const tS = R.gTS(hlit, lL, hdist, dL), // treeSymbols HCLEN
			tL = gLs(tS.freqs, 7); //treeLens
		for (let i = 0; i < 19; i++) tLs[i] = tL[H[i]];
		for (hclen = 19; hclen > 4 && tLs[hclen - 1] === 0; ) hclen--;
		const tC = gCL(tL); //treeCodes
		s.wB(hlit - 257, 5, T); // 出力
		s.wB(hdist - 1, 5, T);
		s.wB(hclen - 4, 4, T);
		for (let i = 0; i < hclen; i++) s.wB(tLs[i], 3, T);
		const t = tS.codes, // ツリーの出力
			L = t.length;
		for (let i = 0; i < L; i++) {
			const c = t[i];
			s.wB(tC[c], tL[c], T);
			if (c >= 16) s.wB(t[++i], c === 16 ? 2 : c === 17 ? 3 : c === 18 ? 7 : ZU.Err(`invalid code: ${c}`), T);
		}
		R.dH(dt, [lC, lL], [dC, dL], s);
		return s.finish();
	}
	/**
	 * 動的ハフマン符号化(カスタムハフマンテーブル)dynamicHuffman
	 * @param {!(Uint16Array)} dataArray LZ77 符号化済み byte array.
	 * @param {!BS} stream 書き込み用ビットストリーム.
	 * @return {!BS} ハフマン符号化済みビットストリームオブジェクト.
	 */
	static dH(dataArray, litLen, dist, stream) {
		const d = dataArray,
			s = stream,
			lC = litLen[0], //litLenCodes
			lL = litLen[1], //litLenLengths
			dC = dist[0], //distCodes
			dL = dist[1], //distLengths
			L = d.length;
		for (let i = 0; i < L; ++i) {
			const l = d[i]; // 符号を BitStream に書き込んでいく
			s.wB(lC[l], lL[l], T); // literal or length
			if (l > z2) {
				s.wB(d[++i], d[++i], T); // 長さ・距離符号// length extra
				const c = d[++i]; // distance
				s.wB(dC[c], dL[c], T);
				s.wB(d[++i], d[++i], T); // distance extra
			} else if (l === z2) break; // 終端
		}
		return s;
	}
	/**
	 * 固定ハフマン符号化fixedHuffman
	 * @param {!(Uint16Array)} dataArray LZ77 符号化済み byte array.
	 * @param {!BS} stream 書き込み用ビットストリーム.
	 * @return {!BS} ハフマン符号化済みビットストリームオブジェクト.
	 */
	static fH(dataArray, stream) {
		const d = dataArray,
			s = stream,
			L = d.length;
		for (let i = 0; i < L; i++) {
			const l = d[i]; // 符号を BitStream に書き込んでいく
			BS.prototype.wB.apply(s, RawDeflate.FHT[l]); // 符号の書き込み
			if (l > z2) {
				s.wB(d[++i], d[++i], T); // 長さ・距離符号 // length extra
				s.wB(d[++i], 5); // distance
				s.wB(d[++i], d[++i], T); // distance extra
			} else if (l === z2) break; // 終端
		}
		return s;
	}
	/**
	 * LZ77 実装
	 * @param {!(Uint8Array)} dataArray LZ77 符号化するバイト配列.
	 * @return {!(Uint16Array)} LZ77 符号化した配列.
	 */
	lz77(dataArray) {
		/** @type {Lz77Match} previous longest match */
		let p,
			q = /** @type {number} lz77 output buffer pointer */ 0,
			s = /** @type {number} lz77 skip length */ 0;
		const d = dataArray,
			R = RawDeflate,
			t = /** @type {Object.<number, Array.<number>>} chained-hash-table */ {},
			D = d.length,
			b = /** @type {!(Uint16Array)} lz77 buffer */ ZU.u16(D * 2),
			/** @type {!(Uint32Array)} */
			fL = ZU.u32(286),
			/** @type {!(Uint32Array)} */
			fD = ZU.u32(30),
			/** @type {number} */
			lz = this.lazy,
			I = R.Lz77MinLength,
			/**
			 * マッチデータの書き込み
			 * @param {Lz77Match} m LZ77 Match data.
			 * @param {!number} o スキップ開始位置(相対指定).
			 * @private
			 */
			wM = (m, o) => {
				/** @type {Array.<number>} */
				const l = m.length,
					A = Lz77Match.toLz77Array(l, m.backwardDistance),
					L = A.length;
				for (let i = 0; i < L; ++i) b[q++] = A[i];
				fL[A[0]]++;
				fD[A[3]]++;
				s = l + o - 1;
				p = null;
			};
		fL[z2] = 1; // EOB の最低出現回数は 1
		// LZ77 符号化
		for (let i = 0; i < D; ++i) {
			let m = 0; //chained-hash-table key
			for (let j = 0; j < I; ++j) {
				if (i + j === D) break;
				m = (m << 8) | d[i + j]; // ハッシュキーの作成
			}
			if (ZU.U(t[m])) t[m] = []; // テーブルが未定義だったら作成する
			const M = t[m];
			if (s-- > 0) {
				M.push(i); // skip
				continue;
			}
			while (M.length > 0 && i - M[0] > R.WS) M.shift(); // マッチテーブルの更新 (最大戻り距離を超えているものを削除する)
			if (i + I >= D) {
				if (p) wM(p, -1); // データ末尾でマッチしようがない場合はそのまま流しこむ
				for (let j = 0, il = D - i; j < il; ++j) {
					const t = d[i + j];
					b[q++] = t;
					++fL[t];
				}
				break;
			}
			if (M.length > 0) {
				const l = R.searchLongestMatch_(d, i, M), // マッチ候補から最長のものを探す
					L = l.length;
				if (p) {
					if (p.length < L) {
						const t = d[i - 1]; // 現在のマッチの方が前回のマッチよりも長い// write previous literal
						b[q++] = t;
						++fL[t];
						wM(l, 0); // write current match
					} else wM(p, -1); // write previous match
				} else if (L < lz) p = l;
				else wM(l, 0);
			} else if (p) wM(p, -1); // 前回マッチしていて今回マッチがなかったら前回のを採用
			else {
				const t = d[i];
				b[q++] = t;
				++fL[t];
			}
			M.push(i); // マッチテーブルに現在の位置を保存
		}
		b[q++] = z2; // 終端処理
		fL[z2]++;
		this.freqsLitLen = fL;
		this.freqsDist = fD;
		return /** @type {!(Uint16Array.<number>)} */ ZU.s(b, 0, q);
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
		let u,
			x = 0;
		const d = data,
			L = d.length,
			p = position,
			c = matchList,
			C = c.length;
		pm: for (let i = 0; i < C; i++) {
			const m = c[C - i - 1], // 候補を後ろから 1 つずつ絞り込んでゆく
				R = RawDeflate,
				I = R.Lz77MinLength,
				X = R.Lz77MaxLength;
			let n = I;
			if (x > I) {
				for (let j = x; j > I; j--) if (d[m + j - 1] !== d[p + j - 1]) continue pm; // 前回までの最長一致を末尾から一致検索する
				n = x;
			}
			while (
				n < X && // 最長一致探索
				p + n < L &&
				d[m + n] === d[p + n]
			)
				++n;
			if (n > x) {
				u = m; // マッチ長が同じ場合は後方を優先
				x = n;
			}
			if (n === X) break; // 最長が確定したら後の処理は省略
		}
		return new Lz77Match(x, p - u);
	}
	/**
	 * Tree-Transmit Symbols の算出 getTreeSymbols_
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
	static gTS(hlit, litlenLengths, hdist, distLengths) {
		const sL = hlit + hdist,
			U = ZU.u32,
			s = U(sL), //src
			r = U(286 + 30),
			q = ZU.u8(19); //freqs
		let j = 0,
			n = 0; // 符号化
		for (let i = 0; i < hlit; i++) s[j++] = litlenLengths[i];
		for (let i = 0; i < hdist; i++) s[j++] = distLengths[i];
		for (let i = 0; i < sL; i += j) {
			const k = s[i]; //srcIndex
			for (j = 1; i + j < sL && s[i + j] === k; ) ++j; // Run Length Encoding
			let y = j; //runLength
			if (k === 0) {
				if (y < 3)
					while (y-- > 0) {
						r[n++] = 0; // 0 の繰り返しが 3 回未満ならばそのまま
						q[0]++;
					}
				else
					while (y > 0) {
						let t = y < 138 ? y : 138; // 繰り返しは最大 138 までなので切り詰める
						if (t > y - 3 && t < y) t = y - 3;
						if (t <= 10) {
							r[n++] = 17; // 3-10 回 -> 17
							r[n++] = t - 3;
							q[17]++;
						} else {
							r[n++] = 18; // 11-138 回 -> 18
							r[n++] = t - 11;
							q[18]++;
						}
						y -= t;
					}
			} else {
				r[n++] = k;
				q[k]++;
				y--;
				if (y < 3)
					while (y-- > 0) {
						r[n++] = k; // 繰り返し回数が3回未満ならばランレングス符号は要らない
						q[k]++;
					}
				else
					while (y > 0) {
						let t = y < 6 ? y : 6; // 3 回以上ならばランレングス符号化// runLengthを 3-6 で分割
						if (t > y - 3 && t < y) t = y - 3;
						r[n++] = 16;
						r[n++] = t - 3;
						q[16]++;
						y -= t;
					}
			}
		}
		return {
			codes: ZU.s(r, 0, n),
			freqs: q,
		};
	}
	/**
	 * ハフマン符号の長さを取得する getLengths_
	 * @param {!(Uint8Array|Uint32Array)} freqs 出現カウント.
	 * @param {number} limit 符号長の制限.
	 * @return {!(Uint8Array)} 符号長配列.
	 * @private
	 */
	static gLs(freqs, limit) {
		const n = /** @type {number} */ freqs.length,
			R = RawDeflate,
			h = /** @type {Heap} */ new Heap(2 * R.HUFMAX),
			l = /** @type {!(Uint8Array)} */ ZU.u8(n);
		for (let i = 0; i < n; ++i) if (freqs[i] > 0) h.push(i, freqs[i]); // ヒープの構築
		const f = h.length / 2,
			s = ZU.a(f),
			v = ZU.u32(f),
			m = s.length;
		if (m === 1) {
			l[h.pop().index] = 1; // 非 0 の要素が一つだけだった場合は、そのシンボルに符号長 1 を割り当てて終了
			return l;
		}
		for (let i = 0; i < f; ++i) {
			s[i] = h.pop(); // Reverse Package Merge Algorithm による Canonical Huffman Code の符号長決定
			v[i] = s[i].value;
		}
		const c = R.rPKM(v, v.length, limit);
		for (let i = 0; i < m; ++i) l[s[i].index] = c[i];
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
	 * Reverse Package Merge Algorithm. reversePackageMerge_
	 * @param {!(Uint32Array)} freqs sorted probability.
	 * @param {number} symbols number of symbols.
	 * @param {number} limit code length limit.
	 * @return {!(Uint8Array)} code lengths.
	 */
	static rPKM(freqs, symbols, limit) {
		const q = freqs,
			L = limit,
			s = symbols,
			a = ZU.a,
			M = L - 1,
			m = /** @type {!(Uint16Array)} */ ZU.u16(L), //minCost
			f = /** @type {!(Uint8Array)} */ ZU.u8(L),
			c = /** @type {!(Uint8Array)} */ ZU.u8(s),
			v = /** @type {Array} */ a(L),
			y = /** @type {Array} */ a(L),
			P = /** @type {Array.<number>} */ a(L),
			h = /** @type {number} */ 1 << M;
		let ex = /** @type {number} */ (1 << L) - s;
		m[M] = s;
		for (let j = 0; j < L; ++j) {
			if (ex < h) f[j] = 0;
			else {
				f[j] = 1;
				ex -= h;
			}
			ex <<= 1;
			m[L - 2 - j] = ((m[M - j] / 2) | 0) + s;
		}
		m[0] = f[0];
		v[0] = a(m[0]);
		y[0] = a(m[0]);
		for (let j = 1; j < L; ++j) {
			if (m[j] > 2 * m[j - 1] + f[j]) m[j] = 2 * m[j - 1] + f[j];
			v[j] = a(m[j]);
			y[j] = a(m[j]);
		}
		for (let i = 0; i < s; ++i) c[i] = L;
		const t = m[M];
		for (let i = 0; i < t; ++i) {
			v[M][i] = q[i];
			y[M][i] = i;
		}
		for (let i = 0; i < L; ++i) P[i] = 0;
		if (f[M] === 1) {
			--c[0];
			++P[M];
		}
		for (let j = L - 2; j >= 0; --j) {
			let i = 0,
				n = P[j + 1];
			const v0 = v[j],
				v1 = v[j + 1],
				yj = y[j],
				mj = m[j];
			for (let t = 0; t < mj; t++) {
				const w = v1[n] + v1[n + 1];
				if (w > q[i]) {
					v0[t] = w;
					yj[t] = s;
					n += 2;
				} else {
					v0[t] = q[i];
					yj[t] = i;
					++i;
				}
			}
			P[j] = 0;
			if (f[j] === 1) RawDeflate.takePkg(j, y, P, s, c);
		}
		return c;
	}
	/**
	 * 符号長配列からハフマン符号を取得する getCodesFromLengths_
	 * reference: PuTTY Deflate implementation
	 * @param {!(Uint8Array)} la 符号長配列.
	 * @return {!(Uint16Array)} ハフマン符号配列.
	 * @private
	 */
	static gCFLs(la) {
		const L = la.length,
			o = ZU.u16(L),
			t = [],
			s = []; //startCode
		let c = 0;
		for (const l of la) t[l] = (t[l] | 0) + 1; // Count the codes of each length.
		for (let i = 1; i <= RawDeflate.MCL; i++) {
			s[i] = c; // Determine the starting code for each length block.
			c += t[i] | 0;
			c <<= 1;
		}
		for (let i = 0; i < L; i++) {
			const l = la[i]; // Determine the code for each symbol. Mirrored, of course.
			let c = s[l];
			s[l] += 1;
			o[i] = 0;
			for (let j = 0; j < l; j++) {
				o[i] = (o[i] << 1) | (c & 1);
				c >>>= 1;
			}
		}
		return o;
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
	static LengthCodeTable = Lz77Match.bLCT(); //buildLengthCodeTable
	static bLCT() {
		const t = /** @type {!Array} */ [];
		for (let i = 3; i <= fi; i++) {
			const c = Lz77Match.c(i);
			t[i] = (c[2] << 24) | (c[1] << 16) | c[0];
		}
		return ZU.u32(t);
	}
	/**
	 * code
	 * @param {number} l lz77 length.
	 * @return {!Array.<number>} lz77 codes.
	 */
	static c(l) {
		return l === 3
			? [257, l - 3, 0]
			: l === 4
			? [fi, l - 4, 0]
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
			: l === fi
			? [285, l - fi, 0]
			: ZU.Err(`invalid length: ${l}`);
	}
	/**
	 * 距離符号テーブル //getDistanceCode_
	 * @param {!number} d 距離.
	 * @return {!Array.<number>} コード、拡張ビット、拡張ビット長の配列.
	 * @private
	 */
	static gDC(d) {
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
			: d <= z2
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
			: d <= z83
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
		a[p++] = c1 & f4;
		a[p++] = ZU.N(c1, 16);
		a[p++] = c1 >> 24;
		const c2 = L.gDC(backwardDistance); // distance
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
		const C = Zlib.CM,
			i = input,
			u = opt,
			D = C.DEFLATE,
			N = /** @type {string} */ u.filename ? u.filename : '';
		let c = /** @type {boolean} */ void 0,
			r = /** @type {number} */ 0,
			b = ZU.isAI(i) ? ZU.u8(i) : i;
		if (!ZU.isN(u.compressionMethod)) u.compressionMethod = D; // default// その場で圧縮する場合
		const M = u.compressionMethod;
		if (u.compress)
			if (M === D) {
				r = CRC32.calc(b);
				b = Zip.deflateWithOption(b, u);
				c = T;
			} else if (M !== C.STORE) ZU.Err(`unknown compression method:${M}`);
		this.files.push({
			buffer: b,
			option: u,
			compressed: c,
			encrypted: !!u.password,
			size: i.length,
			crc32: r,
			filename: N,
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
			C = Zlib.CM,
			fs = z.files,
			cmt = z.comment,
			fC = fs.length,
			U = ZU,
			Y = U.N;
		/** @type {{
		 *   buffer: !(Uint8Array),
		 *   option: Object,
		 *   compressed: boolean,
		 *   encrypted: boolean,
		 *   size: number,
		 *   crc32: number
		 * }} */
		let lF = /** @type {number} */ 0,
			cZ = /** @type {number} */ 0; //centralDirectorySize
		for (let i = 0; i < fC; ++i) {
			const f = fs[i],
				u = f.option, // ファイルの圧縮
				n = u.filename,
				nL = n ? n.length : 0,
				cmt = u.comment,
				cmL = cmt ? cmt.length : 0,
				M = u.compressionMethod,
				w = u.password || z.password,
				b = f.buffer,
				E = Z.encode;
			// const extraFieldLength = opt.extraField ? opt.extraField.length : 0;
			if (!f.compressed) {
				f.crc32 = CRC32.calc(b); // 圧縮されていなかったら圧縮 // 圧縮前に CRC32 の計算をしておく
				if (M === C.DEFLATE) {
					f.buffer = Z.deflateWithOption(b, u);
					f.compressed = T;
				} else if (M !== C.STORE) U.Err(`unknown compression method:${M}`);
			}
			if (w) {
				const k = Z.createEncryptionKey(w), // encryption// init encryption
					e = f.buffer,
					l = e.length + 12, // add header
					b = U.u8(l);
				b.set(e, 12);
				for (let j = 0; j < 12; ++j) b[j] = E(k, i === 11 ? f.crc32 & ff : (Math.random() * z2) | 0);
				for (let j = 12; j < l; ++j) b[j] = E(k, b[j]); // data encryption
				f.buffer = b;
			}
			lF += 30 + nL + f.buffer.length; // 必要バッファサイズの計算// local file header// file data
			cZ += 46 + nL + cmL; // file header
		}
		const eOCDS = 22 + (cmt ? cmt.length : 0), // endOfCentralDirectorySize end of central directory
			o = U.u8(lF + cZ + eOCDS),
			cDS = Z.CentralDirectorySignature;
		let q1 = 0,
			q2 = lF,
			q3 = q2 + cZ;
		for (const f of fs) {
			const u = f.option, // ファイルの圧縮
				e = f.buffer,
				n = u.filename,
				nL = n ? n.length : 0,
				cmt = u.comment,
				cmL = cmt ? cmt.length : 0,
				eFL = 0, // TODO
				off = q1, //// local file header & file header ////
				LH = Z.LocalFileHeaderSignature,
				FH = Z.FileHeaderSignature;
			o[q1++] = LH[0]; // local file header // signature
			o[q1++] = LH[1];
			o[q1++] = LH[2];
			o[q1++] = LH[3];
			o[q2++] = FH[0]; // file header
			o[q2++] = FH[1];
			o[q2++] = FH[2];
			o[q2++] = FH[3];
			const v = 20; // compressor info//needVersion
			o[q2++] = v & ff;
			o[q2++] =
				/** @type {OperatingSystem} */
				(u.os) || Z.OperatingSystem.MSDOS;
			o[q1++] = o[q2++] = v & ff; // need version
			o[q1++] = o[q2++] = Y(v, 8);
			let fg = 0; // general purpose bit flag
			if (u.password || z.password) fg |= Z.Flags.ENCRYPT;
			o[q1++] = o[q2++] = fg & ff;
			o[q1++] = o[q2++] = Y(fg, 8);
			const cm =
				/** @type {CompressionMethod} */
				(u.compressionMethod); // compression method
			o[q1++] = o[q2++] = cm & ff;
			o[q1++] = o[q2++] = Y(cm, 8);
			const t = /** @type {(Date|undefined)} */ (u.date) || new Date(); // date
			o[q1++] = o[q2++] = ((t.getMinutes() & 0x7) << 5) | ((t.getSeconds() / 2) | 0);
			o[q1++] = o[q2++] = (t.getHours() << 3) | (t.getMinutes() >> 3);
			o[q1++] = o[q2++] = (((t.getMonth() + 1) & 0x7) << 5) | t.getDate();
			o[q1++] = o[q2++] = (((t.getFullYear() - 1980) & 0x7f) << 1) | ((t.getMonth() + 1) >> 3);
			const cr = f.crc32; // CRC-32
			o[q1++] = o[q2++] = cr & ff;
			o[q1++] = o[q2++] = Y(cr, 8);
			o[q1++] = o[q2++] = Y(cr, 16);
			o[q1++] = o[q2++] = Y(cr, 24);
			const sz = e.length; // compressed size
			o[q1++] = o[q2++] = sz & ff;
			o[q1++] = o[q2++] = Y(sz, 8);
			o[q1++] = o[q2++] = Y(sz, 16);
			o[q1++] = o[q2++] = Y(sz, 24);
			const ps = f.size; // uncompressed size
			o[q1++] = o[q2++] = ps & ff;
			o[q1++] = o[q2++] = Y(ps, 8);
			o[q1++] = o[q2++] = Y(ps, 16);
			o[q1++] = o[q2++] = Y(ps, 24);
			o[q1++] = o[q2++] = nL & ff; // filename length
			o[q1++] = o[q2++] = Y(nL, 8);
			o[q1++] = o[q2++] = eFL & ff; // extra field length
			o[q1++] = o[q2++] = Y(eFL, 8);
			o[q2++] = cmL & ff; // file comment length
			o[q2++] = Y(cmL, 8);
			o[q2++] = 0; // disk number start
			o[q2++] = 0;
			o[q2++] = 0; // internal file attributes
			o[q2++] = 0;
			o[q2++] = 0; // external file attributes
			o[q2++] = 0;
			o[q2++] = 0;
			o[q2++] = 0;
			o[q2++] = off & ff; // relative offset of local header
			o[q2++] = Y(off, 8);
			o[q2++] = Y(off, 16);
			o[q2++] = Y(off, 24);
			if (n) {
				o.set(n, q1);
				o.set(n, q2);
				q1 += nL;
				q2 += nL;
			}
			const exF = u.extraField; // extra field
			if (exF) {
				o.set(exF, q1);
				o.set(exF, q2);
				q1 += eFL;
				q2 += eFL;
			}
			if (cmt) {
				o.set(cmt, q2);
				q2 += cmL;
			}
			o.set(e, q1); //// file data ////
			q1 += e.length;
		}
		o[q3++] = cDS[0]; //// end of central directory //// signature
		o[q3++] = cDS[1];
		o[q3++] = cDS[2];
		o[q3++] = cDS[3];
		o[q3++] = 0; // number of z disk
		o[q3++] = 0;
		o[q3++] = 0; // number of the disk with the start of the central directory
		o[q3++] = 0;
		o[q3++] = fC & ff; // total number of entries in the central directory on z disk
		o[q3++] = Y(fC, 8);
		o[q3++] = fC & ff; // total number of entries in the central directory
		o[q3++] = Y(fC, 8);
		o[q3++] = cZ & ff; // size of the central directory
		o[q3++] = Y(cZ, 8);
		o[q3++] = Y(cZ, 16);
		o[q3++] = Y(cZ, 24);
		o[q3++] = lF & ff; // offset of start of central directory with respect to the starting disk number
		o[q3++] = Y(lF, 8);
		o[q3++] = Y(lF, 16);
		o[q3++] = Y(lF, 24);
		const cmL = cmt ? cmt.length : 0; // .ZIP file comment length
		o[q3++] = cmL & ff;
		o[q3++] = Y(cmL, 8);
		if (cmt) {
			o.set(cmt, q3); // .ZIP file comment
			q3 += cmL;
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
	static gB(k) {
		const t = (k[2] & f4) | 2;
		return ((t * (t ^ 1)) >> 8) & ff;
	}
	/**
	 * @param {(Uint32Array|Object)} k
	 * @param {number} n
	 * @return {number}
	 */
	static encode(k, n) {
		const t = Zip.gB(/** @type {(Uint32Array)} */ k);
		Zip.upKs(/** @type {(Uint32Array)} */ k, n);
		return t ^ n;
	}
	/**
	 * @param {(Uint32Array)} k
	 * @param {number} n
	 */
	static upKs(k, n) {
		const S = CRC32.single;
		k[0] = S(k[0], n);
		k[1] = ((((((k[1] + (k[0] & ff)) * 20173) >>> 0) * 6681) >>> 0) + 1) >>> 0;
		k[2] = S(k[2], k[1] >>> 24);
	}
	/**
	 * @param {(Uint8Array)} w
	 * @return {!(Uint32Array|Object)}
	 */
	static createEncryptionKey(w) {
		const k = ZU.u32([305419896, 591751049, 878082192]);
		for (let i = 0; i < w.length; ++i) Zip.upKs(k, w[i] & ff);
		return k;
	}
	/**
	 * @param {(Uint32Array|Object)} k
	 * @param {number} n
	 * @return {number}
	 */
	static decode(k, n) {
		n ^= Zip.gB(/** @type {(Uint32Array)} */ k);
		Zip.upKs(/** @type {(Uint32Array)} */ k, n);
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
		const z = this,
			i = input,
			L = Zip.LocalFileHeaderSignature,
			S = ZU.s;
		let p = /** @type {number} */ ip;
		z.input = /** @type {!(Uint8Array)} */ i;
		z.offset = /** @type {number} */ p;
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
		z.filename = String.fromCharCode.apply(null, S(i, p, (p += z.fileNameLength))); // file name
		z.extraField = S(i, p, (p += z.extraFieldLength)); // extra field
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
			i = input,
			u = opt,
			c = u.compressionType,
			R = RawDeflate,
			r = /** @type {Object} */ {};
		z.input = /** @type {!(Uint8Array)} */ i;
		z.output = /** @type {!(Uint8Array)} */ ZU.u8(Zlib.DefaultBufferSize);
		z.compressionType = /** @type {Deflate.CompressionType} */ R.CT.DYNAMIC;
		if (ZU.isN(c)) z.compressionType = c; // option parameters
		for (const p in u) r[p] = u[p]; // copy options
		r.outputBuffer = z.output; // set raw-deflate output buffer
		z.rawDeflate = /** @type {RawDeflate} */ new R(i, r);
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
			U = ZU,
			E = U.Err,
			Y = U.N,
			D = Z.CM.DEFLATE,
			m = D, // Compression Method and Flags
			t = z.compressionType,
			M = Math,
			i = m === D ? M.LOG2E * M.log(R.WS) - 8 : E('invalid compression method'),
			c = (i << 4) | m,
			F = 0, // Flags
			C = R.CT;
		o[p++] = c;
		const l =
			m !== D
				? E('invalid compression method')
				: t === C.NONE
				? 0
				: t === C.FIXED
				? 1
				: t === C.DYNAMIC
				? 2
				: E('unsupported compression type');
		let f = (l << 6) | (F << 5);
		const d = 31 - ((c * z2 + f) % 31),
			r = z.rawDeflate;
		f |= d;
		o[p++] = f;
		r.op = p;
		const a = Adler32.mkH(z.input), // Adler-32 checksum
			o2 = r.compress();
		let p2 = o2.length,
			o3 = U.u8(o2.buffer), // subarray 分を元にもどす
			n = o3.length;
		if (n <= p2 + 4) o3 = z.output = U.u8s(n + 4, o3); // expand buffer
		const o4 = ZU.s(o3, 0, p2 + 4);
		o4[p2++] = Y(a, 24); // adler32
		o4[p2++] = Y(a, 16);
		o4[p2++] = Y(a, 8);
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
			F = Gzip.FlagsMask,
			E = ZU.Err,
			C = CRC32.calc;
		/** @type {number} character code */
		let c,
			p = z.ip;
		m.id1 = i[p++];
		m.id2 = i[p++];
		if (m.id1 !== 31 || m.id2 !== 139) E(`invalid file signature:${m.id1},${m.id2}`); // check signature
		m.cm = i[p] !== 8 ? E(`unknown compression method: ${i[p]}`) : i[p++]; // check compression method
		m.flg = i[p++]; // flags
		const t = i[p++] | (i[p++] << 8) | (i[p++] << 16) | (i[p++] << 24); // modification time
		m.mtime = new Date(t * 1000);
		m.xfl = i[p++]; // extra flags
		m.os = i[p++]; // operating system
		if ((m.flg & F.FEXTRA) > 0) {
			m.xlen = i[p++] | (i[p++] << 8); // extra
			p = Gunzip.decodeSubField(p, m.xlen);
		}
		if ((m.flg & F.FNAME) > 0) {
			const s = []; // fname
			for (let j = 0; (c = i[p++]) > 0; j++) s[j] = String.fromCharCode(c);
			m.name = s.join('');
		}
		if ((m.flg & F.FCOMMENT) > 0) {
			const s = []; // fcomment
			for (let j = 0; (c = i[p++]) > 0; j++) s[j] = String.fromCharCode(c);
			m.comment = s.join('');
		}
		if ((m.flg & F.FHCRC) > 0) {
			m.crc16 = C(i, 0, p) & f4; // fhcrc
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
		const rIf = new RawInflate(i, {
				index: p,
				bufferSize: l - p - /* CRC-32 */ 4 - /* ISIZE */ 4 < x * 512 ? x : void 0, // inflate size
			}), // compressed block // RawInflate implementation.
			ifd = rIf.decompress(), // inflated data.
			iL = ifd.length,
			ic = C(ifd);
		m.data = ifd;
		let q = rIf.ip;
		const r = (i[q++] | (i[q++] << 8) | (i[q++] << 16) | (i[q++] << 24)) >>> 0; // crc32
		m.crc32 = r;
		if (ic !== r) E(`invalid CRC-32 checksum: 0x${ic.toString(16)} / 0x${r.toString(16)}`);
		const y = (i[q++] | (i[q++] << 8) | (i[q++] << 16) | (i[q++] << 24)) >>> 0; // input size
		m.isize = y;
		if ((iL & f8) !== y) E(`invalid input size: ${iL & f8} / ${y}`);
		z.member.push(m);
		z.ip = q;
	}
	/**
	 * サブフィールドのデコード
	 * XXX: 現在は何もせずスキップする
	 */
	static decodeSubField = (p, l) => p + l;
	/**
	 * @return {!(Uint8Array)}
	 */
	static concatMember(ms) {
		let p = 0,
			s = 0;
		for (const m of ms) s += m.data.length;
		const b = ZU.u8(s);
		for (const m of ms) {
			b.set(m.data, p);
			p += m.data.length;
		}
		return b;
	}
}
class GunzipMember {
	constructor() {
		const z = this,
			V = void 0;
		z.id1 = /** @type {number} signature first byte. */ V;
		z.id2 = /** @type {number} signature second byte. */ V;
		z.cm = /** @type {number} compression method. */ V;
		z.flg = /** @type {number} flags. */ V;
		z.mtime = /** @type {Date} modification time. */ V;
		z.xfl = /** @type {number} extra flags. */ V;
		z.os = /** @type {number} operating system number. */ V;
		z.crc16 = /** @type {number} CRC-16 value for FHCRC flag. */ V;
		z.xlen = /** @type {number} extra length. */ V;
		z.crc32 = /** @type {number} CRC-32 value for verification. */ V;
		z.isize = /** @type {number} input size modulo 32 value. */ V;
		z.name = /** @type {string} filename. */ V;
		z.comment = /** @type {string} comment. */ V;
		z.data = /** @type {!(Uint8Array|)} */ V;
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
			u = opt,
			V = void 0;
		z.input = /** @type {!(Uint8Array)} input buffer. */ input;
		z.ip = /** @type {number} input buffer pointer. */ 0;
		z.output = /** @type {!(Uint8Array)} output buffer. */ V;
		z.op = /** @type {number} output buffer. */ 0;
		z.flags = /** @type {!Object} flags option flags. */ {};
		z.filename = /** @type {!string} filename. */ V;
		z.comment = /** @type {!string} comment. */ V;
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
			U = ZU,
			Y = U.M,
			o = /** @type {!(Uint8Array)} output buffer. */ ZU.u8(Zlib.DefaultBufferSize),
			i = z.input,
			p = z.ip,
			n = z.filename,
			cmt = z.comment,
			M = G.FlagsMask,
			F = z.flags,
			d = z.deflateOptions;
		let q = /** @type {number} output buffer pointer. */ 0,
			f = 0; // flags
		o[q++] = 31; // check signature
		o[q++] = 139;
		o[q++] = 8; /* XXX: use Zlib const */ // check compression method
		if (F.fname) f |= M.FNAME;
		if (F.fcomment) f |= M.FCOMMENT;
		if (F.fhcrc) f |= M.FHCRC;
		// XXX: FTEXT
		// XXX: FEXTRA
		o[q++] = f;
		const t = (Date.now() / 1000) | 0; // modification time
		o[q++] = t & ff;
		o[q++] = Y(t, 8);
		o[q++] = Y(t, 16);
		o[q++] = Y(t, 24);
		o[q++] = 0; // extra flags
		o[q++] = G.OperatingSystem.UNKNOWN; // operating system
		// extra
		/* NOP */
		if (!U.U(F.fname)) {
			for (let j = 0, il = n.length; j < il; ++j) {
				const c = n.charCodeAt(j); // fname
				if (c > ff) o[q++] = Y(c, 8);
				o[q++] = c & ff;
			}
			o[q++] = 0; // null termination
		}
		if (F.comment) {
			for (let j = 0, il = cmt.length; j < il; ++j) {
				const c = cmt.charCodeAt(j); // fcomment
				if (c > ff) o[q++] = Y(c, 8);
				o[q++] = c & ff;
			}
			o[q++] = 0; // null termination
		}
		if (F.fhcrc) {
			const c = C(o, 0, q) & f4; // fhcrc CRC-16 value for FHCRC flag.
			o[q++] = c & ff;
			o[q++] = Y(c, 8);
		}
		d.outputBuffer = o; // add compress option
		d.outputIndex = q;
		const r = new RawDeflate(i, d); // compress//raw deflate object.
		let o2 = r.compress(),
			q2 = r.op;
		if (q2 + 8 > o2.buffer.byteLength) {
			z.output = U.u8s(q2 + 8, U.u8(o2.buffer)); // expand buffer
			o2 = z.output;
		} else o2 = U.u8(o2.buffer);
		const c = C(i); // crc32 CRC-32 value for verification.
		o2[q2++] = c & ff;
		o2[q2++] = Y(c, 8);
		o2[q2++] = Y(c, 16);
		o2[q2++] = Y(c, 24);
		const I = i.length; // input size
		o2[q2++] = I & ff;
		o2[q2++] = Y(I, 8);
		o2[q2++] = Y(I, 16);
		o2[q2++] = Y(I, 24);
		z.ip = p;
		return (z.output = q2 < o2.length ? ZU.s(o2, 0, q2) : o2);
	}
}
class InflateStream {
	/**
	 * @param {!(Uint8Array)} input deflated buffer.
	 * @constructor
	 */
	constructor(input = ZU.u8()) {
		const z = this,
			i = input,
			r = new RawInflateStream(i, 0);
		z.input = /** @type {!(Uint8Array)} */ i;
		z.ip = /** @type {number} */ 0;
		z.rawinflate = /** @type {RawInflateStream} */ r;
		z.method = /** @type {Zlib.CompressionMethod} */ void 0;
		z.output = /** @type {!(Uint8Array)} */ r.output;
	}
	/**
	 * decompress.
	 * @return {!(Uint8Array)} inflated buffer.
	 */
	decompress(input) {
		const z = this,
			i = input,
			j = z.input,
			f = z.rawinflate;
		// /** @type {number} adler-32 checksum */
		// var adler32;
		// 新しい入力を入力バッファに結合する
		// XXX Array, Uint8Array のチェックを行うか確認する
		if (!ZU.U(i)) {
			const l = j.length,
				t = ZU.u8s(l + i.length, j);
			t.set(i, l);
			z.input = t;
		}
		if (ZU.U(z.method) && !z.readHeader()) return ZU.u8();
		const k = z.input,
			b = /** @type {!(Uint8Array)} inflated buffer. */ f.decompress(k, z.ip),
			r = f.ip;
		if (r !== 0) {
			z.input = ZU.s(k, r);
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
			i = z.input,
			c = i[p++], // Compression Method and Flags
			f = i[p++],
			U = ZU.U;
		if (U(c) || U(f)) return 0;
		z.method = Inflate.getMethod(c, f);
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
		z.method = Inflate.getMethod(
			/** @type {number} Compression Method and Flags*/ i[z.ip++],
			/** @type {number} flg */ i[z.ip++]
		);
		z.rawinflate = /** @type {RawInflate} */ new RawInflate(i, {
			index: z.ip, // RawInflate
			bufferSize: u.bufferSize,
			bufferType: u.bufferType,
			resize: u.resize,
		});
	}
	static getMethod(c, f) {
		const D = Zlib.CM.DEFLATE,
			E = ZU.Err,
			m = (c & 15) === D ? D : E('unsupported compression method');
		if (((c << 8) + f) % 31 !== 0) E(`invalid fcheck flag:${((c << 8) + f) % 31}`); // fcheck
		if (f & 32) E('fdict flag is not supported'); // fdict (not supported)
		return m;
	}
	/**
	 * decompress.
	 * @return {!(Uint8Array)} inflated buffer.
	 */
	decompress() {
		const z = this,
			A = Adler32.mkH,
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
			B = RawInflate.BT,
			u = opt,
			U = ZU.u8,
			V = void 0;
		z.buffer = /** @type {!(Uint8Array)} inflated buffer */ V;
		z.blocks = /** @type {!Array.<(Uint8Array)>} */ [];
		z.bufferSize = /** @type {number} block size. */ Z.ZLIB_RAW_INFLATE_BUFFER_SIZE;
		z.totalpos = /** @type {!number} total output buffer pointer. */ 0;
		z.ip = /** @type {!number} input buffer pointer. */ 0;
		z.bitsbuf = /** @type {!number} bit stream reader buffer. */ 0;
		z.bitsbuflen = /** @type {!number} bit stream reader buffer size. */ 0;
		z.input = /** @type {!(Uint8Array)} input buffer. */ U(input);
		z.output = /** @type {!(Uint8Array.<number>)} output buffer. */ V;
		z.op = /** @type {!number} output buffer pointer. */ V;
		z.bfinal = /** @type {boolean} is final block flag. */ false;
		z.bufferType = /** @type {RawInflate.BufferType} buffer management. */ B.ADAPTIVE;
		z.resize = /** @type {boolean} resize flag for memory size optimization. */ false;
		if (u.index) z.ip = u.index;
		if (u.bufferSize) z.bufferSize = u.bufferSize;
		if (u.bufferType) z.bufferType = u.bufferType;
		if (u.resize) z.resize = u.resize;
		const t = z.bufferType;
		if (t === B.BLOCK) {
			z.op = Z.MaxBackwardLength;
			z.output = U(z.op + z.bufferSize + Z.MaxCopyLength);
		} else if (t === B.ADAPTIVE) {
			z.op = 0;
			z.output = U(z.bufferSize);
		} else ZU.Err('invalid inflate mode');
	}
	/**
	 * decompress.
	 * @return {!(Uint8Array.<number>)} inflated buffer.
	 */
	decompress() {
		const z = this,
			B = RawInflate.BT;
		while (!z.bfinal) z.parseBlock();
		return z.bufferType === B.BLOCK
			? z.concatBufferBlock()
			: B.ADAPTIVE
			? z.concatBufferDynamic()
			: ZU.Err('invalid inflate mode');
	}
	/**
	 * parse deflated block.
	 */
	parseBlock() {
		const z = this;
		let h = Zlib.rB(3, z);
		if (h & 1) z.bfinal = T; // BFINAL
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
			I = i.length,
			O = z.output.length, //output buffer length
			t = z.bufferType,
			R = RawInflate,
			B = R.BT,
			E = ZU.Err,
			S = ZU.s;
		let p = z.ip,
			o = z.output,
			q = z.op;
		z.bitsbuf = 0; // skip buffered header bits
		z.bitsbuflen = 0;
		if (p + 1 >= I) E('invalid uncompressed block header: LEN');
		let l = i[p++] | (i[p++] << 8); // len block length
		if (p + 1 >= I) E('invalid uncompressed block header: NLEN');
		const n = i[p++] | (i[p++] << 8); // nlen number for check block length
		if (l === ~n) E('invalid uncompressed block header: length verify'); // check len & nlen
		if (p + l > I) E('input buffer is broken'); // check size
		if (t === B.BLOCK) {
			while (q + l > o.length) {
				const c = O - q; //copy counter
				l -= c;
				o.set(S(i, p, p + c), q);
				q += c;
				p += c;
				z.op = q;
				o = R.expandBufferBlock(z); // expand buffer
				q = z.op;
			}
		} else if (t === B.ADAPTIVE)
			while (q + l > o.length) o = R.expandBufferAdaptive(z, z.currentLitlenTable, { fixRatio: 2 });
		else E('invalid inflate mode');
		o.set(S(i, p, p + l), q); // copy
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
	static a = (t, z, a, b) =>
		t === RawInflate.BT.ADAPTIVE
			? z.decodeHuffmanAdaptive(a, b)
			: t === RawInflate.BT.BLOCK
			? z.decodeHuffmanBlock(a, b)
			: ZU.Err('invalid inflate mode');
	/**
	 * parse dynamic huffman block.
	 */
	parseDynamicHuffmanBlock() {
		const z = this,
			Z = Zlib,
			B = Z.rB,
			R = RawInflate,
			t = z.bufferType,
			hlit = /** @type {number} number of literal and length codes. */ B(5, z) + 257,
			hdist = /** @type {number} number of distance codes. */ B(5, z) + 1,
			hclen = /** @type {number} number of code lengths. */ B(4, z) + 4,
			cLens = /** @type {!(Uint8Array.<number>)} code lengths. */ ZU.u8(Z.Order.length);
		const [a, b] = R.pDHBI(z, hlit, hdist, hclen, cLens);
		return R.a(t, z, a, b);
	}
	static pDHBI(z, hlit, hdist, hclen, cLens) {
		const h = hlit + hdist,
			Z = Zlib,
			B = Z.rB,
			H = Huffman.bT,
			E = ZU.Err,
			S = ZU.s;
		let p = /** @type {number} */ 0;
		for (let i = 0; i < hclen; ++i) {
			const b = B(3, z); // decode code lengths
			if (b < 0) E('not enough input');
			cLens[Z.Order[i]] = b;
		}
		const D = /** @type {!Array} code lengths table. */ H(cLens), // decode length table
			C = /** @type {!(Uint8Array.<number>)} code length table. */ ZU.u8(h);
		for (let i = 0; i < h; ) {
			let b = /** @type {number} */ 0;
			const c = Z.readCodeByTable(D, z);
			if (c < 0) E('not enough input');
			let t;
			if (c === 16) {
				if ((b = B(2, z)) < 0) E('not enough input');
				t = 3 + b;
				while (t--) C[i++] = p;
			} else if (c === 17) {
				if ((b = B(3, z)) < 0) E('not enough input');
				t = 3 + b;
				while (t--) C[i++] = 0;
				p = 0;
			} else if (c === 18) {
				if ((b = B(7, z)) < 0) E('not enough input');
				t = 11 + b;
				while (t--) C[i++] = 0;
				p = 0;
			} else {
				C[i++] = c;
				p = c;
			}
		}
		return [H(S(C, 0, hlit)), H(S(C, hlit))];
	}
	/**
	 * decode huffman code
	 * @param {!(Uint16Array)} litlen literal and length code table.
	 * @param {!(Uint8Array)} dist distination code table.
	 */
	decodeHuffmanBlock(litlen, dist) {
		const z = this,
			Z = Zlib,
			eB = RawInflate.expandBufferBlock,
			rC = Z.readCodeByTable,
			oL = z.output.length - Z.MaxCopyLength, //output position limit.
			lC = Z.LCT,
			lE = Z.LET,
			dC = Z.DCT,
			dE = Z.DET,
			l = litlen;
		let o = z.output,
			q = z.op,
			c; //huffman code.
		z.currentLitlenTable = l;
		while ((c = rC(l, z)) !== z2) {
			if (c === 0) return;
			if (c < z2) {
				if (q >= oL) {
					z.op = q; // literal
					o = eB(z);
					q = z.op;
				}
				o[q++] = c;
				continue;
			}
			const ti = c - 257; // length code
			let cL = lC[ti]; //huffman code length.
			if (lE[ti] > 0) cL += Z.rB(lE[ti], z);
			const d = rC(dist, z); // dist code
			let s = dC[d]; //huffman code distination.
			if (dE[d] > 0) s += Z.rB(dE[d], z);
			if (q >= oL) {
				z.op = q; // lz77 decode
				o = eB(z);
				q = z.op;
			}
			while (cL--) o[q] = o[q++ - s];
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
			rC = Z.readCodeByTable,
			eB = RawInflate.expandBufferAdaptive,
			lC = Z.LCT,
			lE = Z.LET,
			dC = Z.DCT,
			dE = Z.DET,
			L = litlen;
		let o = z.output,
			q = z.op,
			r = o.length, //output position limit.
			c; //huffman code.
		z.currentLitlenTable = L;
		while ((c = rC(L, z)) !== z2) {
			if (c < z2) {
				if (q >= r) {
					o = eB(z, L); // literal
					r = o.length;
				}
				o[q++] = c;
				continue;
			}
			const t = c - 257; // length code
			let l = lC[t]; //huffman code length.
			if (lE[t] > 0) l += Z.rB(lE[t], z);
			const d = rC(dist, z); // dist code
			let s = dC[d]; //huffman code distination.
			if (dE[d] > 0) s += Z.rB(dE[d], z);
			if (q + l > r) {
				o = eB(z, L); // lz77 decode
				r = o.length;
			}
			while (l--) o[q] = o[q++ - s];
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
	static expandBufferBlock(z) {
		const M = Zlib.MaxBackwardLength,
			S = ZU.s,
			m = z.op - M, //backward base point
			o = z.output,
			b = ZU.u8s(m, S(o, M, m)); //store buffer.// copy to output buffer
		z.blocks.push(b);
		z.totalpos += b.length;
		o.set(S(o, m, m + M)); // copy to backward buffer
		z.op = M;
		return o;
	}
	/**
	 * expand output buffer. (adaptive)
	 * @param {Object=} opt option parameters.
	 * @return {!(Uint8Array)} output buffer pointer.
	 */
	static expandBufferAdaptive(z, currentLitlenTable, opt = {}) {
		const i = z.input,
			L = i.length,
			o = z.output,
			O = o.length,
			u = opt,
			N = ZU.isN,
			M = MAX_FIREFOX_SIZE;
		let r = (L / z.ip + 1) | 0, //expantion ratio.
			n; //new output buffer size.
		if (O === M) ZU.Err('TOO LOG LENGTH OF BUFFER ADAPTIVE!');
		if (u) {
			if (N(u.fixRatio)) r = u.fixRatio;
			if (N(u.addRatio)) r += u.addRatio;
		}
		if (r < 2) {
			const mHC = (L - z.ip) / currentLitlenTable[2], // calculate new buffer size //maximum number of huffman code.
				mIS = ((mHC / 2) * fi) | 0; //max inflate size.
			n = mIS < O ? O + mIS : O << 1;
		} else n = O * r;
		return (z.output = ZU.u8s(M > n ? n : M, o)); // buffer expantion //store buffer.
	}
	/**
	 * concat output buffer.
	 * @return {!(Uint8Array)} output buffer.
	 */
	concatBufferBlock() {
		let p = 0; //buffer pointer.
		const z = this,
			q = z.op,
			M = Zlib.MaxBackwardLength,
			lmt = z.totalpos + (q - M), //buffer pointer.
			o = z.output, //output block array.
			k = z.blocks, //blocks array.
			b = ZU.u8(lmt); //output buffer.
		if (k.length === 0) return ZU.s(o, M, q); // single buffer
		for (const b of k) for (let j = 0, jl = b.length; j < jl; ++j) b[p++] = b[j]; // copy to buffer
		for (let i = M; i < q; ++i) b[p++] = o[i]; // current buffer
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
			s = ZU.s(z.output, 0, q);
		return (z.buffer = z.resize ? ZU.u8s(q, s) : s); //output buffer.
	}
}
class RawInflateStream {
	/**
	 * @param {!(Uint8Array.<number>)} input input buffer.
	 * @param {number} ip input buffer pointer.decompress
	 * @param {number=} opt_buffersize buffer block size. ZLIB_STREAM_RAW_INFLATE_BUFFER_SIZE = z83;
	 * @constructor
	 */
	constructor(input, ip = 0, opt_buffersize = z83) {
		const z = this,
			U = ZU.u8,
			R = RawInflateStream,
			V = void 0;
		z.blocks = /** @type {!Array.<(Uint8Array)>} */ [];
		z.bufferSize = /** @type {number} block size. */ opt_buffersize;
		z.totalpos = /** @type {!number} total output buffer pointer. */ 0;
		z.ip = /** @type {!number} input buffer pointer. */ ip;
		z.bitsbuf = /** @type {!number} bit stream reader buffer. */ 0;
		z.bitsbuflen = /** @type {!number} bit stream reader buffer size. */ 0;
		z.input = /** @type {!(Uint8Array)} input buffer. */ U(input);
		z.output = /** @type {!(Uint8Array)} output buffer. */ U(z.bufferSize);
		z.op = /** @type {!number} output buffer pointer. */ 0;
		z.bfinal = /** @type {boolean} is final block flag. */ false;
		z.blockLength = /** @type {number} uncompressed block length. */ 0;
		z.resize = /** @type {boolean} resize flag for memory size optimization. */ false;
		z.litlenTable = /** @type {Array} */ V;
		z.distTable = /** @type {Array} */ V;
		z.sp = /** @type {number} */ 0; // stream pointer
		z.status = /** @type {RawInflateStream.Status} */ R.Status.INITIALIZED;
		//backup  //
		z.ip_ = /** @type {!number} */ V;
		z.bitsbuflen_ = /** @type {!number} */ V;
		z.bitsbuf_ = /** @type {!number} */ V;
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
			B = R.BlockType,
			i = newInput;
		let s = /** @type {boolean} */ false; //stop
		if (!ZU.U(i)) z.input = i;
		if (!ZU.U(ip)) z.ip = ip;
		while (!s)
			switch (z.status) {
				case S.INITIALIZED: // block header// decompress
				case S.BLOCK_HEADER_START:
					s = z.readBlockHeader();
					break;
				case S.BLOCK_HEADER_END: /* FALLTHROUGH */ // block body
				case S.BLOCK_BODY_START:
					switch (z.currentBT) {
						case B.UNCOMPRESSED:
							s = z.readUncompressedBlockHeader();
							break;
						case B.FIXED:
							s = z.parseFixedHuffmanBlock();
							break;
						case B.DYNAMIC:
							s = z.parseDynamicHuffmanBlock();
							break;
					}
					break;
				case S.BLOCK_BODY_END: // decode data
				case S.DECODE_BLOCK_START:
					switch (z.currentBT) {
						case B.UNCOMPRESSED:
							s = z.parseUncompressedBlock();
							break;
						case B.FIXED: /* FALLTHROUGH */
						case B.DYNAMIC:
							s = z.decodeHuffman();
							break;
					}
					break;
				case S.DECODE_BLOCK_END:
					if (z.bfinal) s = T;
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
			B = R.BlockType;
		let h = /** @type {number} header */ Zlib.rB(3, z);
		z.status = S.BLOCK_HEADER_START;
		z.sv();
		if (h < 0) return z.rstr();
		if (h & 0x1) z.bfinal = T; // BFINAL
		h >>>= 1; // BTYPE
		z.currentBT = h === 0 ? B.UNCOMPRESSED : h === 1 ? B.FIXED : h == 2 ? B.DYNAMIC : ZU.Err(`unknown BTYPE: ${h}`);
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
		if (p + 4 >= i.length) return T;
		const l = /** @type {number} block length */ i[p++] | (i[p++] << 8),
			n = /** @type {number} number for check block length */ i[p++] | (i[p++] << 8);
		if (l === ~n) ZU.Err('invalid uncompressed block header: length verify'); // check len & nlen
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
			if (q === o.length) o = RawInflate.expandBufferAdaptive(z, z.litlenTable, { fixRatio: 2 });
			if (p >= i.length) {
				z.ip = p; // not enough input buffer
				z.op = q;
				z.blockLength = l + 1; // コピーしてないので戻す
				return T;
			}
			o[q++] = i[p++];
		}
		if (l < 0) z.status = S.DECODE_BLOCK_END;
		z.ip = p;
		z.op = q;
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
	}
	/**
	 * オブジェクトのコンテキストを別のプロパティに退避する.
	 * @private
	 */
	sv() {
		const z = this;
		z.ip_ = z.ip;
		z.bitsbuflen_ = z.bitsbuflen;
		z.bitsbuf_ = z.bitsbuf;
	}
	/**
	 * 別のプロパティに退避したコンテキストを復元する.
	 * @private
	 */
	rstr(q) {
		const z = this;
		if (!ZU.U(q)) z.op = q;
		z.ip = z.ip_;
		z.bitsbuflen = z.bitsbuflen_;
		z.bitsbuf = z.bitsbuf_;
		return T;
	}
	/**
	 * parse dynamic huffman block.
	 */
	parseDynamicHuffmanBlock() {
		const z = this,
			Z = Zlib,
			B = Z.rB,
			R = RawInflate,
			S = RawInflateStream.Status,
			c = /** @type {!(Uint8Array)} code lengths. */ ZU.u8(Z.Order.length);
		z.status = S.BLOCK_BODY_START;
		z.sv();
		const hlit = /** @type {number} number of literal and length codes. */ B(5, z) + 257,
			hdist = /** @type {number} number of distance codes. */ B(5, z) + 1,
			hclen = /** @type {number} number of code lengths. */ B(4, z) + 4;
		if (hlit < 0 || hdist < 0 || hclen < 0) return z.rstr();
		try {
			const [a, b] = R.pDHBI(z, hlit, hdist, hclen, c);
			// litlenLengths = ZU.u8(hlit); // literal and length code
			// distLengths = ZU.u8(hdist); // distance code
			z.litlenTable = a;
			z.distTable = b;
		} catch (e) {
			return z.rstr();
		}
		z.status = S.BLOCK_BODY_END;
	}
	/**
	 * decode huffman code (dynamic)
	 * @return {(number|undefined)} -1 is error.
	 */
	decodeHuffman() {
		const z = this,
			L = z.litlenTable,
			D = z.distTable,
			R = RawInflate,
			S = RawInflateStream.Status,
			Z = Zlib,
			rC = Z.readCodeByTable,
			eB = R.expandBufferAdaptive;
		let o = z.output,
			q = z.op,
			l = o.length;
		z.status = S.DECODE_BLOCK_START;
		while (o) {
			z.sv();
			const c = /** @type {number} huffman code. */ rC(L, z);
			if (c < 0) return z.rstr(q);
			if (c === z2) break;
			if (c < z2) {
				if (q === l) {
					o = eB(z, L); // literal
					l = o.length;
				}
				o[q++] = c;
				continue;
			}
			const t = /** @type {number} table index. */ c - 257; // length code
			let d = /** @type {number} huffman code length. */ Z.LCT[t];
			if (Z.LET[t] > 0) {
				const b = Z.rB(Z.LET[t], z);
				if (b < 0) return z.rstr(q);
				d += b;
			}
			const dc = rC(D, z); // dist code
			if (dc < 0) return z.rstr(q);
			let e = /** @type {number} huffman code distination. */ Z.DCT[dc];
			if (Z.DET[dc] > 0) {
				const b = Z.rB(Z.DET[dc], z);
				if (b < 0) return z.rstr(q);
				e += b;
			}
			if (q + d >= l) {
				o = eB(z, L); /// lz77 decode
				l = o.length;
			}
			while (d--) o[q] = o[q++ - e];
			if (z.ip === z.input.length) {
				z.op = q; // break
				return T;
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
	 * concat output buffer. (dynamic)
	 * @return {!(Uint8Array)} output buffer.
	 */
	concatBuf() {
		const z = this,
			q = /** @type {number} */ z.op,
			t = /** @type {Uint8Array} */ z.output,
			p = ZU.s(t, z.sp, q),
			M = Zlib.MaxBackwardLength,
			s = z.bufferSize + M;
		z.sp = q;
		if (q > s) {
			z.op = z.sp = M; // compaction
			z.output = ZU.u8s(s, ZU.s(t, q - M, q));
		}
		return /** @type {!(Uint8Array)} output buffer. */ z.resize ? ZU.u8(p) : p;
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
			i = input,
			V = void 0;
		z.input = /** @type {!(Uint8Array)} */ ZU.isAI(i) ? ZU.u8(i) : i;
		z.ip = /** @type {number} */ 0;
		z.eocdrOffset = /** @type {number} */ 0;
		z.numberOfThisDisk = /** @type {number} */ 0;
		z.startDisk = /** @type {number} */ 0;
		z.totalEntriesThisDisk = /** @type {number} */ 0;
		z.totalEntries = /** @type {number} */ 0;
		z.centralDirectorySize = /** @type {number} */ 0;
		z.centralDirectoryOffset = /** @type {number} */ V;
		z.commentLength = /** @type {number} */ 0;
		z.comment = /** @type {(Uint8Array)} */ V;
		z.fileHeaderList = /** @type {Array.<Zlib.Unzip.FileHeader>} */ V;
		z.filenameToIndex = /** @type {Object.<string, number>} */ V;
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
		z.comment = ZU.s(i, p, p + z.commentLength); // .ZIP file comment
		return z.centralDirectoryOffset;
	}
	parseFileHeader(isRetT) {
		const z = this,
			c = z.fileHeaderList,
			t = z.filenameToIndex;
		if (c) return isRetT ? t : c;
		const L = [],
			F = {},
			v = z.parseEndOfCentralDirectoryRecord(),
			E = z.totalEntries;
		let p = v;
		for (let i = 0; i < E; ++i) {
			const H = new FileHeader(z.input, p);
			p += H.length;
			L[i] = H;
			F[H.filename] = i;
		}
		if (z.centralDirectorySize < p - v) ZU.Err('invalid file header size');
		z.fileHeaderList = L;
		z.filenameToIndex = F;
		return isRetT ? F : L;
	}
	/**
	 * @param {number} index file header index.
	 * @param {Object=} opt
	 * @return {!(Uint8Array)} file data.
	 */
	getFileData(index, opt = {}) {
		const z = this,
			i = z.input,
			x = index,
			L = z.fileHeaderList,
			U = Zip,
			D = U.decode,
			E = ZU.Err;
		if (!L) z.parseFileHeader();
		if (ZU.U(L[x])) E('wrong index');
		let p = L[x].relativeOffset;
		const H = new LocalFileHeader(i, p),
			c = H.compression,
			w = opt.password || z.password;
		p += H.length;
		let l = H.compressedSize;
		if ((H.flags & U.Flags.ENCRYPT) !== 0) {
			if (!w) E('please set password'); // decryption
			const k = U.createEncryptionKey(w);
			for (let j = p, il = p + 12; j < il; ++j) D(k, i[j]); // encryption header
			p += 12;
			l -= 12;
			for (let j = p, il = p + l; j < il; ++j) i[j] = D(k, i[j]); // decryption
		}
		const C = Zlib.CM,
			d = {
				index: p,
				bufferSize: H.plainSize,
			},
			b =
				c === C.STORE
					? ZU.s(i, p, p + l)
					: c === C.DEFLATE
					? new RawInflate(i, d).decompress()
					: E('unknown compression type');
		if (z.verify) {
			const cr = CRC32.calc(b);
			if (H.crc32 !== cr) E(`wrong crc: file=0x${H.crc32.toString(16)}, data=0x${cr.toString(16)}`);
		}
		return b;
	}
	/**
	 * @return {Array.<string>}
	 */
	getFilenames() {
		const N = [],
			H = this.parseFileHeader(),
			l = H.length;
		for (let i = 0; i < l; ++i) N[i] = H[i].filename;
		return N;
	}
	/**
	 * @param {string} filename extract filename.
	 * @param {Object=} opt
	 * @return {!(Uint8Array)} decompressed data.
	 */
	decompress(filename, opt) {
		const z = this,
			n = filename,
			t = z.parseFileHeader(T);
		return t[n] >= 0 ? z.getFileData(t[n], opt) : ZU.Err(`${n} not found`);
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
