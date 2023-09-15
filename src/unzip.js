import { RawInflate } from './rawinflate.js';
import { CRC32 } from './crc32.js';
import { Zip } from './zip.js';
export class Unzip extends Zip {
	/**
	 * @param {!(Uint8Array)} input input buffer.
	 * @param {Object=} opt_params options.
	 * @constructor
	 */
	constructor(input, opt_params = {}) {
		super();
		this.input = /** @type {!(Uint8Array)} */ input instanceof Array ? new Uint8Array(input) : input;
		this.ip = /** @type {number} */ 0;
		this.eocdrOffset = /** @type {number} */ void 0;
		this.numberOfThisDisk = /** @type {number} */ void 0;
		this.startDisk = /** @type {number} */ void 0;
		this.totalEntriesThisDisk = /** @type {number} */ void 0;
		this.totalEntries = /** @type {number} */ void 0;
		this.centralDirectorySize = /** @type {number} */ void 0;
		this.centralDirectoryOffset = /** @type {number} */ void 0;
		this.commentLength = /** @type {number} */ void 0;
		this.comment = /** @type {(Uint8Array)} */ void 0;
		this.fileHeaderList = /** @type {Array.<Zlib.Unzip.FileHeader>} */ void 0;
		this.filenameToIndex = /** @type {Object.<string, number>} */ void 0;
		this.verify = /** @type {boolean} */ opt_params.verify || false;
		this.password = /** @type {(Uint8Array)} */ opt_params.password;
	}
	static CompressionMethod = Zip.CompressionMethod;
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
		const input = this.input;
		for (let ip = input.length - 12; ip > 0; --ip) {
			if (
				input[ip] === Unzip.CentralDirectorySignature[0] &&
				input[ip + 1] === Unzip.CentralDirectorySignature[1] &&
				input[ip + 2] === Unzip.CentralDirectorySignature[2] &&
				input[ip + 3] === Unzip.CentralDirectorySignature[3]
			) {
				this.eocdrOffset = ip;
				return;
			}
		}
		throw new Error('End of Central Directory Record not found');
	}
	parseEndOfCentralDirectoryRecord() {
		const input = this.input;
		if (!this.eocdrOffset) this.searchEndOfCentralDirectoryRecord();
		let ip = this.eocdrOffset;
		if (
			input[ip++] !== Unzip.CentralDirectorySignature[0] ||
			input[ip++] !== Unzip.CentralDirectorySignature[1] ||
			input[ip++] !== Unzip.CentralDirectorySignature[2] ||
			input[ip++] !== Unzip.CentralDirectorySignature[3]
		) {
			throw new Error('invalid signature'); // signature
		}
		this.numberOfThisDisk = input[ip++] | (input[ip++] << 8); // number of this disk
		this.startDisk = input[ip++] | (input[ip++] << 8); // number of the disk with the start of the central directory
		this.totalEntriesThisDisk = input[ip++] | (input[ip++] << 8); // total number of entries in the central directory on this disk
		this.totalEntries = input[ip++] | (input[ip++] << 8); // total number of entries in the central directory
		this.centralDirectorySize =
			(input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24)) >>> 0; // size of the central directory
		this.centralDirectoryOffset =
			(input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24)) >>> 0; // offset of start of central directory with respect to the starting disk number
		this.commentLength = input[ip++] | (input[ip++] << 8); // .ZIP file comment length
		this.comment = input.subarray(ip, ip + this.commentLength); // .ZIP file comment
	}
	parseFileHeader() {
		const filelist = [];
		const filetable = {};
		if (this.fileHeaderList) return;
		if (this.centralDirectoryOffset === void 0) this.parseEndOfCentralDirectoryRecord();
		let ip = this.centralDirectoryOffset;
		for (let i = 0, il = this.totalEntries; i < il; ++i) {
			const fileHeader = new FileHeader(this.input, ip);
			ip += fileHeader.length;
			filelist[i] = fileHeader;
			filetable[fileHeader.filename] = i;
		}
		if (this.centralDirectorySize < ip - this.centralDirectoryOffset) throw new Error('invalid file header size');
		this.fileHeaderList = filelist;
		this.filenameToIndex = filetable;
	}
	/**
	 * @param {number} index file header index.
	 * @param {Object=} opt_params
	 * @return {!(Uint8Array)} file data.
	 */
	getFileData(index, opt_params = {}) {
		const input = this.input;
		const fileHeaderList = this.fileHeaderList;
		if (!fileHeaderList) this.parseFileHeader();
		if (fileHeaderList[index] === void 0) throw new Error('wrong index');
		let offset = fileHeaderList[index].relativeOffset;
		const localFileHeader = new LocalFileHeader(this.input, offset);
		offset += localFileHeader.length;
		let length = localFileHeader.compressedSize;
		if ((localFileHeader.flags & LocalFileHeader.Flags.ENCRYPT) !== 0) {
			if (!(opt_params.password || this.password)) throw new Error('please set password'); // decryption
			const key = this.createDecryptionKey(opt_params.password || this.password);
			for (let i = offset, il = offset + 12; i < il; ++i) this.decode(key, input[i]); // encryption header
			offset += 12;
			length -= 12;
			for (let i = offset, il = offset + length; i < il; ++i) input[i] = this.decode(key, input[i]); // decryption
		}
		let buffer;
		switch (localFileHeader.compression) {
			case Unzip.CompressionMethod.STORE:
				buffer = this.input.subarray(offset, offset + length);
				break;
			case Unzip.CompressionMethod.DEFLATE:
				buffer = new RawInflate(this.input, {
					index: offset,
					bufferSize: localFileHeader.plainSize,
				}).decompress();
				break;
			default:
				throw new Error('unknown compression type');
		}
		if (this.verify) {
			const crc32 = CRC32.calc(buffer);
			if (localFileHeader.crc32 !== crc32)
				throw new Error(
					`wrong crc: file=0x${localFileHeader.crc32.toString(16)}, data=0x${crc32.toString(16)}`
				);
		}
		return buffer;
	}
	/**
	 * @return {Array.<string>}
	 */
	getFilenames() {
		const filenameList = [];
		if (!this.fileHeaderList) this.parseFileHeader();
		const fileHeaderList = this.fileHeaderList;
		for (let i = 0, il = fileHeaderList.length; i < il; ++i) filenameList[i] = fileHeaderList[i].filename;
		return filenameList;
	}
	/**
	 * @param {string} filename extract filename.
	 * @param {Object=} opt_params
	 * @return {!(Uint8Array)} decompressed data.
	 */
	decompress(filename, opt_params) {
		if (!this.filenameToIndex) this.parseFileHeader();
		const index = this.filenameToIndex[filename];
		if (index === void 0) throw new Error(`${filename} not found`);
		return this.getFileData(index, opt_params);
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
	decode(key, n) {
		n ^= this.getByte(/** @type {(Uint32Array)} */ (key));
		this.updateKeys(/** @type {(Uint32Array)} */ (key), n);
		return n;
	}
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
		const input = this.input;
		let ip = this.offset;
		if (
			input[ip++] !== Unzip.FileHeaderSignature[0] ||
			input[ip++] !== Unzip.FileHeaderSignature[1] ||
			input[ip++] !== Unzip.FileHeaderSignature[2] ||
			input[ip++] !== Unzip.FileHeaderSignature[3]
		)
			throw new Error('invalid file header signature'); // central file header signature
		this.version = input[ip++]; // version made by
		this.os = input[ip++];
		this.needVersion = input[ip++] | (input[ip++] << 8); // version needed to extract
		this.flags = input[ip++] | (input[ip++] << 8); // general purpose bit flag
		this.compression = input[ip++] | (input[ip++] << 8); // compression method
		this.time = input[ip++] | (input[ip++] << 8); // last mod file time
		this.date = input[ip++] | (input[ip++] << 8); //last mod file date
		this.crc32 = (input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24)) >>> 0; // crc-32
		this.compressedSize = (input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24)) >>> 0; // compressed size
		this.plainSize = (input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24)) >>> 0; // uncompressed size
		this.fileNameLength = input[ip++] | (input[ip++] << 8); // file name length
		this.extraFieldLength = input[ip++] | (input[ip++] << 8); // extra field length
		this.fileCommentLength = input[ip++] | (input[ip++] << 8); // file comment length
		this.diskNumberStart = input[ip++] | (input[ip++] << 8); // disk number start
		this.internalFileAttributes = input[ip++] | (input[ip++] << 8); // internal file attributes
		this.externalFileAttributes = input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24); // external file attributes
		this.relativeOffset = (input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24)) >>> 0; // relative offset of local header
		this.filename = String.fromCharCode.apply(null, input.subarray(ip, (ip += this.fileNameLength))); // file name
		this.extraField = input.subarray(ip, (ip += this.extraFieldLength)); // extra field
		this.comment = input.subarray(ip, ip + this.fileCommentLength); // file comment
		this.length = ip - this.offset;
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
		const input = this.input;
		let ip = /** @type {number} */ 0;
		if (
			input[ip++] !== Unzip.LocalFileHeaderSignature[0] ||
			input[ip++] !== Unzip.LocalFileHeaderSignature[1] ||
			input[ip++] !== Unzip.LocalFileHeaderSignature[2] ||
			input[ip++] !== Unzip.LocalFileHeaderSignature[3]
		)
			throw new Error('invalid local file header signature'); // local file header signature
		this.needVersion = input[ip++] | (input[ip++] << 8); // version needed to extract
		this.flags = input[ip++] | (input[ip++] << 8); // general purpose bit flag
		this.compression = input[ip++] | (input[ip++] << 8); // compression method
		this.time = input[ip++] | (input[ip++] << 8); // last mod file time
		this.date = input[ip++] | (input[ip++] << 8); //last mod file date
		this.crc32 = (input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24)) >>> 0; // crc-32
		this.compressedSize = (input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24)) >>> 0; // compressed size
		this.plainSize = (input[ip++] | (input[ip++] << 8) | (input[ip++] << 16) | (input[ip++] << 24)) >>> 0; // uncompressed size
		this.fileNameLength = input[ip++] | (input[ip++] << 8); // file name length
		this.extraFieldLength = input[ip++] | (input[ip++] << 8); // extra field length
		this.filename = String.fromCharCode.apply(null, input.subarray(ip, (ip += this.fileNameLength))); // file name
		this.extraField = input.subarray(ip, (ip += this.extraFieldLength)); // extra field
		this.length = ip - this.offset;
	}
}
