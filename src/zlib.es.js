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
	 * Byte String から Byte Array に変換.stringToByteArray
	 * @param {!string} s byte string.
	 * @return {!Array.<number>} byte array.
	 */
	static b2B(s) {
		const t = /** @type {!Array.<(string|number)>} */ s.split('');
		for (let i = 0; i < t.length; i++) t[i] = (t[i].charCodeAt(0) & ff) >>> 0;
		return t;
	}
	static E = (m) => {
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
	 * @param {!(Uint8Array)} a length list.
	 * @return {!Array} huffman table.
	 */
	static b(a) {
		const l = /** @type {number} length list size. */ a.length;
		let x = /** @type {number} max code length for table size. */ 0,
			i = /** @type {number} min code length for table size. */ Infinity;
		for (const v of a) {
			if (v > x) x = v; // Math.max は遅いので最長の値は for-loop で取得する
			if (v < i) i = v;
		}
		const S = 1 << x, //table size.
			t = ZU.u32(S); //huffman code table.
		// ビット長の短い順からハフマン符号を割り当てる
		for (let b = 1, c = 0, s = 2; b <= x; ) {
			for (let j = 0; j < l; ++j)
				if (a[j] === b) {
					let x = 0; //reversed code.// ビットオーダーが逆になるためビット長分並びを反転する
					for (let y = c, k = 0; k < b; ++k) {
						x = (x << 1) | (y & 1);
						y >>= 1; //reverse temp.
					}
					// 最大ビット長をもとにテーブルを作るため、
					// 最大ビット長以外では 0 / 1 どちらでも良い箇所ができる
					// そのどちらでも良い場所は同じ値で埋めることで
					// 本来のビット長以上のビット数取得しても問題が起こらないようにする
					const v = (b << 16) | j;
					for (let k = x; k < S; k += s) t[k] = v;
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
	 * DefaultBufferSize
	 * @const
	 * @type {number} デフォルトバッファサイズ.
	 */
	static DBS = z83;
	/**
	 * CompressionMethod
	 * @enum {number}
	 */
	static CM = {
		STORE: 0,
		DEFLATE: 8,
		RESERVED: 15,
	};
	static CompressionMethod = Zlib.CM;
	//CompressionType
	static CT = {
		NONE: 0,
		UNCOMPRESSED: 0,
		FIXED: 1,
		DYNAMIC: 2,
		RESERVED: 3,
	};
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
	 * huffman length code table.LengthCodeTable
	 * @const
	 * @type {!(Uint16Array)}
	 */
	static LCT = ZU.u16([
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
	/**
	 * huffman length extra-bits table.LengthExtraTable
	 * @const
	 * @type {!(Uint8Array)}
	 */
	static LET = ZU.u8([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0]);
	/**
	 * huffman dist code table.DistCodeTable
	 * @const
	 * @type {!(Uint16Array)}
	 */
	static DCT = ZU.u16([
		1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097,
		6145, 8193, 12289, 16385, 24577,
	]);
	/**
	 * huffman dist extra-bits table.DistExtraTable
	 * @const
	 * @type {!(Uint8Array)}
	 */
	static DET = ZU.u8([
		0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
	]);
	/**
	 * fixed huffman length code table.FixedLiteralLengthTable
	 * @const
	 * @type {!Array}
	 */
	static FLLT = (() => {
		const m = ZU.u8(288);
		for (let i = 0; i < 288; ++i) m[i] = i <= 143 ? 8 : i <= ff ? 9 : i <= 279 ? 7 : 8;
		return Huffman.b(m);
	})();
	/**
	 * fixed huffman distance code table FixedDistanceTable
	 * @const
	 * @type {!Array}
	 */
	static FDT = (() => {
		const m = ZU.u8(30);
		m.fill(5);
		return Huffman.b(m);
	})();
	/**
	 * read huffman code using table readCodeByTable
	 * @param {!(Uint8Array|Uint16Array)} t huffman code table.
	 * @param {!(obj)} z a this
	 * @return {number} huffman code.
	 */
	static rCBT(t, z) {
		const C = /** @type {!(Uint8Array)} huffman code table */ t[0],
			X = t[1],
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
		if (c > l) ZU.E(`invalid code length: ${c}`);
		z.bitsbuf = b >> c;
		z.bitsbuflen = l - c;
		z.ip = p;
		return M & f4;
	}
	/**
	 * read inflate bits
	 * @param {number} la bits length.length
	 * @param {!(obj)} z a this
	 * @param {boolean=} isThrowErr 例外を投げるならば true.
	 * @return {number} read bits.
	 */
	static r(la, z, isThrowErr = false) {
		const i = z.input,
			I = i.length;
		let b = z.bitsbuf,
			l = z.bitsbuflen,
			p = z.ip;
		if (isThrowErr && p + ((la - l + 7) >> 3) >= I) ZU.E('input buffer is broken'); // input byte
		while (l < la) {
			if (I <= p) return -1; // not enough buffer
			b |= i[p++] << l; // not enough buffer
			l += 8;
		}
		z.bitsbuf = b >>> la;
		z.bitsbuflen = l - la;
		z.ip = p;
		return b & /* MASK */ ((1 << la) - 1); //input and output byte.// output byte
	}
	static rBt = (l, z) => Zlib.B(l, z, T);

	/** @define {number} buffer block size. */
	static ZLIB_RAW_INFLATE_BUFFER_SIZE = z83; // [ 0x8000 >= ZLIB_BUFFER_BLOCK_SIZE ]
}
/**FileHeader */
class FH {
	/**
	 * @param {!(Uint8Array)} i input buffer.input
	 * @param {number} ip input position.
	 * @constructor
	 */
	constructor(i, ip) {
		const z = this,
			F = Zip.FHS,
			S = ZU.s;
		z.input = /** @type {!(Uint8Array)} */ i;
		z.offset = /** @type {number} */ ip;
		let p = z.offset;
		if (i[p++] !== F[0] || i[p++] !== F[1] || i[p++] !== F[2] || i[p++] !== F[3])
			ZU.E('invalid file header signature'); // central file header signature
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
	static H = (a) => Adler32.u(1, typeof a === 'string' ? ZU.b2B(a) : a);
	/**
	 * Adler32 ハッシュ値の更新 update
	 * @param {number} h 現在のハッシュ値.adler
	 * @param {!(Uint8Array)} a 更新に使用する byte array.
	 * @return {number} Adler32 ハッシュ値.
	 */
	static u(h, a) {
		const o = Adler32.OP;
		let x = /** @type {number} */ h & f4,
			y = /** @type {number} */ (h >>> 16) & f4,
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
	 * OptimizationParameter
	 * Adler32 最適化パラメータ
	 * 現状では 1024 程度が最適.
	 * @see http://jsperf.com/adler-32-simple-vs-optimized/3
	 * @define {number}
	 */
	static OP = 1024;
}

/**
 * @fileoverview bit 単位での書き込み実装.
 */
/**
 * ビットストリーム
 * @constructor
 * @param {!(Uint8Array)=} buffer output buffer.
 * @param {number=} bufferPosition start buffer pointer.bufferPosition
 */
class BS {
	/**
	 * デフォルトブロックサイズ.DefaultBlockSize
	 * @const
	 * @param {!(Uint8Array)=} b output buffer.
	 * @param {number=} p start buffer pointer.bufferPosition
	 * @type {number}
	 */
	static DBS = z83;
	constructor(b, p) {
		const z = this,
			i = /** @type {number} buffer index. */ ZU.isN(p) ? p : 0,
			u = b instanceof Uint8Array ? b : ZU.u8(BS.DBS),
			l = u.length;
		z.i = i;
		z.c = /** @type {number} bit index. */ 0;
		/** @type {!(Uint8Array)} bit-stream output buffer. */
		z.b = u;
		// 入力された index が足りなかったら拡張するが、倍にしてもダメなら不正とする
		if (l * 2 <= i) ZU.E('invalid index');
		else if (l <= i) BS.e(z);
	}
	/**
	 * expand buffer.
	 * @return {!(Uint8Array)} new buffer.
	 */
	static e = (z) => (z.b = ZU.u8s(z.b.length << 1, z.b));
	/**
	 * 数値をビットで指定した数だけ書き込む.
	 * @param {number} no 書き込む数値.
	 * @param {number} n 書き込むビット数.
	 * @param {boolean=} isR 逆順に書き込むならば true.
	 */
	w(no, n, isR) {
		const z = this,
			T = BS.R,
			N = no;
		let b = z.b,
			j = z.i,
			i = z.c,
			c = /** @type {number} current octet. */ b[j];
		if (isR && n > 1) no = n > 8 ? BS.r(N, T) >> (32 - n) : T[N] >> (8 - n);
		if (n + i < 8) {
			c = (c << n) | no; // Byte 境界を超えないとき
			i += n;
		} else
			for (let k = 0; k < n; ++k) {
				c = (c << 1) | ((no >> (n - k - 1)) & 1); // Byte 境界を超えるとき
				if (++i === 8) {
					i = 0; // next byte
					b[j++] = T[c];
					c = 0;
					if (j === b.length) b = BS.e(z); // expand
				}
			}
		b[j] = c;
		z.b = b;
		z.c = i;
		z.i = j;
	}
	/**
	 * 32-bit 整数のビット順を逆にする rev32_
	 * @param {number} n 32-bit integer.
	 * @return {number} reversed 32-bit integer.
	 * @private
	 */
	static r = (n, T) => (T[n & ff] << 24) | (T[ZU.M(n, 8)] << 16) | (T[ZU.M(n, 16)] << 8) | T[ZU.M(n, 24)];

	/**
	 * ストリームの終端処理を行う finish
	 * @return {!(Uint8Array)} 終端処理後のバッファを byte array で返す.
	 */
	f() {
		const b = this.b,
			x = this.c;
		let i = this.i;
		if (x > 0) {
			b[i] <<= 8 - x; // bitindex が 0 の時は余分に index が進んでいる状態
			b[i] = BS.R[b[i]];
			i++;
		}
		return ZU.s(b, 0, i); // array truncation;
	}
	//buildReverseTable
	static b() {
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
	static R = (() => BS.b())();
}
/**
 * @fileoverview CRC32 実装.
 */
class CRC32 {
	/**
	 * CRC32 ハッシュ値を取得 calc
	 * @param {!(Uint8Array)} d data byte array.
	 * @param {number=} p data position.
	 * @param {number=} l data length.
	 * @return {number} CRC32.
	 */
	static c = (d, p, l) => CRC32.u(d, 0, p, l);
	/**
	 * CRC32ハッシュ値を更新 update
	 * @param {!(Uint8Array)} d data byte array.
	 * @param {number} c CRC32.
	 * @param {number=} p data position.
	 * @param {number=} l data length.
	 * @return {number} CRC32.
	 */
	static u(d, c, p, l) {
		const S = CRC32.C,
			N = ZU.isN,
			L = N(l) ? l : d.length;
		let i = N(p) ? p : (p = 0);
		c ^= f8;
		for (i = L & 7; i--; ++p) c = S(c, d[p]); // (crc >>> 8) ^ t[(crc ^ d[pos]) & ff]; // loop unrolling for performance
		for (i = L >> 3; i--; p += 8) for (let j = 0; j < 8; j++) c = S(c, d[p + j]);
		return (c ^ f8) >>> 0;
	}
	static C = (c, a) => (c >>> 8) ^ CRC32.T[(c ^ a) & ff];
	/**
	 * single
	 * @param {number} n number
	 * @param {number} c crc
	 * @returns {number}
	 */
	static s = (n, c) => (CRC32.T[(n ^ c) & ff] ^ (n >>> 8)) >>> 0;
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
	 * @param {number} l ヒープサイズ.length
	 * @constructor
	 */
	constructor(l) {
		this.b = ZU.u16(l * 2);
		this.l = 0;
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
			h = z.b; // ルートノードにたどり着くまで入れ替えを試みる
		let c = z.l;
		h[z.l++] = v;
		h[z.l++] = i;
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
		return z.l;
	}
	/**
	 * Heapから一番大きい値を返す
	 * @return {{index: number, value: number, length: number}} {index: キーindex,
	 *     value: 値, length: ヒープ長} の Object.
	 */
	pop() {
		const z = this,
			h = z.b,
			v = h[0],
			i = h[1];
		z.l -= 2; // 後ろから値を取る
		const l = z.l;
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
	/**
	 * LZ77 の最小マッチ長 Lz77MinLength
	 * @const
	 * @type {number}
	 */
	static i = 3;
	/**
	 * LZ77 の最大マッチ長 Lz77MaxLength
	 * @const
	 * @type {number}
	 */
	static x = fi;
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
	 * ハフマン符号の最大数値 HUFMAX
	 * @const
	 * @type {number}
	 */
	static M = 286;
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
					: ZU.E(`invalid literal: ${i}`)
			);
		return t;
	})();
	/**
	 * Raw Deflate 実装
	 *
	 * @constructor
	 * @param {!(Uint8Array)} i 符号化する対象のバッファ. input
	 * @param {Object=} opt option parameters.
	 *
	 * typed array が使用可能なとき、outputBuffer が Array は自動的に Uint8Array に
	 * 変換されます.
	 * 別のオブジェクトになるため出力バッファを参照している変数などは
	 * 更新する必要があります.
	 */
	constructor(i, opt) {
		const z = this,
			u = opt,
			Z = ZU,
			A = Z.isAI,
			N = Z.isN,
			U = Z.u8,
			V = void 0;
		z.compressionType = /** @type {Zlib.CompressionType} */ Zlib.CT.DYNAMIC;
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
			C = Zlib.CT,
			c = z.compressionType,
			i = z.input; // compression
		if (c === C.UNCOMPRESSED) {
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
		} else ZU.E('invalid compression type');
		return z.output;
	}
	/**
	 * 非圧縮ブロックの作成 makeNocompressBlock
	 * @param {!(Uint8Array)} d ブロックデータ byte array. blockArray
	 * @param {!boolean} isFB 最後のブロックならばtrue. isFinalBlock
	 * @return {!(Uint8Array)} 非圧縮ブロック byte array.
	 */
	makeNocompressBlock(d, isFB) {
		const z = this,
			L = d.length; // length;
		let q = z.op,
			l = z.output.buffer.byteLength;
		const t = q + L + 5;
		while (l <= t) l = l << 1; // expand buffer
		const o = ZU.u8(l),
			b = isFB ? 1 : 0, // header
			N = Zlib.CT.UNCOMPRESSED,
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
	 * 固定ハフマンブロックの作成 makeFixedHuffmanBlock
	 * @param {!(Uint8Array)} d ブロックデータ byte array. blockArray
	 * @param {!boolean} isFB 最後のブロックならばtrue. isFinalBlock
	 * @return {!(Uint8Array)} 固定ハフマン符号化ブロック byte array.
	 */
	makeFixedHuffmanBlock(d, isFB) {
		const z = this,
			s = new BS(ZU.u8(z.output.buffer), z.op);
		s.w(isFB ? 1 : 0, 1, T); // header
		s.w(Zlib.CT.FIXED, 2, T);
		RawDeflate.f(z.l(d), s);
		return s.f();
	}
	/**
	 * 動的ハフマンブロックの作成 makeDynamicHuffmanBlock
	 * @param {!(Uint8Array)} d ブロックデータ byte array. blockArray
	 * @param {!boolean} isFB 最後のブロックならばtrue. isFinalBlock
	 * @return {!(Uint8Array)} 動的ハフマン符号ブロック byte array.
	 */
	makeDynamicHuffmanBlock(d, isFB) {
		let hl = /** @type {number} hlit */ 0,
			hd = /** @type {number} hdist*/ 0,
			hc = /** @type {number} hclen*/ 0;
		const z = this,
			R = RawDeflate,
			s = new BS(ZU.u8(z.output.buffer), z.op),
			H = /** @const @type {Array.<number>} */ [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], //hclenOrder
			A = /** @type {Array} */ ZU.a(19); //transLens
		s.w(isFB ? 1 : 0, 1, T); // header
		s.w(Zlib.CT.DYNAMIC, 2, T);
		const a = z.l(d),
			b = R.g(z.freqsLitLen, 15), // リテラル・長さ, 距離のハフマン符号と符号長の算出//litLenLengths
			c = R.c(b), //litLenCodes
			e = R.g(z.freqsDist, 7), //distLengths
			f = R.c(e); //distCodes
		for (hl = 286; hl > 257 && b[hl - 1] === 0; ) hl--; // HLIT の決定
		for (hd = 30; hd > 1 && e[hd - 1] === 0; ) hd--; // HDIST の決定
		/** @type {{
		 *   codes: !(Uint32Array),
		 *   freqs: !(Uint8Array)
		 * }} */
		const g = R.t(hl, b, hd, e), // treeSymbols HCLEN
			h = R.g(g.freqs, 7); //treeLens
		for (let i = 0; i < 19; i++) A[i] = h[H[i]];
		for (hc = 19; hc > 4 && A[hc - 1] === 0; ) hc--;
		const k = R.c(h); //treeCodes
		s.w(hl - 257, 5, T); // 出力
		s.w(hd - 1, 5, T);
		s.w(hc - 4, 4, T);
		for (let i = 0; i < hc; i++) s.w(A[i], 3, T);
		const t = g.codes, // ツリーの出力
			L = t.length;
		for (let i = 0; i < L; i++) {
			const c = t[i];
			s.w(k[c], h[c], T);
			if (c >= 16) s.w(t[++i], c === 16 ? 2 : c === 17 ? 3 : c === 18 ? 7 : ZU.E(`invalid code: ${c}`), T);
		}
		R.d(a, [c, b], [f, e], s);
		return s.f();
	}
	/**
	 * 動的ハフマン符号化(カスタムハフマンテーブル)dynamicHuffman
	 * @param {!(Uint16Array)} d LZ77 符号化済み byte array.dataArray
	 * @param {!(Uint8Array)} L リテラル・長さ, 距離のハフマン符号と符号長の算出 //litLenLengths
	 * @param {!Uint16Array} D code table.DistCodeTable.dist
	 * @param {!BS} s 書き込み用ビットストリーム.stream
	 * @return {!BS} ハフマン符号化済みビットストリームオブジェクト.
	 */
	static d(d, L, D, s) {
		const a = L[0], //litLenCodes
			e = L[1], //litLenLengths
			g = D[0], //distCodes
			k = D[1], //distLengths
			n = d.length;
		for (let i = 0; i < n; ++i) {
			const l = d[i]; // 符号を BitStream に書き込んでいく
			s.w(a[l], e[l], T); // literal or length
			if (l > z2) {
				s.w(d[++i], d[++i], T); // 長さ・距離符号// length extra
				const c = d[++i]; // distance
				s.w(g[c], k[c], T);
				s.w(d[++i], d[++i], T); // distance extra
			} else if (l === z2) break; // 終端
		}
		return s;
	}
	/**
	 * 固定ハフマン符号化fixedHuffman
	 * @param {!(Uint16Array)} d LZ77 符号化済み byte array.dataArray
	 * @param {!BS} s 書き込み用ビットストリーム.stream
	 * @return {!BS} ハフマン符号化済みビットストリームオブジェクト.
	 */
	static f(d, s) {
		const L = d.length;
		for (let i = 0; i < L; i++) {
			const l = d[i]; // 符号を BitStream に書き込んでいく
			BS.prototype.w.apply(s, RawDeflate.FHT[l]); // 符号の書き込み
			if (l > z2) {
				s.w(d[++i], d[++i], T); // 長さ・距離符号 // length extra
				s.w(d[++i], 5); // distance
				s.w(d[++i], d[++i], T); // distance extra
			} else if (l === z2) break; // 終端
		}
		return s;
	}
	/**
	 * LZ77 実装
	 * @param {!(Uint8Array)} d LZ77 符号化するバイト配列.dataArray
	 * @return {!(Uint16Array)} LZ77 符号化した配列.
	 */
	l(d) {
		/** @type {L7} previous longest match */
		let p,
			q = /** @type {number} lz77 output buffer pointer */ 0,
			s = /** @type {number} lz77 skip length */ 0;
		const R = RawDeflate,
			t = /** @type {Object.<number, Array.<number>>} chained-hash-table */ {},
			D = d.length,
			b = /** @type {!(Uint16Array)} lz77 buffer */ ZU.u16(D * 2),
			/** @type {!(Uint32Array)} */
			G = ZU.u32(286),
			/** @type {!(Uint32Array)} */
			H = ZU.u32(30),
			/** @type {number} */
			z = this.lazy,
			I = R.i,
			/**
			 * マッチデータの書き込み
			 * @param {L7} m LZ77 Match data.
			 * @param {!number} o スキップ開始位置(相対指定).
			 * @private
			 */
			W = (m, o) => {
				/** @type {Array.<number>} */
				const l = m.length,
					A = L7.A(l, m.backwardDistance),
					L = A.length;
				for (let i = 0; i < L; ++i) b[q++] = A[i];
				G[A[0]]++;
				H[A[3]]++;
				s = l + o - 1;
				p = null;
			};
		G[z2] = 1; // EOB の最低出現回数は 1
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
				if (p) W(p, -1); // データ末尾でマッチしようがない場合はそのまま流しこむ
				for (let j = 0, il = D - i; j < il; ++j) {
					const t = d[i + j];
					b[q++] = t;
					++G[t];
				}
				break;
			}
			if (M.length > 0) {
				const l = R.s(d, i, M), // マッチ候補から最長のものを探す
					L = l.length;
				if (p) {
					if (p.length < L) {
						const t = d[i - 1]; // 現在のマッチの方が前回のマッチよりも長い// write previous literal
						b[q++] = t;
						++G[t];
						W(l, 0); // write current match
					} else W(p, -1); // write previous match
				} else if (L < z) p = l;
				else W(l, 0);
			} else if (p) W(p, -1); // 前回マッチしていて今回マッチがなかったら前回のを採用
			else {
				const t = d[i];
				b[q++] = t;
				++G[t];
			}
			M.push(i); // マッチテーブルに現在の位置を保存
		}
		b[q++] = z2; // 終端処理
		G[z2]++;
		this.freqsLitLen = G;
		this.freqsDist = H;
		return ZU.s(b, 0, q);
	}
	/**
	 * マッチした候補の中から最長一致を探す searchLongestMatch_
	 * @param {!Object} d plain data byte array. data
	 * @param {!number} p plain data byte array position.position
	 * @param {!Array.<number>} l 候補となる位置の配列.matchList
	 * @return {!L7} 最長かつ最短距離のマッチオブジェクト.
	 * @private
	 */
	static s(d, p, l) {
		let u,
			x = 0;
		const L = d.length,
			C = l.length;
		pm: for (let i = 0; i < C; i++) {
			const m = l[C - i - 1], // 候補を後ろから 1 つずつ絞り込んでゆく
				R = RawDeflate,
				I = R.i,
				X = R.x;
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
		return new L7(x, p - u);
	}
	/**
	 * Tree-Transmit Symbols の算出 getTreeSymbols_
	 * reference: PuTTY Deflate implementation
	 * @param {number} hlit HLIT.
	 * @param {!(Uint8Array)} L リテラルと長さ符号の符号長配列.litlenLengths
	 * @param {number} hdist HDIST.
	 * @param {!(Uint8Array)} D 距離符号の符号長配列.distLengths
	 * @return {{
	 *   codes: !(Uint32Array),
	 *   freqs: !(Uint8Array)
	 * }} Tree-Transmit Symbols.
	 */
	static t(hlit, L, hdist, D) {
		const sL = hlit + hdist,
			U = ZU.u32,
			s = U(sL), //src
			r = U(286 + 30),
			q = ZU.u8(19); //freqs
		let j = 0,
			n = 0; // 符号化
		for (let i = 0; i < hlit; i++) s[j++] = L[i];
		for (let i = 0; i < hdist; i++) s[j++] = D[i];
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
	 * @param {!(Uint8Array|Uint32Array)} q 出現カウント. freqs
	 * @param {number} t 符号長の制限. limit
	 * @return {!(Uint8Array)} 符号長配列.
	 * @private
	 */
	static g(q, t) {
		const n = /** @type {number} */ q.length,
			R = RawDeflate,
			h = /** @type {Heap} */ new Heap(2 * R.M),
			l = /** @type {!(Uint8Array)} */ ZU.u8(n);
		for (let i = 0; i < n; ++i) if (q[i] > 0) h.push(i, q[i]); // ヒープの構築
		const f = h.l / 2,
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
		const c = R.r(v, v.length, t);
		for (let i = 0; i < m; ++i) l[s[i].index] = c[i];
		return l;
	}
	/**
	 * takePkg
	 * @param {number} j
	 * @param {number} t type
	 * @param {number} p currentPosition
	 * @param {number} s symbols
	 * @param {number} c codeLength
	 */
	static p(j, t, p, s, c) {
		const x = /** @type {number} */ t[j][p[j]],
			f = RawDeflate.p;
		if (x === s) {
			f(j + 1, t, p, s, c);
			f(j + 1, t, p, s, c);
		} else --c[x];
		++p[j];
	}
	/**
	 * Reverse Package Merge Algorithm. reversePackageMerge_
	 * @param {!(Uint32Array)} freqs sorted probability. freqs
	 * @param {number} symbols number of symbols. symbols
	 * @param {number} limit code length limit. limit
	 * @return {!(Uint8Array)} code lengths.
	 */
	static r(q, s, L) {
		const a = ZU.a,
			M = L - 1,
			m = /** @type {!(Uint16Array)} */ ZU.u16(L), //minCost
			f = /** @type {!(Uint8Array)} */ ZU.u8(L),
			c = /** @type {!(Uint8Array)} */ ZU.u8(s),
			v = /** @type {Array} */ a(L),
			y = /** @type {Array} */ a(L),
			P = /** @type {Array.<number>} */ a(L),
			h = /** @type {number} */ 1 << M;
		let e = /** @type {number} */ (1 << L) - s;
		m[M] = s;
		for (let j = 0; j < L; ++j) {
			if (e < h) f[j] = 0;
			else {
				f[j] = 1;
				e -= h;
			}
			e <<= 1;
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
			const s = v[j],
				u = v[j + 1],
				z = y[j],
				o = m[j];
			for (let t = 0; t < o; t++) {
				const w = u[n] + u[n + 1];
				if (w > q[i]) {
					s[t] = w;
					z[t] = s;
					n += 2;
				} else {
					s[t] = q[i];
					z[t] = i;
					++i;
				}
			}
			P[j] = 0;
			if (f[j] === 1) RawDeflate.p(j, y, P, s, c);
		}
		return c;
	}
	/**
	 * 符号長配列からハフマン符号を取得する getCodesFromLengths_
	 * reference: PuTTY Deflate implementation
	 * @param {!(Uint8Array)} a 符号長配列. length
	 * @return {!(Uint16Array)} ハフマン符号配列.
	 * @private
	 */
	static c(a) {
		const L = a.length,
			o = ZU.u16(L),
			t = [],
			s = []; //startCode
		let c = 0;
		for (const l of a) t[l] = (t[l] | 0) + 1; // Count the codes of each length.
		for (let i = 1; i <= RawDeflate.MCL; i++) {
			s[i] = c; // Determine the starting code for each length block.
			c += t[i] | 0;
			c <<= 1;
		}
		for (let i = 0; i < L; i++) {
			const l = a[i]; // Determine the code for each symbol. Mirrored, of course.
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
/**Lz77Match */
class L7 {
	/**
	 * マッチ情報
	 * @param {!number} l マッチした長さ. length
	 * @param {!number} b マッチ位置との距離. backwardDistance
	 * @constructor
	 */
	constructor(l, b) {
		this.length = /** @type {number} match length. */ l;
		this.backwardDistance = /** @type {number} backward distance. */ b;
	}
	/**
	 * 長さ符号テーブル.LengthCodeTable
	 * [コード, 拡張ビット, 拡張ビット長] の配列となっている.
	 * @const
	 * @type {!(Uint32Array)}
	 */
	static T = L7.b(); //buildLengthCodeTable
	static b() {
		const t = /** @type {!Array} */ [];
		for (let i = 3; i <= fi; i++) {
			const c = L7.c(i);
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
			: ZU.E(`invalid length: ${l}`);
	}
	/**
	 * 距離符号テーブル //getDistanceCode_
	 * @param {!number} d 距離.
	 * @return {!Array.<number>} コード、拡張ビット、拡張ビット長の配列.
	 * @private
	 */
	static g(d) {
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
			: ZU.E(`invalid distance ${d}`);
	}
	/**
	 * マッチ情報を LZ77 符号化配列で返す.toLz77Array
	 * なお、ここでは以下の内部仕様で符号化している
	 * [ CODE, EXTRA-BIT-LEN, EXTRA, CODE, EXTRA-BIT-LEN, EXTRA ]
	 * @param {!number} l .length
	 * @param {!number} d backwardDistance.
	 * @return {!Array.<number>} LZ77 符号化 byte array.
	 */
	static A(l, d) {
		let p = 0;
		const a = [],
			b = L7.T[l]; // length
		a[p++] = b & f4;
		a[p++] = ZU.N(b, 16);
		a[p++] = b >> 24;
		const c = L7.g(d); // distance
		a[p++] = c[0];
		a[p++] = c[1];
		a[p++] = c[2];
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

	/**
	 * FileHeaderSignature
	 * @type {Array.<number>}
	 * @const
	 */
	static FHS = [80, 75, 1, 2];
	/**
	 * @type {Array.<number>}
	 * @const
	 */
	static LFHS = [80, 75, 3, 4];
	/**
	 * @type {Array.<number>}
	 * @const
	 */
	static CDS = [80, 75, 5, 6];
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
	 * @param {Uint8Array} i input
	 * @param {Object=} opt options.
	 */
	addFile(i, opt = {}) {
		const C = Zlib.CM,
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
				r = CRC32.c(b);
				b = Zip.dWO(b, u);
				c = T;
			} else if (M !== C.STORE) ZU.E(`unknown compression method:${M}`);
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
	 * @param {(Uint8Array)} w
	 */
	setPassword(w) {
		this.password = w;
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
			F = z.files,
			m = z.comment,
			S = F.length,
			U = ZU,
			Y = U.N,
			Q = ff;
		/** @type {{
		 *   buffer: !(Uint8Array),
		 *   option: Object,
		 *   compressed: boolean,
		 *   encrypted: boolean,
		 *   size: number,
		 *   crc32: number
		 * }} */
		let x = /** @type {number} */ 0,
			y = /** @type {number} */ 0; //centralDirectorySize
		for (let i = 0; i < S; ++i) {
			const f = F[i],
				u = f.option, // ファイルの圧縮
				n = u.filename,
				N = n ? n.length : 0,
				m = u.comment,
				P = m ? m.length : 0,
				M = u.compressionMethod,
				w = u.password || z.password,
				b = f.buffer,
				E = Z.e;
			// const extraFieldLength = opt.extraField ? opt.extraField.length : 0;
			if (!f.compressed) {
				f.crc32 = CRC32.c(b); // 圧縮されていなかったら圧縮 // 圧縮前に CRC32 の計算をしておく
				if (M === C.DEFLATE) {
					f.buffer = Z.dWO(b, u); //deflateWithOption
					f.compressed = T;
				} else if (M !== C.STORE) U.E(`unknown compression method:${M}`);
			}
			if (w) {
				const k = Z.c(w), // encryption// init encryption
					e = f.buffer,
					l = e.length + 12, // add header
					b = U.u8(l);
				b.set(e, 12);
				for (let j = 0; j < 12; ++j) b[j] = E(k, i === 11 ? f.crc32 & Q : (Math.random() * z2) | 0);
				for (let j = 12; j < l; ++j) b[j] = E(k, b[j]); // data encryption
				f.buffer = b;
			}
			x += 30 + N + f.buffer.length; // 必要バッファサイズの計算// local file header// file data
			y += 46 + N + P; // file header
		}
		const R = 22 + (m ? m.length : 0), // endOfCentralDirectorySize end of central directory
			o = U.u8(x + y + R),
			B = Z.CDS;
		let q1 = 0,
			q2 = x,
			q3 = q2 + y;
		for (const f of F) {
			const u = f.option, // ファイルの圧縮
				e = f.buffer,
				n = u.filename,
				N = n ? n.length : 0,
				m = u.comment,
				P = m ? m.length : 0,
				g = 0, // TODO
				h = q1, //// local file header & file header ////
				G = Z.LFHS,
				H = Z.FHS;
			o[q1++] = G[0]; // local file header // signature
			o[q1++] = G[1];
			o[q1++] = G[2];
			o[q1++] = G[3];
			o[q2++] = H[0]; // file header
			o[q2++] = H[1];
			o[q2++] = H[2];
			o[q2++] = H[3];
			const v = 20; // compressor info//needVersion
			o[q2++] = v & Q;
			o[q2++] =
				/** @type {OperatingSystem} */
				(u.os) || Z.OperatingSystem.MSDOS;
			o[q1++] = o[q2++] = v & Q; // need version
			o[q1++] = o[q2++] = Y(v, 8);
			let fg = 0; // general purpose bit flag
			if (u.password || z.password) fg |= Z.Flags.ENCRYPT;
			o[q1++] = o[q2++] = fg & Q;
			o[q1++] = o[q2++] = Y(fg, 8);
			const K =
				/** @type {CompressionMethod} */
				(u.compressionMethod); // compression method
			o[q1++] = o[q2++] = K & Q;
			o[q1++] = o[q2++] = Y(K, 8);
			const t = /** @type {(Date|undefined)} */ (u.date) || new Date(); // date
			o[q1++] = o[q2++] = ((t.getMinutes() & 0x7) << 5) | ((t.getSeconds() / 2) | 0);
			o[q1++] = o[q2++] = (t.getHours() << 3) | (t.getMinutes() >> 3);
			o[q1++] = o[q2++] = (((t.getMonth() + 1) & 0x7) << 5) | t.getDate();
			o[q1++] = o[q2++] = (((t.getFullYear() - 1980) & 0x7f) << 1) | ((t.getMonth() + 1) >> 3);
			const cr = f.crc32; // CRC-32
			o[q1++] = o[q2++] = cr & Q;
			o[q1++] = o[q2++] = Y(cr, 8);
			o[q1++] = o[q2++] = Y(cr, 16);
			o[q1++] = o[q2++] = Y(cr, 24);
			const sz = e.length; // compressed size
			o[q1++] = o[q2++] = sz & Q;
			o[q1++] = o[q2++] = Y(sz, 8);
			o[q1++] = o[q2++] = Y(sz, 16);
			o[q1++] = o[q2++] = Y(sz, 24);
			const ps = f.size; // uncompressed size
			o[q1++] = o[q2++] = ps & Q;
			o[q1++] = o[q2++] = Y(ps, 8);
			o[q1++] = o[q2++] = Y(ps, 16);
			o[q1++] = o[q2++] = Y(ps, 24);
			o[q1++] = o[q2++] = N & Q; // filename length
			o[q1++] = o[q2++] = Y(N, 8);
			o[q1++] = o[q2++] = g & Q; // extra field length
			o[q1++] = o[q2++] = Y(g, 8);
			o[q2++] = P & Q; // file comment length
			o[q2++] = Y(P, 8);
			o[q2++] = 0; // disk number start
			o[q2++] = 0;
			o[q2++] = 0; // internal file attributes
			o[q2++] = 0;
			o[q2++] = 0; // external file attributes
			o[q2++] = 0;
			o[q2++] = 0;
			o[q2++] = 0;
			o[q2++] = h & Q; // relative offset of local header
			o[q2++] = Y(h, 8);
			o[q2++] = Y(h, 16);
			o[q2++] = Y(h, 24);
			if (n) {
				o.set(n, q1);
				o.set(n, q2);
				q1 += N;
				q2 += N;
			}
			const O = u.extraField; // extra field
			if (O) {
				o.set(O, q1);
				o.set(O, q2);
				q1 += g;
				q2 += g;
			}
			if (m) {
				o.set(m, q2);
				q2 += P;
			}
			o.set(e, q1); //// file data ////
			q1 += e.length;
		}
		o[q3++] = B[0]; //// end of central directory //// signature
		o[q3++] = B[1];
		o[q3++] = B[2];
		o[q3++] = B[3];
		o[q3++] = 0; // number of z disk
		o[q3++] = 0;
		o[q3++] = 0; // number of the disk with the start of the central directory
		o[q3++] = 0;
		o[q3++] = S & Q; // total number of entries in the central directory on z disk
		o[q3++] = Y(S, 8);
		o[q3++] = S & Q; // total number of entries in the central directory
		o[q3++] = Y(S, 8);
		o[q3++] = y & Q; // size of the central directory
		o[q3++] = Y(y, 8);
		o[q3++] = Y(y, 16);
		o[q3++] = Y(y, 24);
		o[q3++] = x & Q; // offset of start of central directory with respect to the starting disk number
		o[q3++] = Y(x, 8);
		o[q3++] = Y(x, 16);
		o[q3++] = Y(x, 24);
		const P = m ? m.length : 0; // .ZIP file comment length
		o[q3++] = P & Q;
		o[q3++] = Y(P, 8);
		if (m) {
			o.set(m, q3); // .ZIP file comment
			q3 += P;
		}
		return o;
	}
	/**
	 * deflateWithOption
	 * @param {!(Uint8Array)} i input
	 * @param {Object=} opt options.
	 * @return {!(Uint8Array)}
	 */
	static dWO = (i, opt) => new RawDeflate(i, opt.deflateOption).compress();
	/**
	 * getByte
	 * @param {(Uint32Array)} k key
	 * @return {number}
	 */
	static g(k) {
		const t = (k[2] & f4) | 2;
		return ((t * (t ^ 1)) >> 8) & ff;
	}
	/**
	 * @param {(Uint32Array|Object)} k key
	 * @param {number} n
	 * @return {number}
	 */
	static e(k, n) {
		const t = Zip.g(/** @type {(Uint32Array)} */ k);
		Zip.u(/** @type {(Uint32Array)} */ k, n);
		return t ^ n;
	}
	/**
	 * @param {(Uint32Array)} k key
	 * @param {number} n
	 */
	static u(k, n) {
		const S = CRC32.s;
		k[0] = S(k[0], n);
		k[1] = ((((((k[1] + (k[0] & ff)) * 20173) >>> 0) * 6681) >>> 0) + 1) >>> 0;
		k[2] = S(k[2], k[1] >>> 24);
	}
	/**
	 * createEncryptionKey
	 * @param {(Uint8Array)} w password
	 * @return {!(Uint32Array|Object)}
	 */
	static c(w) {
		const k = ZU.u32([305419896, 591751049, 878082192]);
		for (let i = 0; i < w.length; ++i) Zip.u(k, w[i] & ff);
		return k;
	}
	/**
	 * @param {(Uint32Array|Object)} k key
	 * @param {number} n
	 * @return {number}
	 */
	static d(k, n) {
		n ^= Zip.g(/** @type {(Uint32Array)} */ k);
		Zip.u(/** @type {(Uint32Array)} */ k, n);
		return n;
	}
}
/**LocalFileHeader */
class LFH {
	/**
	 * @param {!(Uint8Array)} i input buffer.
	 * @param {number} ip input position.
	 * @constructor
	 */
	constructor(i, ip) {
		const z = this,
			L = Zip.LFHS,
			S = ZU.s;
		let p = /** @type {number} */ ip;
		z.input = /** @type {!(Uint8Array)} */ i;
		z.offset = /** @type {number} */ p;
		if (i[p++] !== L[0] || i[p++] !== L[1] || i[p++] !== L[2] || i[p++] !== L[3])
			ZU.E('invalid local file header signature'); // local file header signature
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
	/**
	 * Zlib Deflate
	 * @constructor
	 * @param {!(Uint8Array)} i 符号化する対象の byte array. input
	 * @param {Object=} opt option parameters.
	 */
	constructor(i, opt = {}) {
		const z = this,
			u = opt,
			c = u.compressionType,
			Z = Zlib,
			r = /** @type {Object} */ {};
		z.input = /** @type {!(Uint8Array)} */ i;
		z.output = /** @type {!(Uint8Array)} */ ZU.u8(Z.DBS);
		z.compressionType = /** @type {Deflate.CompressionType} */ Z.CT.DYNAMIC;
		if (ZU.isN(c)) z.compressionType = c; // option parameters
		for (const p in u) r[p] = u[p]; // copy options
		r.outputBuffer = z.output; // set raw-deflate output buffer
		z.rawDeflate = /** @type {RawDeflate} */ new RawDeflate(i, r);
	}
	/**
	 * 直接圧縮に掛ける.
	 * @param {!(Uint8Array)} i target buffer.input
	 * @param {Object=} opt option parameters.
	 * @return {!(Uint8Array)} compressed data byte array.
	 */
	static compress = (i, opt) => new Deflate(i, opt).compress();
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
			E = U.E,
			Y = U.N,
			D = Z.CM.DEFLATE,
			m = D, // Compression Method and Flags
			t = z.compressionType,
			M = Math,
			i = m === D ? M.LOG2E * M.log(R.WS) - 8 : E('invalid compression method'),
			c = (i << 4) | m,
			F = 0, // Flags
			C = Z.CT,
			l =
				m !== D
					? E('invalid compression method')
					: t === C.UNCOMPRESSED
					? 0
					: t === C.FIXED
					? 1
					: t === C.DYNAMIC
					? 2
					: E('unsupported compression type');
		o[p++] = c;
		let f = (l << 6) | (F << 5);
		const d = 31 - ((c * z2 + f) % 31),
			r = z.rawDeflate;
		f |= d;
		o[p++] = f;
		r.op = p;
		const a = Adler32.H(z.input), // Adler-32 checksum
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
	 * @param {!(Uint8Array)} i input buffer.
	 * @param {Object=} opt option parameters.
	 */
	constructor(i) {
		this.input = i; // input buffer.
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
		while (z.ip < l) G.m(z);
		z.decompressed = T;
		return G.c(z.member);
	}
	/**
	 * decode gzip member. decodeMember
	 * @return {!(Obj)} this
	 */
	static m(z) {
		const m = /** @type {Zlib.GunzipMember} */ new GM(),
			i = z.input,
			F = Gzip.FlagsMask,
			E = ZU.E,
			C = CRC32.c;
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
			p = Gunzip.d(p, m.xlen);
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
		const K = new RawInflate(i, {
				index: p,
				bufferSize: l - p - /* CRC-32 */ 4 - /* ISIZE */ 4 < x * 512 ? x : void 0, // inflate size
			}), // compressed block // RawInflate implementation.
			j = K.decompress(), // inflated data.
			I = j.length,
			v = C(j);
		m.data = j;
		let q = K.ip;
		const r = (i[q++] | (i[q++] << 8) | (i[q++] << 16) | (i[q++] << 24)) >>> 0; // crc32
		m.crc32 = r;
		if (v !== r) E(`invalid CRC-32 checksum: 0x${v.toString(16)} / 0x${r.toString(16)}`);
		const y = (i[q++] | (i[q++] << 8) | (i[q++] << 16) | (i[q++] << 24)) >>> 0; // input size
		m.isize = y;
		if ((I & f8) !== y) E(`invalid input size: ${I & f8} / ${y}`);
		z.member.push(m);
		z.ip = q;
	}
	/**
	 * サブフィールドのデコード decodeSubField
	 * XXX: 現在は何もせずスキップする
	 */
	static d = (p, l) => p + l;
	/**
	 * concatMember
	 * @return {!(Uint8Array)}
	 */
	static c(ms) {
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
/**GunzipMember */
class GM {
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
	 * @param {!(Uint8Array)} i input buffer.input
	 * @param {Object=} opt option parameters.
	 */
	constructor(i, opt = {}) {
		const z = this,
			u = opt,
			V = void 0;
		z.input = /** @type {!(Uint8Array)} input buffer. */ i;
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
			C = CRC32.c,
			U = ZU,
			Y = U.M,
			o = /** @type {!(Uint8Array)} output buffer. */ ZU.u8(Zlib.DBS),
			i = z.input,
			p = z.ip,
			n = z.filename,
			m = z.comment,
			M = G.FlagsMask,
			F = z.flags,
			d = z.deflateOptions,
			Q = ff;
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
		o[q++] = t & Q;
		o[q++] = Y(t, 8);
		o[q++] = Y(t, 16);
		o[q++] = Y(t, 24);
		o[q++] = 0; // extra flags
		o[q++] = G.OperatingSystem.UNKNOWN; // operating system
		// extra
		/* NOP */
		if (!U.U(F.fname)) {
			for (let j = 0, N = n.length; j < N; ++j) {
				const c = n.charCodeAt(j); // fname
				if (c > Q) o[q++] = Y(c, 8);
				o[q++] = c & Q;
			}
			o[q++] = 0; // null termination
		}
		if (F.comment) {
			for (let j = 0, P = m.length; j < P; ++j) {
				const c = m.charCodeAt(j); // fcomment
				if (c > Q) o[q++] = Y(c, 8);
				o[q++] = c & Q;
			}
			o[q++] = 0; // null termination
		}
		if (F.fhcrc) {
			const c = C(o, 0, q) & f4; // fhcrc CRC-16 value for FHCRC flag.
			o[q++] = c & Q;
			o[q++] = Y(c, 8);
		}
		d.outputBuffer = o; // add compress option
		d.outputIndex = q;
		const r = new RawDeflate(i, d); // compress//raw deflate object.
		let o2 = r.compress(),
			ob = o2.buffer,
			q2 = r.op;
		if (q2 + 8 > ob.byteLength) {
			z.output = U.u8s(q2 + 8, U.u8(ob)); // expand buffer
			o2 = z.output;
		} else o2 = U.u8(ob);
		const c = C(i); // crc32 CRC-32 value for verification.
		o2[q2++] = c & Q;
		o2[q2++] = Y(c, 8);
		o2[q2++] = Y(c, 16);
		o2[q2++] = Y(c, 24);
		const I = i.length; // input size
		o2[q2++] = I & Q;
		o2[q2++] = Y(I, 8);
		o2[q2++] = Y(I, 16);
		o2[q2++] = Y(I, 24);
		z.ip = p;
		return (z.output = q2 < o2.length ? ZU.s(o2, 0, q2) : o2);
	}
}
class InflateStream {
	/**
	 * @param {!(Uint8Array)} i deflated buffer. input
	 * @constructor
	 */
	constructor(i = ZU.u8()) {
		const z = this,
			r = new RawInflateStream(i, 0);
		z.input = /** @type {!(Uint8Array)} */ i;
		z.ip = /** @type {number} */ 0;
		z.rawinflate = /** @type {RawInflateStream} */ r;
		z.method = /** @type {Zlib.CompressionMethod} */ void 0;
		z.output = /** @type {!(Uint8Array)} */ r.output;
	}
	/**
	 * decompress.
	 * @return {!(Uint8Array)} inflated buffer. input
	 */
	decompress(i) {
		const z = this,
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
		if (ZU.U(z.method) && !z.rH()) return ZU.u8();
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
	/**readHeader */
	rH() {
		let p = this.ip;
		const z = this,
			i = z.input,
			c = i[p++], // Compression Method and Flags
			f = i[p++],
			U = ZU.U;
		if (U(c) || U(f)) return 0;
		z.method = Inflate.gM(c, f);
		z.ip = p;
	}
}
class Inflate {
	/**
	 * @constructor
	 * @param {!(Uint8Array)} input deflated buffer. input
	 * @param {Object=} opt option parameters.
	 *
	 * opt は以下のプロパティを指定する事ができます。
	 *   - index: input buffer の deflate コンテナの開始位置.
	 *   - blockSize: バッファのブロックサイズ.
	 *   - verify: 伸張が終わった後 adler-32 checksum の検証を行うか.
	 *   - bufferType: Zlib.Inflate.BufferType の値によってバッファの管理方法を指定する.
	 *       Zlib.Inflate.BufferType は Zlib.RawInflate.BufferType のエイリアス.
	 */
	constructor(i, opt = {}) {
		const z = this,
			u = opt;
		z.input = /** @type {!(Uint8Array)} */ i;
		z.ip = /** @type {number} */ 0;
		if (u.index) z.ip = u.index; // option parameters
		if (u.verify) z.verify = /** @type {(boolean|undefined)} verify flag. */ u.verify;
		z.method = Inflate.gM(
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
	/**
	 * getMethod
	 * @param {*} c Compression Method and Flags
	 * @param {*} f flg
	 * @returns
	 */
	static gM(c, f) {
		const D = Zlib.CM.DEFLATE,
			E = ZU.E,
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
			A = Adler32.H,
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
			if (a !== A(b)) ZU.E('invalid adler-32 checksum ' + a + '/' + A(b) + ' ' + '');
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
	static B = RawInflate.BufferType;

	/**
	 * @constructor
	 * @param {!(Uint8Array.<number>)} i input buffer.input
	 * @param {Object} opt option parameter.
	 *
	 * opt は以下のプロパティを指定する事ができます。
	 *   - index: input buffer の deflate コンテナの開始位置.
	 *   - blockSize: バッファのブロックサイズ.
	 *   - bufferType: Zlib.RawInflate.BufferType の値によってバッファの管理方法を指定する.
	 *   - resize: 確保したバッファが実際の大きさより大きかった場合に切り詰める.
	 */
	constructor(i, opt = {}) {
		const z = this,
			Z = Zlib,
			B = RawInflate.B,
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
		z.input = /** @type {!(Uint8Array)} input buffer. */ U(i);
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
		} else ZU.E('invalid inflate mode');
	}
	/**
	 * decompress.
	 * @return {!(Uint8Array.<number>)} inflated buffer.
	 */
	decompress() {
		const z = this,
			B = RawInflate.B;
		while (!z.bfinal) z.p();
		return z.bufferType === B.BLOCK ? z.c() : B.ADAPTIVE ? z.f() : ZU.E('invalid inflate mode');
	}
	/**
	 * parse deflated block. parseBlock
	 */
	p() {
		const z = this,
			B = Zlib.CT;
		let h = Zlib.r(3, z);
		if (h & 1) z.bfinal = T; // BFINAL
		h >>>= 1; // BTYPE
		return h === B.UNCOMPRESSED
			? z.parseUncompressedBlock() // uncompressed
			: h === B.FIXED
			? z.parseFixedHuffmanBlock() // fixed huffman
			: h === B.DYNAMIC
			? z.parseDynamicHuffmanBlock() // dynamic huffman
			: ZU.E(`unknown BTYPE: ${h}`); // reserved or other
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
			B = R.B,
			E = ZU.E,
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
				o = R.b(z); // expand buffer
				q = z.op;
			}
		} else if (t === B.ADAPTIVE) while (q + l > o.length) o = R.e(z, z.currentLitlenTable, { fixRatio: 2 });
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
	/**
	 * parse dynamic huffman block.
	 */
	parseDynamicHuffmanBlock() {
		const z = this,
			Z = Zlib,
			B = Z.r,
			R = RawInflate,
			t = z.bufferType,
			hl = /** @type {number} number of literal and length codes. hlit */ B(5, z) + 257,
			hd = /** @type {number} number of distance codes. hdist */ B(5, z) + 1,
			hc = /** @type {number} number of code lengths. hclen*/ B(4, z) + 4,
			cL = /** @type {!(Uint8Array.<number>)} code lengths. cLens*/ ZU.u8(Z.Order.length);
		const [a, b] = R.i(z, hl, hd, hc, cL);
		return R.a(t, z, a, b);
	}
	/**
	 * parseHuffmanBlock
	 * @param {number} t RawInflate.BufferType
	 * @param {object} z this RawInflate instance
	 * @param {Uint8Array} a literal and length code table.
	 * @param {Uint8Array} b distination code table. dist
	 * @returns HuffmanBlock
	 */
	static a = (t, z, a, b) =>
		t === RawInflate.B.ADAPTIVE ? z.a(a, b) : t === RawInflate.B.BLOCK ? z.d(a, b) : ZU.E('invalid inflate mode');
	/**
	 * parseDynamicHuffmanBlockImpl
	 * @param {object} z this RawInflate instance
	 * @param {number} hlit number of literal and length codes. hlit
	 * @param {number} hdist number of distance codes. hdist
	 * @param {number} hclen number of code lengths. hclen
	 * @param {!(Uint8Array.<number>)} cLens  code lengths. cLens*
	 * @returns {!(Array.<Uint8Array>)} literal and length code table. litlen & distination code table. dist
	 */
	static i(z, hlit, hdist, hclen, cLens) {
		const h = hlit + hdist,
			Z = Zlib,
			B = Z.r,
			H = Huffman.b,
			E = ZU.E,
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
			const c = Z.rCBT(D, z);
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
	 * decode huffman code. decodeHuffmanBlock
	 * @param {!(Uint16Array)} l literal and length code table. litlen
	 * @param {!(Uint8Array)} t distination code table. dist
	 */
	d(l, t) {
		const z = this,
			Z = Zlib,
			A = Z.rCBT,
			B = RawInflate.b,
			O = z.output.length - Z.MaxCopyLength, //output position limit.
			C = Z.LCT,
			D = Z.LET,
			E = Z.DCT,
			F = Z.DET;
		let o = z.output,
			q = z.op,
			c; //huffman code.
		z.currentLitlenTable = l;
		while ((c = A(l, z)) !== z2) {
			if (c === 0) return;
			if (c < z2) {
				if (q >= O) {
					z.op = q; // literal
					o = B(z);
					q = z.op;
				}
				o[q++] = c;
				continue;
			}
			const t = c - 257; // length code
			let e = C[t]; //huffman code length.
			if (D[t] > 0) e += Z.r(D[t], z);
			const d = A(t, z); // dist code
			let s = E[d]; //huffman code distination.
			if (F[d] > 0) s += Z.r(F[d], z);
			if (q >= O) {
				z.op = q; // lz77 decode
				o = B(z);
				q = z.op;
			}
			while (e--) o[q] = o[q++ - s];
		}
		while (z.bitsbuflen >= 8) {
			z.bitsbuflen -= 8;
			z.ip--;
		}
		z.op = q;
	}
	/**
	 * decode huffman code (adaptive) decodeHuffmanAdaptive
	 * @param {!(Uint16Array)} l literal and length code table.litlen
	 * @param {!(Uint8Array)} t distination code table.dist
	 */
	a(l, t) {
		const z = this,
			Z = Zlib,
			A = Z.rCBT,
			B = RawInflate.e,
			C = Z.LCT,
			D = Z.LET,
			E = Z.DCT,
			F = Z.DET;
		let o = z.output,
			q = z.op,
			r = o.length, //output position limit.
			c; //huffman code.
		z.currentLitlenTable = l;
		while ((c = A(l, z)) !== z2) {
			if (c < z2) {
				if (q >= r) {
					o = B(z, l); // literal
					r = o.length;
				}
				o[q++] = c;
				continue;
			}
			const e = c - 257; // length code
			let h = C[e]; //huffman code length.
			if (D[e] > 0) h += Z.r(D[e], z);
			const d = A(t, z); // dist code
			let s = E[d]; //huffman code distination.
			if (F[d] > 0) s += Z.r(F[d], z);
			if (q + h > r) {
				o = B(z, l); // lz77 decode
				r = o.length;
			}
			while (h--) o[q] = o[q++ - s];
		}
		while (z.bitsbuflen >= 8) {
			z.bitsbuflen -= 8;
			z.ip--;
		}
		z.op = q;
	}
	/**
	 * expand output buffer.expandBufferBlock
	 * @param {Object=} opt option parameters.
	 * @return {!(Uint8Array)} output buffer.
	 */
	static b(z) {
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
	 * expand output buffer. (adaptive)expandBufferAdaptive
	 * @param {Object=} opt option parameters.
	 * @param {Object=} t option parameters.currentLitlenTable
	 * @return {!(Uint8Array)} output buffer pointer.
	 */
	static e(z, t, opt = {}) {
		const i = z.input,
			L = i.length,
			o = z.output,
			O = o.length,
			u = opt,
			N = ZU.isN,
			M = MAX_FIREFOX_SIZE;
		let r = (L / z.ip + 1) | 0, //expantion ratio.
			n; //new output buffer size.
		if (O === M) ZU.E('TOO LOG LENGTH OF BUFFER ADAPTIVE!');
		if (u) {
			if (N(u.fixRatio)) r = u.fixRatio;
			if (N(u.addRatio)) r += u.addRatio;
		}
		if (r < 2) {
			const h = (L - z.ip) / t[2], // calculate new buffer size //maximum number of huffman code.
				s = ((h / 2) * fi) | 0; //max inflate size.
			n = s < O ? O + s : O << 1;
		} else n = O * r;
		return (z.output = ZU.u8s(M > n ? n : M, o)); // buffer expantion //store buffer.
	}
	/**
	 * concat output buffer. concatBufferBlock
	 * @return {!(Uint8Array)} output buffer.
	 */
	c() {
		let p = 0; //buffer pointer.
		const z = this,
			q = z.op,
			M = Zlib.MaxBackwardLength,
			L = z.totalpos + (q - M), //buffer pointer.
			o = z.output, //output block array.
			k = z.blocks, //blocks array.
			b = ZU.u8(L); //output buffer.
		if (k.length === 0) return ZU.s(o, M, q); // single buffer
		for (const b of k) for (let j = 0, J = b.length; j < J; ++j) b[p++] = b[j]; // copy to buffer
		for (let i = M; i < q; ++i) b[p++] = o[i]; // current buffer
		z.blocks = [];
		return (z.buffer = b);
	}
	/**
	 * concat output buffer. (dynamic) concatBufferDynamic
	 * @return {!(Uint8Array)} output buffer.
	 */
	f() {
		const z = this,
			q = z.op,
			s = ZU.s(z.output, 0, q);
		return (z.buffer = z.resize ? ZU.u8s(q, s) : s); //output buffer.
	}
}
class RawInflateStream {
	/**
	 * @param {!(Uint8Array.<number>)} i input buffer. input
	 * @param {number} ip input buffer pointer.decompress
	 * @param {number=} o buffer block size. ZLIB_STREAM_RAW_INFLATE_BUFFER_SIZE = z83;opt_buffersize
	 * @constructor
	 */
	constructor(i, ip = 0, o = z83) {
		const z = this,
			U = ZU.u8,
			R = RawInflateStream,
			V = void 0;
		z.blocks = /** @type {!Array.<(Uint8Array)>} */ [];
		z.bufferSize = /** @type {number} block size. */ o;
		z.totalpos = /** @type {!number} total output buffer pointer. */ 0;
		z.ip = /** @type {!number} input buffer pointer. */ ip;
		z.bitsbuf = /** @type {!number} bit stream reader buffer. */ 0;
		z.bitsbuflen = /** @type {!number} bit stream reader buffer size. */ 0;
		z.input = /** @type {!(Uint8Array)} input buffer. */ U(i);
		z.output = /** @type {!(Uint8Array)} output buffer. */ U(o);
		z.op = /** @type {!number} output buffer pointer. */ 0;
		z.bfinal = /** @type {boolean} is final block flag. */ false;
		z.blockLength = /** @type {number} uncompressed block length. */ 0;
		z.resize = /** @type {boolean} resize flag for memory size optimization. */ false;
		z.litlenTable = /** @type {Array} */ V;
		z.distTable = /** @type {Array} */ V;
		z.sp = /** @type {number} */ 0; // stream pointer
		z.status = /** @type {RawInflateStream.Status} */ R.S.INITIALIZED;
		//backup  //
		z.ip_ = /** @type {!number} */ V;
		z.bitsbuflen_ = /** @type {!number} */ V;
		z.bitsbuf_ = /** @type {!number} */ V;
	}
	/**
	 * @enum {number}
	 */
	static BlockType = RawInflate.T;
	/**
	 * Status
	 * @enum {number}
	 */
	static S = {
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
	 * @param {!(Uint8Array.<number>)} i input buffer. newInput
	 * @param {number} ip input buffer pointer.decompress
	 * @return {!(Uint8Array)} inflated buffer.vnewInput
	 */
	decompress(i, ip) {
		const z = this,
			R = RawInflateStream,
			S = R.S,
			B = Zlib.CT;
		let s = /** @type {boolean} */ false; //stop
		if (!ZU.U(i)) z.input = i;
		if (!ZU.U(ip)) z.ip = ip;
		while (!s)
			switch (z.status) {
				case S.INITIALIZED: // block header// decompress
				case S.BLOCK_HEADER_START:
					s = z.b();
					break;
				case S.BLOCK_HEADER_END: /* FALLTHROUGH */ // block body
				case S.BLOCK_BODY_START:
					switch (z.currentBT) {
						case B.UNCOMPRESSED:
							s = z.u();
							break;
						case B.FIXED:
							s = z.f();
							break;
						case B.DYNAMIC:
							s = z.d();
							break;
					}
					break;
				case S.BLOCK_BODY_END: // decode data
				case S.DECODE_BLOCK_START:
					switch (z.currentBT) {
						case B.UNCOMPRESSED:
							s = z.p();
							break;
						case B.FIXED: /* FALLTHROUGH */
						case B.DYNAMIC:
							s = z.h();
							break;
					}
					break;
				case S.DECODE_BLOCK_END:
					if (z.bfinal) s = T;
					else z.status = S.INITIALIZED;
					break;
			}
		return z.cB();
	}
	/**
	 * parse deflated block. readBlockHeader
	 */
	b() {
		const z = this,
			R = RawInflateStream,
			S = R.S,
			B = Zlib.CT;
		let h = /** @type {number} header */ Zlib.r(3, z);
		z.status = S.BLOCK_HEADER_START;
		z.s();
		if (h < 0) return z.r();
		if (h & 0x1) z.bfinal = T; // BFINAL
		h >>>= 1; // BTYPE
		z.currentBT = h === 0 ? B.UNCOMPRESSED : h === 1 ? B.FIXED : h == 2 ? B.DYNAMIC : ZU.E(`unknown BTYPE: ${h}`);
		z.status = S.BLOCK_HEADER_END;
	}
	/**
	 * read uncompressed block header. readUncompressedBlockHeader
	 */
	u() {
		const z = this,
			i = z.input,
			S = RawInflateStream.S;
		let p = z.ip;
		z.status = S.BLOCK_BODY_START;
		if (p + 4 >= i.length) return T;
		const l = /** @type {number} block length */ i[p++] | (i[p++] << 8),
			n = /** @type {number} number for check block length */ i[p++] | (i[p++] << 8);
		if (l === ~n) ZU.E('invalid uncompressed block header: length verify'); // check len & nlen
		z.bitsbuf = 0; // skip buffered header bits
		z.bitsbuflen = 0;
		z.ip = p;
		z.blockLength = l;
		z.status = S.BLOCK_BODY_END;
	}
	/**
	 * parse uncompressed block. parseUncompressedBlock
	 */
	p() {
		const z = this,
			i = z.input,
			S = RawInflateStream.S;
		let p = z.ip,
			o = z.output,
			q = z.op,
			l = z.blockLength;
		z.status = S.DECODE_BLOCK_START;
		// copy
		// XXX: とりあえず素直にコピー
		while (l--) {
			if (q === o.length) o = RawInflate.e(z, z.litlenTable, { fixRatio: 2 });
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
	 * parse fixed huffman block. parseFixedHuffmanBlock
	 */
	f() {
		const S = RawInflateStream.S;
		this.status = S.BLOCK_BODY_START;
		this.litlenTable = Zlib.FLLT;
		this.distTable = Zlib.FDT;
		this.status = S.BLOCK_BODY_END;
	}
	/**
	 * オブジェクトのコンテキストを別のプロパティに退避する.
	 * @private
	 */
	s() {
		const z = this;
		z.ip_ = z.ip;
		z.bitsbuflen_ = z.bitsbuflen;
		z.bitsbuf_ = z.bitsbuf;
	}
	/**
	 * 別のプロパティに退避したコンテキストを復元する.
	 * @private
	 */
	r(q) {
		const z = this;
		if (!ZU.U(q)) z.op = q;
		z.ip = z.ip_;
		z.bitsbuflen = z.bitsbuflen_;
		z.bitsbuf = z.bitsbuf_;
		return T;
	}
	/**
	 * parse dynamic huffman block. parseDynamicHuffmanBlock
	 */
	d() {
		const z = this,
			Z = Zlib,
			B = Z.r,
			R = RawInflate,
			S = RawInflateStream.S,
			c = /** @type {!(Uint8Array)} code lengths. */ ZU.u8(Z.Order.length);
		z.status = S.BLOCK_BODY_START;
		z.s();
		const hl = /** @type {number} number of literal and length codes. hlit*/ B(5, z) + 257,
			hd = /** @type {number} number of distance codes.hdist */ B(5, z) + 1,
			hc = /** @type {number} number of code lengths. hclen*/ B(4, z) + 4;
		if (hl < 0 || hd < 0 || hc < 0) return z.r();
		try {
			const [a, b] = R.i(z, hl, hd, hc, c);
			// litlenLengths = ZU.u8(hlit); // literal and length code
			// distLengths = ZU.u8(hdist); // distance code
			z.litlenTable = a;
			z.distTable = b;
		} catch (e) {
			return z.r();
		}
		z.status = S.BLOCK_BODY_END;
	}
	/**
	 * decode huffman code (dynamic) decodeHuffman
	 * @return {(number|undefined)} True is error.(for optimise to small foot print.)
	 */
	h() {
		const z = this,
			L = z.litlenTable,
			D = z.distTable,
			R = RawInflate,
			S = RawInflateStream.S,
			Z = Zlib,
			rC = Z.rCBT,
			eB = R.e;
		let o = z.output,
			q = z.op,
			l = o.length;
		z.status = S.DECODE_BLOCK_START;
		while (o) {
			z.s();
			const c = /** @type {number} huffman code. */ rC(L, z);
			if (c < 0) return z.r(q);
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
				const b = Z.r(Z.LET[t], z);
				if (b < 0) return z.r(q);
				d += b;
			}
			const dc = rC(D, z); // dist code
			if (dc < 0) return z.r(q);
			let e = /** @type {number} huffman code distination. */ Z.DCT[dc];
			if (Z.DET[dc] > 0) {
				const b = Z.r(Z.DET[dc], z);
				if (b < 0) return z.r(q);
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
	 * concat output buffer. (dynamic) concatBuf
	 * @return {!(Uint8Array)} output buffer.
	 */
	cB() {
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
		return z.resize ? ZU.u8(p) : p;
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
		z.verify = /** @type {boolean} */ !!opt.verify;
		z.password = /** @type {(Uint8Array)} */ opt.password;
	}
	/** searchEndOfCentralDirectoryRecord */
	sEoCDR() {
		const z = this,
			i = z.input,
			l = i.length,
			v = z.eocdrOffset,
			C = Zip.CDS;
		if (v) return v;
		for (let p = l - 12; p > 0; --p)
			if (i[p] === C[0] && i[p + 1] === C[1] && i[p + 2] === C[2] && i[p + 3] === C[3])
				return (z.eocdrOffset = p);
		ZU.E('End of Central Directory Record not found');
	}
	/** parseEndOfCentralDirectoryRecord */
	pEoCDR() {
		const z = this,
			i = z.input,
			C = Zip.CDS,
			v = z.centralDirectoryOffset;
		if (v) return v;
		let p = z.sEoCDR();
		if (i[p++] !== C[0] || i[p++] !== C[1] || i[p++] !== C[2] || i[p++] !== C[3]) ZU.E('invalid signature'); // signature
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
	/**
	 * parseFileHeader
	 * @param {*} isRetT
	 * @returns
	 */
	pFH(isRetT) {
		const z = this,
			c = z.fileHeaderList,
			t = z.filenameToIndex;
		if (c) return isRetT ? t : c;
		const L = [],
			F = {},
			v = z.pEoCDR(),
			E = z.totalEntries;
		let p = v;
		for (let i = 0; i < E; ++i) {
			const H = new FH(z.input, p);
			p += H.length;
			L[i] = H;
			F[H.filename] = i;
		}
		if (z.centralDirectorySize < p - v) ZU.E('invalid file header size');
		z.fileHeaderList = L;
		z.filenameToIndex = F;
		return isRetT ? F : L;
	}
	/**
	 * getFileData
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
			D = U.d,
			E = ZU.E;
		if (!L) z.pFH();
		if (ZU.U(L[x])) E('wrong index');
		let p = L[x].relativeOffset;
		const H = new LFH(i, p),
			c = H.compression,
			R = H.crc32,
			w = opt.password || z.password;
		p += H.length;
		let l = H.compressedSize;
		if ((H.flags & U.Flags.ENCRYPT) !== 0) {
			if (!w) E('please set password'); // decryption
			const k = U.c(w);
			for (let j = p, J = p + 12; j < J; ++j) D(k, i[j]); // encryption header
			p += 12;
			l -= 12;
			for (let j = p, J = p + l; j < J; ++j) i[j] = D(k, i[j]); // decryption
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
			const r = CRC32.c(b);
			if (R !== r) E(`wrong crc: file=0x${R.toString(16)}, data=0x${r.toString(16)}`);
		}
		return b;
	}
	/**
	 * getFilenames
	 * @return {Array.<string>}
	 */
	getFilenames() {
		const N = [],
			H = this.pFH(),
			l = H.length;
		for (let i = 0; i < l; ++i) N[i] = H[i].filename;
		return N;
	}
	/**
	 * @param {string} fn extract filename.//filename
	 * @param {Object=} opt
	 * @return {!(Uint8Array)} decompressed data.
	 */
	decompress(fn, opt) {
		const z = this,
			n = fn,
			t = z.pFH(T);
		return t[n] >= 0 ? z.getFileData(t[n], opt) : ZU.E(`${n} not found`);
	}
	/**
	 * @param {(Uint8Array)} w
	 */
	setPassword(w) {
		this.password = w;
	}
}
Deflate.CompressionType = Zlib.CT;
RawDeflate.CompressionType = Zlib.CT;
RawInflateStream.BlockType = Zlib.CT;
Zip.CompressionMethod = Zlib.CM;
Unzip.CompressionMethod = Zip.CM;
Zlib.Zip = Zip;
Zlib.Gunzip = Gunzip;
Zlib.Gzip = Gzip;
Zlib.Deflate = Deflate;
Zlib.InflateStream = InflateStream;
Zlib.Inflate = Inflate;
Zlib.RawDeflate = RawDeflate;
Zlib.RawInflateStream = RawInflateStream;
Zlib.RawInflate = RawInflate;
Zlib.Unzip = Unzip;
