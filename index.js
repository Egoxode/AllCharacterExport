// AllCharacterExport - SillyTavern extension.
// Exports every character card as PNG or JSON into one ZIP archive.
import { exportAll, zipFileName } from './exporter.js';

const MODULE = 'AllCharacterExport';
const FORMATS = ['png', 'json'];

let running = null; // AbortController of the export in progress

function context() {
	return SillyTavern.getContext();
}

function settings() {
	const all = context().extensionSettings;
	if (!all[MODULE] || typeof all[MODULE] !== 'object') all[MODULE] = {};
	if (!FORMATS.includes(all[MODULE].format)) all[MODULE].format = 'png';
	return all[MODULE];
}

function notify(kind, text) {
	const toast = globalThis.toastr;
	if (toast && typeof toast[kind] === 'function') toast[kind](text, 'All Character Export');
	else console.log(`[${MODULE}] ${text}`);
}

/** Same request as the Export button on the character panel. */
async function fetchCard(avatar, format, signal) {
	const response = await fetch('/api/characters/export', {
		method: 'POST',
		headers: context().getRequestHeaders(),
		body: JSON.stringify({ format, avatar_url: avatar }),
		signal,
	});
	if (!response.ok) throw new Error(`Server answered ${response.status} ${response.statusText}`.trim());
	return new Uint8Array(await response.arrayBuffer());
}

function download(blob, fileName) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function ui() {
	return {
		format: document.getElementById('ace_format'),
		exportBtn: document.getElementById('ace_export'),
		cancelBtn: document.getElementById('ace_cancel'),
		status: document.getElementById('ace_status'),
	};
}

function setRunning(isRunning) {
	const el = ui();
	el.exportBtn.style.display = isRunning ? 'none' : '';
	el.cancelBtn.style.display = isRunning ? '' : 'none';
	el.format.disabled = isRunning;
}

async function runExport() {
	if (running) return;
	const el = ui();
	const format = settings().format;
	const characters = (context().characters || []).filter(c => c && c.avatar);
	if (!characters.length) {
		el.status.textContent = 'No characters to export.';
		notify('info', 'No characters to export.');
		return;
	}

	running = new AbortController();
	setRunning(true);
	el.status.textContent = `Exporting 0 / ${characters.length}…`;
	try {
		const result = await exportAll({
			characters,
			format,
			fetchCard,
			signal: running.signal,
			onProgress: (done, total) => { el.status.textContent = `Exporting ${done} / ${total}…`; },
		});
		if (result.blob) download(result.blob, zipFileName(format));

		const failedNames = result.failed.map(f => f.name);
		let text = `Exported ${result.exported} of ${characters.length} characters (${format.toUpperCase()}).`;
		if (failedNames.length) {
			text += ` Failed: ${failedNames.join(', ')}.`;
			console.warn(`[${MODULE}] Failed cards:`, result.failed);
		}
		el.status.textContent = text;
		notify(failedNames.length ? 'warning' : 'success', text);
	} catch (err) {
		if (err?.name === 'AbortError') {
			el.status.textContent = 'Export cancelled. Nothing was downloaded.';
			notify('info', 'Export cancelled.');
		} else {
			el.status.textContent = `Export failed: ${err?.message || err}`;
			notify('error', `Export failed: ${err?.message || err}`);
			console.error(`[${MODULE}]`, err);
		}
	} finally {
		running = null;
		setRunning(false);
	}
}

const HTML = `
<div id="ace_settings" class="all-character-export">
	<div class="inline-drawer">
		<div class="inline-drawer-toggle inline-drawer-header">
			<b>All Character Export</b>
			<div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
		</div>
		<div class="inline-drawer-content">
			<div class="flex-container alignItemsCenter">
				<label for="ace_format">Format</label>
				<select id="ace_format" class="text_pole flex1">
					<option value="png">PNG (card with image)</option>
					<option value="json">JSON (card data only)</option>
				</select>
			</div>
			<div class="flex-container">
				<div id="ace_export" class="menu_button menu_button_icon" tabindex="0" role="button">
					<i class="fa-solid fa-file-zipper"></i><span>Export all characters</span>
				</div>
				<div id="ace_cancel" class="menu_button menu_button_icon" tabindex="0" role="button" style="display:none">
					<i class="fa-solid fa-xmark"></i><span>Cancel</span>
				</div>
			</div>
			<small id="ace_status"></small>
		</div>
	</div>
</div>`;

function init() {
	const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
	if (!host || document.getElementById('ace_settings')) return;
	host.insertAdjacentHTML('beforeend', HTML);

	const el = ui();
	el.format.value = settings().format;
	el.format.addEventListener('change', () => {
		settings().format = FORMATS.includes(el.format.value) ? el.format.value : 'png';
		context().saveSettingsDebounced();
	});
	el.exportBtn.addEventListener('click', runExport);
	el.cancelBtn.addEventListener('click', () => running?.abort());
	for (const btn of [el.exportBtn, el.cancelBtn]) {
		btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); } });
	}
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
