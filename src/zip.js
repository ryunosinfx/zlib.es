import { CRC32 } from './crc32.js';
import { RawDeflate } from './rawdeflate.js';
export class Zip {
	/**
	 * @enum {number}
	 */
	static CompressionMethod = {
		STORE: 0,
		DEFLATE: 8,
	};
	/**
	 * @enum {number}
	 */
	static OperatingSystem = {
		MSDOS: 0,
		UNIX: 3,
		MACINTOSH: 7,
	};
	/**
	 * @enum {number}
	 */
	static Flags = {
		ENCRYPT: 0x0001,
		DESCRIPTOR: 0x0008,
		UTF8: 0x0800,
	};
	/**
	 * @type {Array.<number>}
	 * @const
	 */
	static FileHeaderSignature = [0x50, 0x4b, 0x01, 0x02];
	/**
	 * @type {Array.<number>}
	 * @const
	 */
	static LocalFileHeaderSignature = [0x50, 0x4b, 0x03, 0x04];
	/**
	 * @type {Array.<number>}
	 * @const
	 */
	static CentralDirectorySignature = [0x50, 0x4b, 0x05, 0x06];
	/**
	 * @param {Object=} opt_params options.
	 * @constructor
	 */
	constructor(opt_params = {}) {
		/** @type {Array.<{
		 *   buffer: !(Uint8Array),
		 *   option: Object,
		 *   compressed: boolean,
		 *   encrypted: boolean,
		 *   size: number,
		 *   crc32: number
		 * }>} */
		this.files = [];
		this.comment = /** @type {(Uint8Array)} */ opt_params.comment;
		this.password = /** @type {(Uint8Array)} */ void 0;
	}
	/**
	 * @param {Uint8Array} input
	 * @param {Object=} opt_params options.
	 */
	addFile(input, opt_params = {}) {
		const filename = /** @type {string} */ opt_params.filename ? opt_params.filename : '';
		let compressed = /** @type {boolean} */ false;
		let crc32 = /** @type {number} */ 0;
		let buffer = input instanceof Array ? new Uint8Array(input) : input;
		if (typeof opt_params.compressionMethod !== 'number')
			opt_params.compressionMethod = Zip.CompressionMethod.DEFLATE; // default// その場で圧縮する場合
		if (opt_params.compress)
			switch (opt_params.compressionMethod) {
				case Zip.CompressionMethod.STORE:
					break;
				case Zip.CompressionMethod.DEFLATE:
					crc32 = CRC32.calc(buffer);
					buffer = this.deflateWithOption(buffer, opt_params);
					compressed = true;
					break;
				default:
					throw new Error(`unknown compression method:${opt_params.compressionMethod}`);
			}
		this.files.push({
			buffer,
			option: opt_params,
			compressed,
			encrypted: false,
			size: input.length,
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
		const files = this.files;
		/** @type {{
		 *   buffer: !(Uint8Array),
		 *   option: Object,
		 *   compressed: boolean,
		 *   encrypted: boolean,
		 *   size: number,
		 *   crc32: number
		 * }} */
		let localFileSize = /** @type {number} */ 0;
		let centralDirectorySize = /** @type {number} */ 0;
		const fileCount = files.length;
		for (let i = 0; i < fileCount; ++i) {
			const file = files[i];
			const opt = file.option; // ファイルの圧縮
			const filenameLength = opt.filename ? opt.filename.length : 0;
			// const extraFieldLength = opt.extraField ? opt.extraField.length : 0;
			const commentLength = opt.comment ? opt.comment.length : 0;
			if (!file.compressed) {
				file.crc32 = CRC32.calc(file.buffer); // 圧縮されていなかったら圧縮 // 圧縮前に CRC32 の計算をしておく
				switch (opt.compressionMethod) {
					case Zip.CompressionMethod.STORE:
						break;
					case Zip.CompressionMethod.DEFLATE:
						file.buffer = this.deflateWithOption(file.buffer, opt);
						file.compressed = true;
						break;
					default:
						throw new Error(`unknown compression method:${opt.compressionMethod}`);
				}
			}
			if (opt.password !== void 0 || this.password !== void 0) {
				const key = this.createEncryptionKey(opt.password || this.password); // encryption// init encryption
				const len = file.buffer.length + 12; // add header
				const buffer = new Uint8Array(len);
				buffer.set(file.buffer, 12);
				for (let j = 0; j < 12; ++j)
					buffer[j] = this.encode(key, i === 11 ? file.crc32 & 0xff : (Math.random() * 256) | 0);
				for (let j = 12; j < len; ++j) buffer[j] = this.encode(key, buffer[j]); // data encryption
				file.buffer = buffer;
			}
			localFileSize += 30 + filenameLength + file.buffer.length; // 必要バッファサイズの計算// local file header// file data
			centralDirectorySize += 46 + filenameLength + commentLength; // file header
		}
		const endOfCentralDirectorySize = 22 + (this.comment ? this.comment.length : 0); // end of central directory
		const output = new Uint8Array(localFileSize + centralDirectorySize + endOfCentralDirectorySize);
		let op1 = 0;
		let op2 = localFileSize;
		let op3 = op2 + centralDirectorySize;
		for (const file of files) {
			const opt = file.option; // ファイルの圧縮
			const filenameLength = opt.filename ? opt.filename.length : 0;
			const extraFieldLength = 0; // TODO
			const commentLength = opt.comment ? opt.comment.length : 0;
			const offset = op1; //// local file header & file header ////
			output[op1++] = Zip.LocalFileHeaderSignature[0]; // local file header // signature
			output[op1++] = Zip.LocalFileHeaderSignature[1];
			output[op1++] = Zip.LocalFileHeaderSignature[2];
			output[op1++] = Zip.LocalFileHeaderSignature[3];
			output[op2++] = Zip.FileHeaderSignature[0]; // file header
			output[op2++] = Zip.FileHeaderSignature[1];
			output[op2++] = Zip.FileHeaderSignature[2];
			output[op2++] = Zip.FileHeaderSignature[3];
			const needVersion = 20; // compressor info
			output[op2++] = needVersion & 0xff;
			output[op2++] =
				/** @type {OperatingSystem} */
				(opt.os) || Zip.OperatingSystem.MSDOS;
			output[op1++] = output[op2++] = needVersion & 0xff; // need version
			output[op1++] = output[op2++] = (needVersion >> 8) & 0xff;
			let flags = 0; // general purpose bit flag
			if (opt.password || this.password) flags |= Zip.Flags.ENCRYPT;
			output[op1++] = output[op2++] = flags & 0xff;
			output[op1++] = output[op2++] = (flags >> 8) & 0xff;
			const compressionMethod =
				/** @type {CompressionMethod} */
				(opt.compressionMethod); // compression method
			output[op1++] = output[op2++] = compressionMethod & 0xff;
			output[op1++] = output[op2++] = (compressionMethod >> 8) & 0xff;
			const date = /** @type {(Date|undefined)} */ (opt.date) || new Date(); // date
			output[op1++] = output[op2++] = ((date.getMinutes() & 0x7) << 5) | ((date.getSeconds() / 2) | 0);
			output[op1++] = output[op2++] = (date.getHours() << 3) | (date.getMinutes() >> 3);
			output[op1++] = output[op2++] = (((date.getMonth() + 1) & 0x7) << 5) | date.getDate();
			output[op1++] = output[op2++] = (((date.getFullYear() - 1980) & 0x7f) << 1) | ((date.getMonth() + 1) >> 3);
			const crc32 = file.crc32; // CRC-32
			output[op1++] = output[op2++] = crc32 & 0xff;
			output[op1++] = output[op2++] = (crc32 >> 8) & 0xff;
			output[op1++] = output[op2++] = (crc32 >> 16) & 0xff;
			output[op1++] = output[op2++] = (crc32 >> 24) & 0xff;
			const size = file.buffer.length; // compressed size
			output[op1++] = output[op2++] = size & 0xff;
			output[op1++] = output[op2++] = (size >> 8) & 0xff;
			output[op1++] = output[op2++] = (size >> 16) & 0xff;
			output[op1++] = output[op2++] = (size >> 24) & 0xff;
			const plainSize = file.size; // uncompressed size
			output[op1++] = output[op2++] = plainSize & 0xff;
			output[op1++] = output[op2++] = (plainSize >> 8) & 0xff;
			output[op1++] = output[op2++] = (plainSize >> 16) & 0xff;
			output[op1++] = output[op2++] = (plainSize >> 24) & 0xff;
			output[op1++] = output[op2++] = filenameLength & 0xff; // filename length
			output[op1++] = output[op2++] = (filenameLength >> 8) & 0xff;
			output[op1++] = output[op2++] = extraFieldLength & 0xff; // extra field length
			output[op1++] = output[op2++] = (extraFieldLength >> 8) & 0xff;
			output[op2++] = commentLength & 0xff; // file comment length
			output[op2++] = (commentLength >> 8) & 0xff;
			output[op2++] = 0; // disk number start
			output[op2++] = 0;
			output[op2++] = 0; // internal file attributes
			output[op2++] = 0;
			output[op2++] = 0; // external file attributes
			output[op2++] = 0;
			output[op2++] = 0;
			output[op2++] = 0;
			output[op2++] = offset & 0xff; // relative offset of local header
			output[op2++] = (offset >> 8) & 0xff;
			output[op2++] = (offset >> 16) & 0xff;
			output[op2++] = (offset >> 24) & 0xff;
			const filename = opt.filename; // filename
			if (filename) {
				output.set(filename, op1);
				output.set(filename, op2);
				op1 += filenameLength;
				op2 += filenameLength;
			}
			const extraField = opt.extraField; // extra field
			if (extraField) {
				output.set(extraField, op1);
				output.set(extraField, op2);
				op1 += extraFieldLength;
				op2 += extraFieldLength;
			}
			const comment = opt.comment; // comment
			if (comment) {
				output.set(comment, op2);
				op2 += commentLength;
			}
			output.set(file.buffer, op1); //// file data ////
			op1 += file.buffer.length;
		}
		output[op3++] = Zip.CentralDirectorySignature[0]; //// end of central directory //// signature
		output[op3++] = Zip.CentralDirectorySignature[1];
		output[op3++] = Zip.CentralDirectorySignature[2];
		output[op3++] = Zip.CentralDirectorySignature[3];
		output[op3++] = 0; // number of this disk
		output[op3++] = 0;
		output[op3++] = 0; // number of the disk with the start of the central directory
		output[op3++] = 0;
		output[op3++] = fileCount & 0xff; // total number of entries in the central directory on this disk
		output[op3++] = (fileCount >> 8) & 0xff;
		output[op3++] = fileCount & 0xff; // total number of entries in the central directory
		output[op3++] = (fileCount >> 8) & 0xff;
		output[op3++] = centralDirectorySize & 0xff; // size of the central directory
		output[op3++] = (centralDirectorySize >> 8) & 0xff;
		output[op3++] = (centralDirectorySize >> 16) & 0xff;
		output[op3++] = (centralDirectorySize >> 24) & 0xff;
		output[op3++] = localFileSize & 0xff; // offset of start of central directory with respect to the starting disk number
		output[op3++] = (localFileSize >> 8) & 0xff;
		output[op3++] = (localFileSize >> 16) & 0xff;
		output[op3++] = (localFileSize >> 24) & 0xff;
		const commentLength = this.comment ? this.comment.length : 0; // .ZIP file comment length
		output[op3++] = commentLength & 0xff;
		output[op3++] = (commentLength >> 8) & 0xff;
		if (this.comment) {
			output.set(this.comment, op3); // .ZIP file comment
			op3 += commentLength;
		}
		return output;
	}
	/**
	 * @param {!(Uint8Array)} input
	 * @param {Object=} opt_params options.
	 * @return {!(Uint8Array)}
	 */
	deflateWithOption = function (input, opt_params) {
		return new RawDeflate(input, opt_params.deflateOption).compress();
	};
	/**
	 * @param {(Uint32Array)} key
	 * @return {number}
	 */
	getByte(key) {
		const tmp = (key[2] & 0xffff) | 2;
		return ((tmp * (tmp ^ 1)) >> 8) & 0xff;
	}
	/**
	 * @param {(Uint32Array|Object)} key
	 * @param {number} n
	 * @return {number}
	 */
	encode(key, n) {
		const tmp = this.getByte(/** @type {(Uint32Array)} */ (key));
		this.updateKeys(/** @type {(Uint32Array)} */ (key), n);
		return tmp ^ n;
	}
	/**
	 * @param {(Uint32Array)} key
	 * @param {number} n
	 */
	updateKeys(key, n) {
		key[0] = CRC32.single(key[0], n);
		key[1] = ((((((key[1] + (key[0] & 0xff)) * 20173) >>> 0) * 6681) >>> 0) + 1) >>> 0;
		key[2] = CRC32.single(key[2], key[1] >>> 24);
	}
	/**
	 * @param {(Uint8Array)} password
	 * @return {!(Uint32Array|Object)}
	 */
	createEncryptionKey(password) {
		const key = new Uint32Array([305419896, 591751049, 878082192]);
		for (let i = 0, il = password.length; i < il; ++i) this.updateKeys(key, password[i] & 0xff);
		return key;
	}
}
