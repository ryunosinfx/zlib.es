goog.provide('Zlib.GunzipMember');

export class GunzipMember {
	constructor() {
		/** @type {number} signature first byte. */
		this.id1;
		/** @type {number} signature second byte. */
		this.id2;
		/** @type {number} compression method. */
		this.cm;
		/** @type {number} flags. */
		this.flg;
		/** @type {Date} modification time. */
		this.mtime;
		/** @type {number} extra flags. */
		this.xfl;
		/** @type {number} operating system number. */
		this.os;
		/** @type {number} CRC-16 value for FHCRC flag. */
		this.crc16;
		/** @type {number} extra length. */
		this.xlen;
		/** @type {number} CRC-32 value for verification. */
		this.crc32;
		/** @type {number} input size modulo 32 value. */
		this.isize;
		/** @type {string} filename. */
		this.name;
		/** @type {string} comment. */
		this.comment;
		/** @type {!(Uint8Array|Array.<number>)} */
		this.data;
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
