export class Huffman {
	/**
	 * build huffman table from length list.
	 * @param {!(Uint8Array)} lengths length list.
	 * @return {!Array} huffman table.
	 */
	static buildHuffmanTable(lengths) {
		const listSize = /** @type {number} length list size. */ lengths.length;
		let maxCodeLength = /** @type {number} max code length for table size. */ 0;
		let minCodeLength = /** @type {number} min code length for table size. */ Number.POSITIVE_INFINITY;
		for (const length of lengths) {
			if (length > maxCodeLength) maxCodeLength = length; // Math.max は遅いので最長の値は for-loop で取得する
			if (length < minCodeLength) minCodeLength = length;
		}
		const size = 1 << maxCodeLength; //table size.
		const table = new Uint32Array(size); //huffman code table.
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
					const value = (bitLength << 16) | i;
					for (let j = reversed; j < size; j += skip) table[j] = value;
					++code;
				}
			++bitLength; //bit length.// 次のビット長へ
			code <<= 1; //huffman code.
			skip <<= 1; //サイズが 2^maxlength 個のテーブルを埋めるためのスキップ長.
		}
		return [table, maxCodeLength, minCodeLength];
	}
}
