import { LitElement, html } from '@polymer/lit-element';
import { connect } from 'pwa-helpers/connect-mixin.js';
import { repeat } from 'lit-html/directives/repeat';

// This element is connected to the Redux store.
import { store } from '../store.js';

import './card-thumbnail.js';

import { plusIcon } from './my-icons.js';

import {
  navigateToCard
} from '../actions/app.js';

import {
  userMayEdit
} from '../reducers/user.js';

import {
  showSection,
  createCard
} from '../actions/data.js';

import { collectionSelector } from '../reducers/data.js'

import { ButtonSharedStyles } from './button-shared-styles.js';
import { SharedStyles } from './shared-styles.js';


class CardDrawer extends connect(store)(LitElement) {
  render() {
    return html`
      ${SharedStyles}
      ${ButtonSharedStyles}
      <style>
        .scrolling {
          overflow:scroll;
          max-height:100%;
          flex-grow:1;
        }
        .container {
          max-height:100%;
          display:flex;
          flex-direction:column;
        }
        .controls {
          display:flex;
          padding:0.5em;
          box-sizing:border-box;
          flex-direction:column;
          border-bottom:1px solid var(--app-dark-text-color-light);
        }
        .controls label {
          margin:0;
          font-weight:normal;
          color: var(--app-dark-text-color-light);
        }
        button {
          position: absolute;
          left: 1em;
          bottom: 1em;
        }
      </style>
      <div class='container'>
        <div class='controls'>
          <label>Section</label>
          <select @change=${this._handleChange}>
            ${repeat(Object.values(this._sections), (item) => item.id, (item, index) => html`
              <option value="${item.id}" ?selected=${item.id == this._activeSectionId}>${item.title}</option>
              `)}
          </select>
        </div>
        <div class='scrolling'>
        ${repeat(this._collection, (i) => i.id, (i, index) => html`
          <card-thumbnail @thumbnail-tapped=${this._thumbnailActivatedHandler} .id=${i.id} .name=${i.name} .title=${i.title} .cardType=${i.card_type} .selected=${i.id == this._activeCardId}></card-thumbnail>`)}
        </div>
        <button class='round' @click='${this._handleAddSlide}' ?hidden='${!this._userMayEdit}'>${plusIcon}</button>
      </div>
    `;
  }

  _thumbnailActivatedHandler(e) {
    let ele = e.target;
    store.dispatch(navigateToCard(ele.name || ele.id));
  }

  _handleAddSlide(e) {
    store.dispatch(createCard(this._activeSectionId));
  }

  _handleChange(e) {
    let ele = e.path[0];
    store.dispatch(showSection(ele.value));
  }

  static get properties() { return {
    _collection: { type: Array },
    _activeCardId: { type: String },
    _activeSectionId: { type: String },
    _sections: { type: Object },
    _userMayEdit: { type: Boolean}
  }}

  // This is called every time something is updated in the store.
  stateChanged(state) {
    this._collection = collectionSelector(state);
    this._activeCardId = state.data.activeCardId;
    this._activeSectionId = state.data.activeSectionId;
    this._sections = state.data.sections;
    this._userMayEdit = userMayEdit(state);
  }
}

window.customElements.define('card-drawer', CardDrawer);
