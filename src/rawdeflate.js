/**
 * @fileoverview Deflate (RFC1951) 符号化アルゴリズム実装.
 */
import { BitStream } from './bitstream.js';
import { Heap } from './heap.js';
export class RawDeflate {
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
	/**
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
		const table = [];
		for (let i = 0; i < 288; i++)
			switch (true) {
				case i <= 143:
					table.push([i + 0x030, 8]);
					break;
				case i <= 255:
					table.push([i - 144 + 0x190, 9]);
					break;
				case i <= 279:
					table.push([i - 256 + 0x000, 7]);
					break;
				case i <= 287:
					table.push([i - 280 + 0x0c0, 8]);
					break;
				default:
					throw `invalid literal: ${i}`;
			}
		return table;
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
		this.compressionType = /** @type {Zlib.RawDeflate.CompressionType} */ RawDeflate.CompressionType.DYNAMIC;
		this.lazy = /** @type {number} */ 0;
		this.input = /** @type {!(Uint8Array)} */ input instanceof Array ? new Uint8Array(input) : input;
		this.op = /** @type {number} pos output buffer position. */ 0;
		if (opt_params) {
			if (opt_params.lazy) this.lazy = opt_params.lazy; // option parameters
			if (typeof opt_params.compressionType === 'number') this.compressionType = opt_params.compressionType;
			if (opt_params.outputBuffer)
				this.output =
					opt_params.outputBuffer instanceof Array
						? new Uint8Array(opt_params.outputBuffer)
						: opt_params.outputBuffer;
			if (typeof opt_params.outputIndex === 'number') this.op = opt_params.outputIndex;
		}
		if (!this.output) this.output = new Uint8Array(0x8000);
	}
	/**
	 * DEFLATE ブロックの作成
	 * @return {!(Uint8Array)} 圧縮済み byte array.
	 */
	ompress() {
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
				throw 'invalid compression type';
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
		let op = this.op;
		let byteLength = this.output.buffer.byteLength;
		const terget = op + blockArray.length + 5;
		while (byteLength <= terget) byteLength = byteLength << 1; // expand buffer
		const output = new Uint8Array(byteLength);
		output.set(this.output);
		const bfinal = isFinalBlock ? 1 : 0; // header
		const btype = RawDeflate.CompressionType.NONE;
		output[op++] = bfinal | (btype << 1);
		const len = blockArray.length; // length
		const nlen = (~len + 0x10000) & 0xffff;
		output[op++] = len & 0xff;
		output[op++] = (len >>> 8) & 0xff;
		output[op++] = nlen & 0xff;
		output[op++] = (nlen >>> 8) & 0xff;
		output.set(blockArray, op); // copy buffer
		op += blockArray.length;
		const subarray = output.subarray(0, op);
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
		const stream = new BitStream(new Uint8Array(this.output.buffer), this.op);
		const bfinal = isFinalBlock ? 1 : 0; // header
		const btype = RawDeflate.CompressionType.FIXED;
		stream.writeBits(bfinal, 1, true);
		stream.writeBits(btype, 2, true);
		const data = this.lz77(blockArray);
		this.fixedHuffman(data, stream);
		return stream.finish();
	}
	/**
	 * 動的ハフマンブロックの作成
	 * @param {!(Uint8Array)} blockArray ブロックデータ byte array.
	 * @param {!boolean} isFinalBlock 最後のブロックならばtrue.
	 * @return {!(Uint8Array)} 動的ハフマン符号ブロック byte array.
	 */
	makeDynamicHuffmanBlock(blockArray, isFinalBlock) {
		const stream = new BitStream(new Uint8Array(this.output.buffer), this.op);
		/** @type {number} */
		let hlit;
		/** @type {number} */
		let hdist;
		/** @type {number} */
		let hclen;
		/** @const @type {Array.<number>} */
		const hclenOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
		const bfinal = isFinalBlock ? 1 : 0; // header
		const transLengths = /** @type {Array} */ new Array(19);
		const btype = RawDeflate.CompressionType.DYNAMIC;
		stream.writeBits(bfinal, 1, true);
		stream.writeBits(btype, 2, true);
		const data = this.lz77(blockArray);
		const litLenLengths = this.getLengths_(this.freqsLitLen, 15); // リテラル・長さ, 距離のハフマン符号と符号長の算出
		const litLenCodes = this.getCodesFromLengths_(litLenLengths);
		const distLengths = this.getLengths_(this.freqsDist, 7);
		const distCodes = this.getCodesFromLengths_(distLengths);
		for (hlit = 286; hlit > 257 && litLenLengths[hlit - 1] === 0; ) hlit--; // HLIT の決定
		for (hdist = 30; hdist > 1 && distLengths[hdist - 1] === 0; ) hdist--; // HDIST の決定
		/** @type {{
		 *   codes: !(Uint32Array),
		 *   freqs: !(Uint8Array)
		 * }} */
		const treeSymbols = this.getTreeSymbols_(hlit, litLenLengths, hdist, distLengths); // HCLEN
		const treeLengths = this.getLengths_(treeSymbols.freqs, 7);
		for (let i = 0; i < 19; i++) transLengths[i] = treeLengths[hclenOrder[i]];
		for (hclen = 19; hclen > 4 && transLengths[hclen - 1] === 0; ) hclen--;
		const treeCodes = this.getCodesFromLengths_(treeLengths);
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
						throw `invalid code: ${code}`;
				}
				stream.writeBits(code, bitlen, true);
			}
		}
		this.dynamicHuffman(data, [litLenCodes, litLenLengths], [distCodes, distLengths], stream);
		return stream.finish();
	}
	/**
	 * 動的ハフマン符号化(カスタムハフマンテーブル)
	 * @param {!(Uint16Array)} dataArray LZ77 符号化済み byte array.
	 * @param {!Zlib.BitStream} stream 書き込み用ビットストリーム.
	 * @return {!Zlib.BitStream} ハフマン符号化済みビットストリームオブジェクト.
	 */
	dynamicHuffman(dataArray, litLen, dist, stream) {
		const litLenCodes = litLen[0];
		const litLenLengths = litLen[1];
		const distCodes = dist[0];
		const distLengths = dist[1];
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
	 * @param {!Zlib.BitStream} stream 書き込み用ビットストリーム.
	 * @return {!Zlib.BitStream} ハフマン符号化済みビットストリームオブジェクト.
	 */
	fixedHuffman(dataArray, stream) {
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
		const table = /** @type {Object.<number, Array.<number>>} chained-hash-table */ {};
		const windowSize = /** @const @type {number} */ RawDeflate.WindowSize;
		let prevMatch;
		const lz77buf = /** @type {!(Uint16Array)} lz77 buffer */ new Uint16Array(dataArray.length * 2);
		let pos = /** @type {number} lz77 output buffer pointer */ 0;
		let skipLength = /** @type {number} lz77 skip length */ 0;
		/** @type {!(Uint32Array)} */
		const freqsLitLen = new Uint32Array(286);
		/** @type {!(Uint32Array)} */
		const freqsDist = new Uint32Array(30);
		/** @type {number} */
		const lazy = this.lazy;
		freqsLitLen[256] = 1; // EOB の最低出現回数は 1
		/**
		 * マッチデータの書き込み
		 * @param {Zlib.RawDeflate.Lz77Match} match LZ77 Match data.
		 * @param {!number} offset スキップ開始位置(相対指定).
		 * @private
		 */
		function writeMatch(match, offset) {
			/** @type {Array.<number>} */
			const lz77Array = match.toLz77Array();
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
			if (table[matchKey] === void 0) table[matchKey] = []; // テーブルが未定義だったら作成する
			const matchList = table[matchKey];
			if (skipLength-- > 0) {
				matchList.push(position); // skip
				continue;
			}
			while (matchList.length > 0 && position - matchList[0] > windowSize) {
				matchList.shift(); // マッチテーブルの更新 (最大戻り距離を超えているものを削除する)
			}
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
				const longestMatch = this.searchLongestMatch_(dataArray, position, matchList); // マッチ候補から最長のものを探す
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
		return /** @type {!(Uint16Array|Array.<number>)} */ lz77buf.subarray(0, pos);
	}
	/**
	 * マッチした候補の中から最長一致を探す
	 * @param {!Object} data plain data byte array.
	 * @param {!number} position plain data byte array position.
	 * @param {!Array.<number>} matchList 候補となる位置の配列.
	 * @return {!Zlib.RawDeflate.Lz77Match} 最長かつ最短距離のマッチオブジェクト.
	 * @private
	 */
	searchLongestMatch_(data, position, matchList) {
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
	getTreeSymbols_(hlit, litlenLengths, hdist, distLengths) {
		const srcLen = hlit + hdist;
		const src = new Uint32Array(srcLen),
			result = new Uint32Array(286 + 30),
			freqs = new Uint8Array(19);
		let j = 0;
		for (let i = 0; i < hlit; i++) src[j++] = litlenLengths[i];
		for (let i = 0; i < hdist; i++) src[j++] = distLengths[i];
		let nResult = 0; // 符号化
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
	getLengths_(freqs, limit) {
		const nSymbols = /** @type {number} */ freqs.length;
		const heap = /** @type {Zlib.Heap} */ new Heap(2 * RawDeflate.HUFMAX);
		const length = /** @type {!(Uint8Array)} */ new Uint8Array(nSymbols);
		const heapHalfLen = heap.length / 2;
		for (let i = 0; i < nSymbols; ++i) if (freqs[i] > 0) heap.push(i, freqs[i]); // ヒープの構築
		const nodes = new Array(heapHalfLen);
		const values = new Uint32Array(heapHalfLen);
		if (nodes.length === 1) {
			length[heap.pop().index] = 1; // 非 0 の要素が一つだけだった場合は、そのシンボルに符号長 1 を割り当てて終了
			return length;
		}
		for (let i = 0; i < heapHalfLen; ++i) {
			nodes[i] = heap.pop(); // Reverse Package Merge Algorithm による Canonical Huffman Code の符号長決定
			values[i] = nodes[i].value;
		}
		const codeLength = this.reversePackageMerge_(values, values.length, limit);
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
	reversePackageMerge_(freqs, symbols, limit) {
		const limitM1 = limit - 1;
		const minimumCost = /** @type {!(Uint16Array)} */ new Uint16Array(limit);
		const flag = /** @type {!(Uint8Array)} */ new Uint8Array(limit);
		const codeLength = /** @type {!(Uint8Array)} */ new Uint8Array(symbols);
		const value = /** @type {Array} */ new Array(limit);
		const type = /** @type {Array} */ new Array(limit);
		const currentPosition = /** @type {Array.<number>} */ new Array(limit);
		let excess = /** @type {number} */ (1 << limit) - symbols;
		const half = /** @type {number} */ 1 << limitM1;
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
		value[0] = new Array(minimumCost[0]);
		type[0] = new Array(minimumCost[0]);
		for (let j = 1; j < limit; ++j) {
			if (minimumCost[j] > 2 * minimumCost[j - 1] + flag[j]) minimumCost[j] = 2 * minimumCost[j - 1] + flag[j];
			value[j] = new Array(minimumCost[j]);
			type[j] = new Array(minimumCost[j]);
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
			let i = 0;
			let next = currentPosition[j + 1];
			const valueJ0 = value[j];
			const valueJ1 = value[j + 1];
			const typeJ = type[j];
			const minimumCostJ = minimumCost[j];
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
	getCodesFromLengths_(lengths) {
		const il = lengths.length;
		const codes = new Uint16Array(il),
			count = [],
			startCode = [];
		let code = 0;
		for (const len of lengths) count[len] = (count[len] | 0) + 1; // Count the codes of each length.
		for (let i = 1; i <= RawDeflate.MaxCodeLength; i++) {
			startCode[i] = code; // Determine the starting code for each length block.
			code += count[i] | 0;
			code <<= 1;
		}
		for (let i = 0; i < il; i++) {
			const len = lengths[i]; // Determine the code for each symbol. Mirrored, of course.
			let code = startCode[len];
			startCode[len] += 1;
			codes[i] = 0;
			for (let j = 0; j < len; j++) {
				codes[i] = (codes[i] << 1) | (code & 1);
				code >>>= 1;
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
		const table = /** @type {!Array} */ [];
		for (let i = 3; i <= 258; i++) {
			const c = Lz77Match.code(i);
			table[i] = (c[2] << 24) | (c[1] << 16) | c[0];
		}
		return new Uint32Array(table);
	}
	/**
	 * @param {number} length lz77 length.
	 * @return {!Array.<number>} lz77 codes.
	 */
	static code(length) {
		switch (true) {
			case length === 3:
				return [257, length - 3, 0];
			case length === 4:
				return [258, length - 4, 0];
			case length === 5:
				return [259, length - 5, 0];
			case length === 6:
				return [260, length - 6, 0];
			case length === 7:
				return [261, length - 7, 0];
			case length === 8:
				return [262, length - 8, 0];
			case length === 9:
				return [263, length - 9, 0];
			case length === 10:
				return [264, length - 10, 0];
			case length <= 12:
				return [265, length - 11, 1];
			case length <= 14:
				return [266, length - 13, 1];
			case length <= 16:
				return [267, length - 15, 1];
			case length <= 18:
				return [268, length - 17, 1];
			case length <= 22:
				return [269, length - 19, 2];
			case length <= 26:
				return [270, length - 23, 2];
			case length <= 30:
				return [271, length - 27, 2];
			case length <= 34:
				return [272, length - 31, 2];
			case length <= 42:
				return [273, length - 35, 3];
			case length <= 50:
				return [274, length - 43, 3];
			case length <= 58:
				return [275, length - 51, 3];
			case length <= 66:
				return [276, length - 59, 3];
			case length <= 82:
				return [277, length - 67, 4];
			case length <= 98:
				return [278, length - 83, 4];
			case length <= 114:
				return [279, length - 99, 4];
			case length <= 130:
				return [280, length - 115, 4];
			case length <= 162:
				return [281, length - 131, 5];
			case length <= 194:
				return [282, length - 163, 5];
			case length <= 226:
				return [283, length - 195, 5];
			case length <= 257:
				return [284, length - 227, 5];
			case length === 258:
				return [285, length - 258, 0];
			default:
				throw `invalid length: ${length}`;
		}
	}
	/**
	 * 距離符号テーブル
	 * @param {!number} dist 距離.
	 * @return {!Array.<number>} コード、拡張ビット、拡張ビット長の配列.
	 * @private
	 */
	getDistanceCode_(dist) {
		switch (true) {
			case dist === 1:
				return [0, dist - 1, 0];
			case dist === 2:
				return [1, dist - 2, 0];
			case dist === 3:
				return [2, dist - 3, 0];
			case dist === 4:
				return [3, dist - 4, 0];
			case dist <= 6:
				return [4, dist - 5, 1];
			case dist <= 8:
				return [5, dist - 7, 1];
			case dist <= 12:
				return [6, dist - 9, 2];
			case dist <= 16:
				return [7, dist - 13, 2];
			case dist <= 24:
				return [8, dist - 17, 3];
			case dist <= 32:
				return [9, dist - 25, 3];
			case dist <= 48:
				return [10, dist - 33, 4];
			case dist <= 64:
				return [11, dist - 49, 4];
			case dist <= 96:
				return [12, dist - 65, 5];
			case dist <= 128:
				return [13, dist - 97, 5];
			case dist <= 192:
				return [14, dist - 129, 6];
			case dist <= 256:
				return [15, dist - 193, 6];
			case dist <= 384:
				return [16, dist - 257, 7];
			case dist <= 512:
				return [17, dist - 385, 7];
			case dist <= 768:
				return [18, dist - 513, 8];
			case dist <= 1024:
				return [19, dist - 769, 8];
			case dist <= 1536:
				return [20, dist - 1025, 9];
			case dist <= 2048:
				return [21, dist - 1537, 9];
			case dist <= 3072:
				return [22, dist - 2049, 10];
			case dist <= 4096:
				return [23, dist - 3073, 10];
			case dist <= 6144:
				return [24, dist - 4097, 11];
			case dist <= 8192:
				return [25, dist - 6145, 11];
			case dist <= 12288:
				return [26, dist - 8193, 12];
			case dist <= 16384:
				return [27, dist - 12289, 12];
			case dist <= 24576:
				return [28, dist - 16385, 13];
			case dist <= 32768:
				return [29, dist - 24577, 13];
			default:
				throw 'invalid distance';
		}
	}
	/**
	 * マッチ情報を LZ77 符号化配列で返す.
	 * なお、ここでは以下の内部仕様で符号化している
	 * [ CODE, EXTRA-BIT-LEN, EXTRA, CODE, EXTRA-BIT-LEN, EXTRA ]
	 * @return {!Array.<number>} LZ77 符号化 byte array.
	 */
	toLz77Array() {
		const codeArray = [];
		let pos = 0;
		const code1 = Lz77Match.LengthCodeTable[this.length]; // length
		codeArray[pos++] = code1 & 0xffff;
		codeArray[pos++] = (code1 >> 16) & 0xff;
		codeArray[pos++] = code1 >> 24;
		const code2 = this.getDistanceCode_(this.backwardDistance); // distance
		codeArray[pos++] = code2[0];
		codeArray[pos++] = code2[1];
		codeArray[pos++] = code2[2];
		return codeArray;
	}
}
