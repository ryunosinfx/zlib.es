export class GunzipMember {
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
