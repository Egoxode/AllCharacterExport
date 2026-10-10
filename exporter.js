// Collects character cards from SillyTavern and packs them into one ZIP. No UI here.
import { ZipWriter } from './zip.js';

/**
 * File name inside the archive: the SillyTavern file name with the chosen extension.
 * Names are made unique case-insensitively (Windows and macOS unpack "A.png" and "a.png" into one file).
 */
export function archiveName(avatar, format, used) {
	const stem = String(avatar).replace(/\.[^./\\]+$/, '') || 'character';
	let name = `${stem}.${format}`;
	for (let n = 2; used.has(name.toLowerCase()); n++) name = `${stem} (${n}).${format}`;
	used.add(name.toLowerCase());
	return name;
}

/**
 * @param {object} opts
 * @param {Array<{name?: string, avatar?: string}>} opts.characters
 * @param {'png'|'json'} opts.format
 * @param {(avatar: string, format: string, signal: AbortSignal) => Promise<Uint8Array>} opts.fetchCard
 * @param {AbortSignal} [opts.signal]
 * @param {(done: number, total: number) => void} [opts.onProgress]
 * @returns {Promise<{blob: Blob|null, exported: number, failed: Array<{name: string, error: string}>}>}
 */
export async function exportAll({ characters, format, fetchCard, signal, onProgress }) {
	const list = (characters || []).filter(c => c && typeof c.avatar === 'string' && c.avatar);
	const zip = new ZipWriter();
	const used = new Set();
	const failed = [];
	let exported = 0;

	for (let i = 0; i < list.length; i++) {
		if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
		const ch = list[i];
		try {
			const data = await fetchCard(ch.avatar, format, signal);
			await zip.add(archiveName(ch.avatar, format, used), data, format === 'json');
			exported++;
		} catch (err) {
			if (err?.name === 'AbortError') throw err;
			if (/too large/.test(err?.message || '')) throw err;
			failed.push({ name: ch.name || ch.avatar, error: err?.message || String(err) });
		}
		onProgress?.(i + 1, list.length);
	}
	return { blob: exported ? zip.finish() : null, exported, failed };
}

/** Archive file name, e.g. characters_png_2026-10-10.zip */
export function zipFileName(format, date = new Date()) {
	const pad = n => String(n).padStart(2, '0');
	return `characters_${format}_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.zip`;
}
