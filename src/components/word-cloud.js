import { html, LitElement } from '@polymer/lit-element';

import { connect } from 'pwa-helpers/connect-mixin.js';

// This element is connected to the Redux store.
import { store } from '../store.js';

import {
	emptyWordCloud
} from '../nlp.js';

import {
	navigateToCollectionWithQuery
} from '../actions/app.js';

import './tag-list.js';

export class WordCloud extends connect(store)(LitElement) {
	render() {
		return html`
		<!-- --app-primary-color default color -->
		<tag-list .tags=${this._effectiveWordCloud[0]} .tagInfos=${this._effectiveWordCloud[1]} defaultColor='#5e2b97' .tapEvents=${true} @tag-tapped=${this._handleTagTapped}></tag-list>
	`;
	}

	get _effectiveWordCloud() {
		return this.wordCloud || emptyWordCloud();
	}

	_handleTagTapped(e) {
		const tagName = e.detail.tag;
		const tagInfos = this._effectiveWordCloud[1];
		const query = tagInfos[tagName] ? tagInfos[tagName].title : tagName;
		store.dispatch(navigateToCollectionWithQuery(query.toLowerCase()));
	}

	static get properties() {
		return {
			wordCloud: {type:Object},
		};
	}

}

window.customElements.define('word-cloud', WordCloud);