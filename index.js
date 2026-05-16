// CSS Preset Manager — SillyTavern Extension
// Save, load, rename, and delete Custom CSS presets.

const MODULE_NAME = 'css_preset_manager';

const defaultSettings = {
    presets: {},
    selectedPreset: '',
};

// ── Settings helpers ────────────────────────────────────────

function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = JSON.parse(JSON.stringify(defaultSettings));
    }
    const s = extensionSettings[MODULE_NAME];
    if (!s.presets) s.presets = {};
    if (s.selectedPreset === undefined) s.selectedPreset = '';
    return s;
}

function saveSettings() {
    SillyTavern.getContext().saveSettingsDebounced();
}

// ── CSS read / write via the native Custom CSS textarea ─────

function getCurrentCSS() {
    return String($('#customCSS').val() || '');
}

function applyCSS(css) {
    // Setting the value and triggering 'input' lets SillyTavern's own
    // handler update power_user.custom_css and call applyCustomCSS().
    $('#customCSS').val(css).trigger('input');
}

// ── Dropdown ────────────────────────────────────────────────

function updateDropdown() {
    const settings = getSettings();
    const $select = $('#css_preset_select');

    $select.empty();
    $select.append('<option value="">-- No Preset --</option>');

    const names = Object.keys(settings.presets).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );

    for (const name of names) {
        $select.append($('<option>').val(name).text(name));
    }

    if (settings.selectedPreset && settings.presets[settings.selectedPreset] !== undefined) {
        $select.val(settings.selectedPreset);
    } else {
        $select.val('');
        settings.selectedPreset = '';
    }
}

// ── Popup wrappers (modern Popup API → native fallback) ─────

async function promptInput(title, message, defaultValue = '') {
    try {
        const { Popup } = SillyTavern.getContext();
        if (Popup?.show?.input) {
            const result = await Popup.show.input(title, message, defaultValue);
            return result ? String(result).trim() : null;
        }
    } catch { /* use fallback */ }
    const result = prompt(message, defaultValue);
    return result ? result.trim() : null;
}

async function promptConfirm(title, message) {
    try {
        const { Popup } = SillyTavern.getContext();
        if (Popup?.show?.confirm) {
            const result = await Popup.show.confirm(title, message);
            return !!result; // AFFIRMATIVE = 1 (truthy), NEGATIVE = 0
        }
    } catch { /* use fallback */ }
    return confirm(message);
}

// ── Actions ─────────────────────────────────────────────────

async function onPresetSelect() {
    const settings = getSettings();
    const name = String($('#css_preset_select').val() || '');

    if (name && settings.presets[name] !== undefined) {
        settings.selectedPreset = name;
        applyCSS(settings.presets[name]);
        toastr.success(`Loaded preset: ${name}`);
    } else {
        settings.selectedPreset = '';
    }
    saveSettings();
}

async function onSaveNewPreset() {
    const settings = getSettings();
    const css = getCurrentCSS();

    if (!css.trim()) {
        toastr.warning('Custom CSS is empty — nothing to save.');
        return;
    }

    const name = await promptInput(
        'Save New CSS Preset',
        'Enter a name for this preset:',
        '',
    );
    if (!name) return;

    if (Object.prototype.hasOwnProperty.call(settings.presets, name)) {
        toastr.error(`A preset named "${name}" already exists. Use Update to overwrite.`);
        return;
    }

    settings.presets[name] = css;
    settings.selectedPreset = name;
    saveSettings();
    updateDropdown();
    toastr.success(`Preset "${name}" saved.`);
}

async function onUpdatePreset() {
    const settings = getSettings();
    const name = String($('#css_preset_select').val() || '');

    if (!name) {
        toastr.warning('Select a preset to update.');
        return;
    }

    const css = getCurrentCSS();
    if (!css.trim()) {
        toastr.warning('Custom CSS is empty — nothing to update.');
        return;
    }

    settings.presets[name] = css;
    saveSettings();
    toastr.success(`Preset "${name}" updated.`);
}

async function onRenamePreset() {
    const settings = getSettings();
    const oldName = String($('#css_preset_select').val() || '');

    if (!oldName) {
        toastr.warning('Select a preset to rename.');
        return;
    }

    const newName = await promptInput(
        'Rename Preset',
        `Enter a new name for "${oldName}":`,
        oldName,
    );
    if (!newName || newName === oldName) return;

    if (Object.prototype.hasOwnProperty.call(settings.presets, newName)) {
        toastr.error(`A preset named "${newName}" already exists.`);
        return;
    }

    settings.presets[newName] = settings.presets[oldName];
    delete settings.presets[oldName];
    if (settings.selectedPreset === oldName) {
        settings.selectedPreset = newName;
    }
    saveSettings();
    updateDropdown();
    toastr.success(`Renamed to "${newName}".`);
}

async function onDeletePreset() {
    const settings = getSettings();
    const name = String($('#css_preset_select').val() || '');

    if (!name) {
        toastr.warning('Select a preset to delete.');
        return;
    }

    const ok = await promptConfirm(
        'Delete Preset',
        `Delete preset "${name}"? This cannot be undone.`,
    );
    if (!ok) return;

    delete settings.presets[name];
    if (settings.selectedPreset === name) {
        settings.selectedPreset = '';
    }
    saveSettings();
    updateDropdown();
    toastr.success(`Preset "${name}" deleted.`);
}

// ── UI injection ────────────────────────────────────────────

function injectUI() {
    const $cssBlock = $('#CustomCSS-block');
    if (!$cssBlock.length) return false;
    if ($('#css_preset_manager_container').length) return true; // already injected

    const html = `
        <div id="css_preset_manager_container" class="css-preset-manager">
            <label for="css_preset_select">CSS Presets</label>
            <div class="css-preset-manager-row">
                <select id="css_preset_select" class="text_pole css-preset-select">
                    <option value="">-- No Preset --</option>
                </select>
                <div id="css_preset_save" class="menu_button menu_button_icon" title="Save as new preset">
                    <i class="fa-solid fa-floppy-disk"></i>
                </div>
                <div id="css_preset_update" class="menu_button menu_button_icon" title="Update selected preset with current CSS">
                    <i class="fa-solid fa-arrows-rotate"></i>
                </div>
                <div id="css_preset_rename" class="menu_button menu_button_icon" title="Rename selected preset">
                    <i class="fa-solid fa-pencil"></i>
                </div>
                <div id="css_preset_delete" class="menu_button menu_button_icon redWarningBG" title="Delete selected preset">
                    <i class="fa-solid fa-trash-can"></i>
                </div>
            </div>
        </div>`;

    const $header = $cssBlock.find('h4').first();
    if ($header.length) {
        $header.after(html);
    } else {
        $cssBlock.prepend(html);
    }

    // Bind events
    $('#css_preset_select').on('change', onPresetSelect);
    $('#css_preset_save').on('click', onSaveNewPreset);
    $('#css_preset_update').on('click', onUpdatePreset);
    $('#css_preset_rename').on('click', onRenamePreset);
    $('#css_preset_delete').on('click', onDeletePreset);

    updateDropdown();
    return true;
}

// ── Bootstrap ───────────────────────────────────────────────

jQuery(async () => {
    getSettings(); // ensure defaults exist

    // The Custom CSS block may not be in the DOM yet, so observe.
    if (injectUI()) return;

    const observer = new MutationObserver(() => {
        if (injectUI()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Stop watching after 30 s to avoid leaks if the block never appears.
    setTimeout(() => observer.disconnect(), 30000);
});

// ── Manifest "clean" hook (SillyTavern 1.18.0+) ─────────────
// Invoked by ST when the user clicks the broom button or opts to clean up
// data on uninstall. Wipes all stored presets for this extension.
export function cleanupExtensionData() {
    try {
        const { extensionSettings } = SillyTavern.getContext();
        if (extensionSettings && extensionSettings[MODULE_NAME]) {
            delete extensionSettings[MODULE_NAME];
            saveSettings();
        }
    } catch (e) {
        console.error('[CSS Preset Manager] cleanupExtensionData failed:', e);
    }
}
