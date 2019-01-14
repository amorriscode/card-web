
import { LitElement, html } from '@polymer/lit-element';

class TagChip  extends LitElement {
	render() {
		return html`
			<style>
				:host {
					background-color:blue;
					border-radius:0.1em;
					color:var(--app-light-text-color);
				}
			</style>
			<span class='${this.editing ? 'editing' : ''}'>${this.tagName}</span>
			`;
	}

	static get properties() {
		return {
			tagName: { type: String },
			editing: { type: Boolean},
		};
	}
}

window.customElements.define('tag-chip', TagChip);
