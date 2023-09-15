/**
 * @fileoverview Heap Sort 実装. ハフマン符号化で使用する.
 */
export class Heap {
	/**
	 * カスタムハフマン符号で使用するヒープ実装
	 * @param {number} length ヒープサイズ.
	 * @constructor
	 */
	constructor(length) {
		this.buffer = new Uint16Array(length * 2);
		this.length = 0;
	}
	/**
	 * 親ノードの index 取得
	 * @param {number} index 子ノードの index.
	 * @return {number} 親ノードの index.
	 *
	 */
	getParent(index) {
		return (((index - 2) / 4) | 0) * 2;
	}
	/**
	 * 子ノードの index 取得
	 * @param {number} index 親ノードの index.
	 * @return {number} 子ノードの index.
	 */
	getChild(index) {
		return 2 * index + 2;
	}
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
			const parent = this.getParent(current); // 親ノードと比較して親の方が小さければ入れ替える
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
		const heap = this.buffer;
		const value = heap[0];
		const index = heap[1];
		this.length -= 2; // 後ろから値を取る
		heap[0] = heap[this.length];
		heap[1] = heap[this.length + 1];
		let parent = 0; // ルートノードから下がっていく
		while (heap) {
			let current = this.getChild(parent);
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
		return { index, value, length: this.length };
	}
}
