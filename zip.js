// Minimal ZIP writer (no dependencies).
// PNG files are stored as they are (already compressed); text files are deflated when the browser supports it.

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();

export function crc32(bytes) {
	let crc = 0xFFFFFFFF;
	for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
	return (crc ^ 0xFFFFFFFF) >>> 0;
}

async function deflateRaw(bytes) {
	if (typeof CompressionStream === 'undefined') return null;
	try {
		const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
		return new Uint8Array(await new Response(stream).arrayBuffer());
	} catch {
		return null;
	}
}

function dosDateTime(date) {
	const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
	const day = ((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
	return { time, day };
}

const LIMIT_32 = 0xFFFFFFFF;
const LIMIT_ENTRIES = 0xFFFF;

export class ZipWriter {
	constructor(date = new Date()) {
		this.parts = [];      // local headers + data, in order
		this.central = [];    // central directory records
		this.offset = 0;
		this.count = 0;
		this.stamp = dosDateTime(date);
	}

	/**
	 * @param {string} name file name inside the archive (UTF-8)
	 * @param {Uint8Array} data file contents
	 * @param {boolean} compress try deflate (falls back to store if not smaller or not supported)
	 */
	async add(name, data, compress = false) {
		const nameBytes = new TextEncoder().encode(name);
		const crc = crc32(data);
		let method = 0;
		let body = data;
		if (compress && data.length > 0) {
			const packed = await deflateRaw(data);
			if (packed && packed.length < data.length) {
				method = 8;
				body = packed;
			}
		}
		if (this.count + 1 > LIMIT_ENTRIES || this.offset + 30 + nameBytes.length + body.length > LIMIT_32 || data.length > LIMIT_32) {
			throw new Error('Archive is too large (over 4 GB or 65535 files).');
		}

		const local = new DataView(new ArrayBuffer(30));
		local.setUint32(0, 0x04034B50, true);
		local.setUint16(4, 20, true);              // version needed
		local.setUint16(6, 0x0800, true);          // flag: UTF-8 names
		local.setUint16(8, method, true);
		local.setUint16(10, this.stamp.time, true);
		local.setUint16(12, this.stamp.day, true);
		local.setUint32(14, crc, true);
		local.setUint32(18, body.length, true);
		local.setUint32(22, data.length, true);
		local.setUint16(26, nameBytes.length, true);
		local.setUint16(28, 0, true);

		const central = new DataView(new ArrayBuffer(46));
		central.setUint32(0, 0x02014B50, true);
		central.setUint16(4, 20, true);            // version made by
		central.setUint16(6, 20, true);            // version needed
		central.setUint16(8, 0x0800, true);
		central.setUint16(10, method, true);
		central.setUint16(12, this.stamp.time, true);
		central.setUint16(14, this.stamp.day, true);
		central.setUint32(16, crc, true);
		central.setUint32(20, body.length, true);
		central.setUint32(24, data.length, true);
		central.setUint16(28, nameBytes.length, true);
		central.setUint16(30, 0, true);            // extra length
		central.setUint16(32, 0, true);            // comment length
		central.setUint16(34, 0, true);            // disk
		central.setUint16(36, 0, true);            // internal attributes
		central.setUint32(38, 0, true);            // external attributes
		central.setUint32(42, this.offset, true);  // local header offset

		this.parts.push(new Uint8Array(local.buffer), nameBytes, body);
		this.central.push(new Uint8Array(central.buffer), nameBytes);
		this.offset += 30 + nameBytes.length + body.length;
		this.count++;
	}

	/** @returns {Blob} the finished archive */
	finish() {
		const centralSize = this.central.reduce((sum, p) => sum + p.length, 0);
		if (this.offset + centralSize > LIMIT_32) throw new Error('Archive is too large (over 4 GB).');
		const end = new DataView(new ArrayBuffer(22));
		end.setUint32(0, 0x06054B50, true);
		end.setUint16(4, 0, true);
		end.setUint16(6, 0, true);
		end.setUint16(8, this.count, true);
		end.setUint16(10, this.count, true);
		end.setUint32(12, centralSize, true);
		end.setUint32(16, this.offset, true);
		end.setUint16(20, 0, true);
		return new Blob([...this.parts, ...this.central, new Uint8Array(end.buffer)], { type: 'application/zip' });
	}
}
