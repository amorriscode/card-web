/*eslint-env node*/

import {
	referencesLegal,
	REFERENCE_TYPE_LINK,
} from '../../src/card_fields.js';

import assert from 'assert';

describe('card references util functions', () => {
	it('strings not legal', async () => {
		const input = '';
		const result = referencesLegal(input);
		assert.strictEqual(result, false);
	});

	it('null not legal', async () => {
		const input = null;
		const result = referencesLegal(input);
		assert.strictEqual(result, false);
	});

	it('blank object legal', async () => {
		const input = {};
		const result = referencesLegal(input);
		assert.strictEqual(result, true);
	});

	it('object with one key that is string illegal', async () => {
		const input = {
			'foo': 'bar',
		};
		const result = referencesLegal(input);
		assert.strictEqual(result, false);
	});

	it('object with one key that is null illegal', async () => {
		const input = {
			'foo': null,
		};
		const result = referencesLegal(input);
		assert.strictEqual(result, false);
	});

	it('object with one key that is blank object illegal', async () => {
		const input = {
			'foo': {},
		};
		const result = referencesLegal(input);
		assert.strictEqual(result, false);
	});

	it('object with one key that is object with one whitelisted property that is empty string legal', async () => {
		const input = {
			'foo': {
				[REFERENCE_TYPE_LINK]: '',
			},
		};
		const result = referencesLegal(input);
		assert.strictEqual(result, true);
	});

	it('object with one key that is object with one whitelisted property that is non-empty string legal', async () => {
		const input = {
			'foo': {
				[REFERENCE_TYPE_LINK]: 'foo',
			},
		};
		const result = referencesLegal(input);
		assert.strictEqual(result, true);
	});

	it('object with one key that is object with one non-whitelisted property that is non-empty string illegal', async () => {
		const input = {
			'foo': {
				'foo': 'foo',
			},
		};
		const result = referencesLegal(input);
		assert.strictEqual(result, false);
	});

	it('object with one key that is object with one whitelisted property that is object illegal', async () => {
		const input = {
			'foo': {
				[REFERENCE_TYPE_LINK]: {},
			},
		};
		const result = referencesLegal(input);
		assert.strictEqual(result, false);
	});

});