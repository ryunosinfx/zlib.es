/**
 * @fileoverview GZIP (RFC1952) 展開コンテナ実装.
 */
import { CRC32 } from './crc32.js';
import { Gzip } from './gzip.js';
import { RawInflate } from './rawinflate.js';
import { GunzipMember } from './gunzip_member.js';
export class Gunzip {
	/**
	 * @constructor
	 * @param {!(Array|Uint8Array)} input input buffer.
	 * @param {Object=} opt_params option parameters.
	 */
	constructor(input, opt_params) {
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
	 * @return {!(Array.<number>|Uint8Array)} inflated buffer.
	 */
	decompress() {
		const il = this.input.length; //input length.
		while (this.ip < il) this.decodeMember();
		this.decompressed = true;
		return this.concatMember();
	}
	/**
	 * decode gzip member.
	 */
	decodeMember() {
		const member = /** @type {Zlib.GunzipMember} */ new GunzipMember();
		/** @type {number} character code */
		let c;
		const input = this.input;
		let ip = this.ip;
		member.id1 = input[ip++];
		member.id2 = input[ip++];
		if (member.id1 !== 0x1f || member.id2 !== 0x8b)
			throw new Error(`invalid file signature:${member.id1},${member.id2}`); // check signature
		member.cm = input[ip++]; // check compression method
		switch (member.cm) {
			case 8 /* XXX: use Zlib const */:
				break;
			default:
				throw new Error(`unknown compression method: ${member.cm}`);
		}
		member.flg = input[ip++]; // flags
		const mtime = input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24); // modification time
		member.mtime = new Date(mtime * 1000);
		member.xfl = input[ip++]; // extra flags
		member.os = input[ip++]; // operating system
		if ((member.flg & Gzip.FlagsMask.FEXTRA) > 0) {
			member.xlen = input[ip++] | (input[ip++] << 8); // extra
			ip = this.decodeSubField(ip, member.xlen);
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
			if (member.crc16 !== (input[ip++] | (input[ip++] << 8))) throw new Error('invalid header crc16');
		}
		// isize を事前に取得すると展開後のサイズが分かるため、
		// inflate処理のバッファサイズが事前に分かり、高速になる
		const isize =
			input[input.length - 4] |
			(input[input.length - 3] << 8) |
			(input[input.length - 2] << 16) |
			(input[input.length - 1] << 24);
		// isize の妥当性チェック
		// ハフマン符号では最小 2-bit のため、最大で 1/4 になる
		// LZ77 符号では 長さと距離 2-Byte で最大 258-Byte を表現できるため、
		// 1/128 になるとする
		// ここから入力バッファの残りが isize の 512 倍以上だったら
		// サイズ指定のバッファ確保は行わない事とする
		const bufferSize = input.length - ip - /* CRC-32 */ 4 - /* ISIZE */ 4 < isize * 512 ? isize : void 0; // inflate size
		const rawinflate = new RawInflate(input, { index: ip, bufferSize }); // compressed block // RawInflate implementation.
		const inflated = rawinflate.decompress(); // inflated data.
		member.data = inflated;
		let ipr = rawinflate.ip;
		const crc32 = (input[ipr++] | (input[ipr++] << 8) | (input[ipr++] << 16) | (input[ipr++] << 24)) >>> 0; // crc32
		member.crc32 = crc32;
		if (CRC32.calc(inflated) !== crc32)
			throw new Error(
				'invalid CRC-32 checksum: 0x' + CRC32.calc(inflated).toString(16) + ' / 0x' + crc32.toString(16)
			);
		const isize2 = (input[ipr++] | (input[ipr++] << 8) | (input[ipr++] << 16) | (input[ipr++] << 24)) >>> 0; // input size
		member.isize = isize2;
		if ((inflated.length & 0xffffffff) !== isize2)
			throw new Error('invalid input size: ' + (inflated.length & 0xffffffff) + ' / ' + isize2);
		this.member.push(member);
		this.ip = ipr;
	}
	/**
	 * サブフィールドのデコード
	 * XXX: 現在は何もせずスキップする
	 */
	decodeSubField(ip, length) {
		return ip + length;
	}
	/**
	 * @return {!(Array.<number>|Uint8Array)}
	 */
	concatMember() {
		const members = /** @type {Array.<Zlib.GunzipMember>} */ this.member;
		let p = 0;
		let size = 0;
		for (const member of members) size += member.data.length;
		const buffer = new Uint8Array(size);
		for (const member of members) {
			buffer.set(member.data, p);
			p += member.data.length;
		}
		return buffer;
	}
}
