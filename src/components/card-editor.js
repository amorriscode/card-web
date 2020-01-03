import { LitElement, html } from '@polymer/lit-element';
import { connect } from 'pwa-helpers/connect-mixin.js';
import { repeat } from 'lit-html/directives/repeat';

// This element is connected to the Redux store.
import { store } from '../store.js';

import { ButtonSharedStyles } from './button-shared-styles.js';

import {
	addSlug,
	createTag,
} from '../actions/data.js';

import {
	selectTags,
	selectActiveCard,
} from '../selectors.js';

import {
	editingFinish,
	editingCommit,
	titleUpdated,
	notesUpdated,
	bodyUpdated,
	sectionUpdated,
	nameUpdated,
	substantiveUpdated,
	publishedUpdated,
	fullBleedUpdated,
	autoTodoOverrideEnabled,
	autoTodoOverrideRemoved,
	tagAdded,
	tagRemoved,
	editingSelectTab,
	todoUpdated,

	TAB_CONTENT,
	TAB_NOTES,
	TAB_TODO,
	autoTodoOverrideDisabled,
} from '../actions/editor.js';

import {
	saveIcon,
	cancelIcon
} from './my-icons.js';

import {
	killEvent, 
	cardHasContent, 
	cardHasNotes,
	cardHasTodo
} from '../util.js';

import {
	findCardToLink
} from '../actions/find.js';

import './tag-list.js';
import { 
	TODO_INFOS
} from '../reducers/collection.js';

class CardEditor extends connect(store)(LitElement) {
	render() {

		const hasContent = cardHasContent(this._card);
		const hasNotes = cardHasNotes(this._card);
		const hasTodo = cardHasTodo(this._card);
		const contentModified = this._card.body != this._underlyingCard.body;
		const notesModified = this._card.notes != this._underlyingCard.notes;
		const todoModified = this._card.todo != this._underlyingCard.todo;

		const todoOverridesEnabled = Object.entries(this._card.auto_todo_overrides).filter(entry => entry[1] == true).map(entry => entry[0]);
		const todoOverridesPreviouslyEnabled = Object.entries(this._underlyingCard.auto_todo_overrides).filter(entry => entry[1] == true).map(entry => entry[0]);
		const todoOverridesDisabled = Object.entries(this._card.auto_todo_overrides).filter(entry => entry[1] == false).map(entry => entry[0]);
		const todoOverridesPreviouslyDisabled = Object.entries(this._underlyingCard.auto_todo_overrides).filter(entry => entry[1] == false).map(entry => entry[0]);

		return html`
      ${ButtonSharedStyles}
      <style>

        :host {
          position:relative;
          background-color: white;
        }

        .container {
          width: 100%;
          height:100%;
          display:flex;
          flex-direction: column;
          padding:1em;
          box-sizing:border-box;
          position:absolute;
        }

        .inputs {
          display:flex;
          flex-direction:column;
          width:100%;
          flex-grow:1;
        }

        input, textarea {
          border: 0 solid black;
          font-size:0.8em;
          border-bottom:1px solid var(--app-dark-text-color);
          width: 100%;
        }

        .inputs > div {
          display:flex;
          flex-direction:column;
        }

        textarea {
          flex-grow:1;
        }

        .flex {
          flex-grow:1;
        }

        .body {
          display:flex;
          flex-direction:column;
        }

        .buttons {
          display:flex;
          flex-direction:row;
          width:100%;
        }

        .buttons h3 {
          font-size:1em;
          opacity:0.5;
          font-weight:normal;
		  margin-right:0.5em;
        }

        .inputs .row {
          display:flex;
          flex-direction:row;
          align-items:center;
        }

        .inputs .row > div {
          flex-grow:1;
        }

		.tabs {
			display:flex;
			flex-direction:row;
		}

		.tabs label {
			cursor:pointer;
			padding-right:0.5em;
			border-bottom:1px solid transparent;
			font-weight:bold;
		}

		.tabs label.help {
			font-weight: normal;
			font-style: italic;
		}

		.tabs label[selected] {
			color: var(--app-primary-color);
			border-bottom-color: var(--app-primary-color);
		}

		.tabs label[empty] {
			font-weight:inherit;
		}

		.tabs label[modified] {
			font-style: italic;
		}

		[hidden] {
          display:none;
        }

      </style>
      <div class='container'>
        <div class='inputs'>
          <div>
            <label>Title</label>
            <input type='text' @input='${this._handleTitleUpdated}' .value=${this._card.title}></input>
          </div>
		  <div class='flex body'>
			<div class='tabs' @click=${this._handleTabClicked}>
				<label name='${TAB_CONTENT}' ?selected=${this._selectedTab == TAB_CONTENT} ?empty=${!hasContent} ?modified=${contentModified}>Content</label>
				<label name='${TAB_NOTES}' ?selected=${this._selectedTab == TAB_NOTES} ?empty=${!hasNotes} ?modified=${notesModified}>Notes</label>
				<label name='${TAB_TODO}' ?selected=${this._selectedTab == TAB_TODO} ?empty=${!hasTodo} ?modified=${todoModified}>Freeform TODO</label>
				<span class='flex'></span>
				<label class='help' ?hidden=${this._selectedTab !== TAB_CONTENT}>Content is what shows up on the main body of the card</label>
				<label class='help' ?hidden=${this._selectedTab !== TAB_NOTES}>Notes are visible in the info panel to all readers and are for permanent asides</label>
				<label class='help' ?hidden=${this._selectedTab !== TAB_TODO}>Freeform TODOs are only visible to editors and mark a temporary thing to do so it shows up in the has-freeform-todo filter</label>

			</div>
			<textarea ?hidden=${this._selectedTab !== TAB_CONTENT} @input='${this._handleBodyUpdated}' .value=${this._card.body}></textarea>
			<textarea ?hidden=${this._selectedTab !== TAB_NOTES} @input='${this._handleNotesUpdated}' .value=${this._card.notes}></textarea>
			<textarea ?hidden=${this._selectedTab !== TAB_TODO} @input='${this._handleTodoUpdated}' .value=${this._card.todo}></textarea>
		  </div>
          <div class='row'>
            <div>
              <label>Section</label>
              <select @change='${this._handleSectionUpdated}' .value=${this._card.section}>
                ${repeat(Object.values(this._sections), (item) => item, (item) => html`
                <option value="${item.id}" ?selected=${item.id == this._card.section}>${item.title}</option>`)}
                <option value='' ?selected=${this._card.section == ''}>[orphaned]</option>
              </select>
            </div>
            <div>
              <Label>Slugs</label>
              <select .value=${this._card.name} @change='${this._handleNameUpdated}'>
                ${repeat([this._card.id, ...this._card.slugs], (item) => item, (item) => html`
                <option value="${item}" ?selected=${item == this._card.name}>${item}</option>`)}
              </select>
              <button @click='${this._handleAddSlug}'>+</button>
            </div>
            <div>
              <label>Full Bleed</label>
              <input type='checkbox' ?checked='${this._card.full_bleed}' @change='${this._handleFullBleedUpdated}'></input>
            </div>
			<div>
				<label>Tags</label>
				<tag-list .tags=${this._card.tags} .previousTags=${this._underlyingCard ? this._underlyingCard.tags : null} .editing=${true} .tagInfos=${this._tagInfos} @add-tag=${this._handleAddTag} @remove-tag=${this._handleRemoveTag} @new-tag=${this._handleNewTag}></tag-list>
			</div>
          </div>
        </div>
        <div class='buttons'>
		  <h3>Editing</h3>
		  <div>
			<label>Force Enable TODO</label>
			<tag-list .tags=${todoOverridesEnabled} .previousTags=${todoOverridesPreviouslyEnabled} .disableNew=${true} .overrideTypeName=${'Enabled'} .editing=${true} .tagInfos=${TODO_INFOS} @add-tag=${this._handleAddTodoOverrideEnabled} @remove-tag=${this._handleRemoveTodoOverride}></tag-list>
		  </div>
		  <div>
			<label>Force Disable TODO</label>
			<tag-list .tags=${todoOverridesDisabled} .previousTags=${todoOverridesPreviouslyDisabled} .disableNew=${true} .overrideTypeName=${'Disabled'} .editing=${true} .tagInfos=${TODO_INFOS} @add-tag=${this._handleAddTodoOverrideDisabled} @remove-tag=${this._handleRemoveTodoOverride}></tag-list>
		  </div>
		  <div class='flex'>
		  </div>
		  <div>
            <label>Published</label>
            <input type='checkbox' .checked=${this._card.published} @change='${this._handlePublishedUpdated}'></input>
          </div>
          <div>
            <label>Substantive</label>
            <input type='checkbox' .checked=${this._substantive} @change='${this._handleSubstantiveChanged}'></input>
          </div>
          <button class='round' @click='${this._handleCancel}'>${cancelIcon}</button>
          <button class='round primary' @click='${this._handleCommit}'>${saveIcon}</button>
        </div>
      </div>
    `;
	}

	static get properties() { return {
		_card: { type: Object },
		_active: {type: Boolean },
		_sections: {type: Object },
		_substantive: {type: Object},
		_selectedTab: {type:String},
		_tagInfos: {type: Object},
		//The card before any edits
		_underlyingCard: {type:Object},
	};}

	stateChanged(state) {
		this._card= state.editor.card;
		this._underlyingCard = selectActiveCard(state);
		this._active = state.editor.editing;
		this._sections = state.data.sections;
		this._substantive = state.editor.substantive;
		this._selectedTab = state.editor.selectedTab;
		this._tagInfos = selectTags(state);
	}

	shouldUpdate() {
		return this._active;
	}

	firstUpdated() {
		document.addEventListener('keydown', e => this._handleKeyDown(e));
	}

	_handleTabClicked(e) {
		const ele = e.path[0];
		if (!ele) return;
		const name = ele.getAttribute('name');
		if (!name) return;
		store.dispatch(editingSelectTab(name));
	}

	_handleNewTag() {
		let name = prompt('What is the base name of the tag?');
		if (!name) return;
		let displayName = prompt('What is the display name for the tag?', name);
		if (!displayName) return;
		store.dispatch(createTag(name, displayName));
	}

	_handleAddTag(e) {
		store.dispatch(tagAdded(e.detail.tag));
	}

	_handleRemoveTag(e) {
		store.dispatch(tagRemoved(e.detail.tag));
	}

	_handleAddTodoOverrideEnabled(e) {
		store.dispatch(autoTodoOverrideEnabled(e.detail.tag));
	}

	_handleAddTodoOverrideDisabled(e) {
		store.dispatch(autoTodoOverrideDisabled(e.detail.tag));
	}

	_handleRemoveTodoOverride(e) {
		store.dispatch(autoTodoOverrideRemoved(e.detail.tag));
	}

	_handleKeyDown(e) {
		//We have to hook this to issue content editable commands when we're
		//active. But most of the time we don't want to do anything.
		if (!this._active) return;
		if (!e.metaKey && !e.ctrlKey) return;

		//TODO: bail if a content editable region isn't selected. This isn't THAT
		//big of a deal as long as we use execCommand, because those will just
		//fail if the selection isn't in a contentEditable region.

		switch (e.key) {
		case 'b':
			document.execCommand('bold');
			return killEvent(e);
		case 'i':
			document.execCommand('italic');
			return killEvent(e);
		case '7':
			document.execCommand('insertOrderedList');
			return killEvent(e);
		case '8':
			document.execCommand('insertUnorderedList');
			return killEvent(e);
		case 'k':
			if (e.shiftKey) {
				//Default to searching for the text that's selected
				store.dispatch(findCardToLink(document.getSelection().toString()));
			} else {
				let href = prompt('Where should the URL point?');
				if (href) {
					document.execCommand('createLink', null, href);
				} else {
					document.execCommand('unlink');
				}
			}
			return killEvent(e);
		}
	}

	_handleTitleUpdated(e) {
		if (!this._active) return;
		let ele = e.composedPath()[0];
		store.dispatch(titleUpdated(ele.value, false));
	}

	bodyUpdatedFromContentEditable(html) {
		this._bodyUpdated(html, true);
	}

	titleUpdatedFromContentEditable(text) {
		store.dispatch(titleUpdated(text, true));
	}

	_bodyUpdated(html, fromContentEditable) {
		store.dispatch(bodyUpdated(html, fromContentEditable));
	}

	_handleBodyUpdated(e) {
		if (!this._active) return;
		let ele = e.composedPath()[0];
		this._bodyUpdated(ele.value, false);
	}

	_handleNotesUpdated(e) {
		if (!this._active) return;
		let ele = e.composedPath()[0];
		store.dispatch(notesUpdated(ele.value));
	}

	_handleTodoUpdated(e) {
		if (!this._active) return;
		let ele = e.composedPath()[0];
		store.dispatch(todoUpdated(ele.value));
	}

	_handleSectionUpdated(e) {
		if (!this._active) return;
		let ele = e.composedPath()[0];
		store.dispatch(sectionUpdated(ele.value));
	}

	_handleNameUpdated(e) {
		if (!this._active) return;
		let ele = e.composedPath()[0];
		store.dispatch(nameUpdated(ele.value));
	}

	_handleAddSlug() {
		if (!this._active) return;
		if (!this._card) return;
		let id = this._card.id;
		let value = prompt('Slug to add:');
		if (!value) return;
		store.dispatch(addSlug(id, value));
	}

	_handleFullBleedUpdated(e) {
		if(!this._active) return; 
		let ele = e.composedPath()[0];
		store.dispatch(fullBleedUpdated(ele.checked));
	}

	_handlePublishedUpdated(e) {
		if(!this._active) return; 
		let ele = e.composedPath()[0];
		store.dispatch(publishedUpdated(ele.checked));
	}

	_handleSubstantiveChanged(e) {
		if (!this._active) return;
		let ele = e.composedPath()[0];
		store.dispatch(substantiveUpdated(ele.checked));
	}

	_handleCommit() {
		store.dispatch(editingCommit());
	}

	_handleCancel() {
		store.dispatch(editingFinish());
	}

}

window.customElements.define('card-editor', CardEditor);
