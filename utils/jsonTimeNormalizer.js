'use strict';

const DISPLAY_TIME_FIELDS = new Set([
    'horainicio',
    'horafim'
]);

function isDisplayTimeField(key) {
    return DISPLAY_TIME_FIELDS.has(String(key || '').replace(/_/g, '').toLowerCase());
}

function normalizeTimeForDisplay(value) {
    if (typeof value !== 'string') return value;

    const text = value.trim();
    const match = /^(\d{1,2}):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/.exec(text);
    if (!match) return value;

    return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function jsonTimeReplacer(key, value) {
    return isDisplayTimeField(key) ? normalizeTimeForDisplay(value) : value;
}

module.exports = {
    jsonTimeReplacer,
    normalizeTimeForDisplay
};
