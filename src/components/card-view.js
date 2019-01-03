/**
@license
Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

import { html } from '@polymer/lit-element';
import { PageViewElement } from './page-view-element.js';
import { connect } from 'pwa-helpers/connect-mixin.js';

// This element is connected to the Redux store.
import { store } from '../store.js';

import { cardSelector } from '../reducers/data.js'

import { showCard } from '../actions/data.js'

import {
  userMayEdit,
  cardHasStar,
  cardIsRead,
  userMayStar,
  userMayMarkRead
} from '../reducers/user.js';

import {
  editingStart
} from '../actions/editor.js';

import {
  addStar,
  removeStar,
  markRead,
  markUnread
} from '../actions/user.js';

import {
  navigateToCard,
  openCommentsPanel,
  closeCommentsPanel,
  openCardInfoPanel,
  closeCardInfoPanel,
  openCardsDrawerPanel,
  closeCardsDrawerPanel,
  enablePresentationMode,
  disablePresentationMode,
  navigateToNextCard,
  navigateToPreviousCard
} from '../actions/app.js';

//Components needed by this
import './card-renderer.js';
import './card-drawer.js';
import './card-editor.js';
import './comments-panel.js';
import './card-info-panel.js';

import {
  editIcon,
  forumIcon,
  infoIcon,
  viewDayIcon,
  fullScreenIcon,
  arrowBackIcon,
  arrowForwardIcon,
  starIcon,
  starBorderIcon,
  visibilityIcon
} from './my-icons.js';

import {
  modifyCard
} from '../actions/data.js';

import {
  activeCardHasComments
} from '../reducers/comments.js';

import comments from '../reducers/comments.js';
store.addReducers({
  comments
});

import {
  cardsDrawerPanelShowing
} from '../reducers/app.js';

// These are the shared styles needed by this element.
import { SharedStyles } from './shared-styles.js';

import { ButtonSharedStyles } from './button-shared-styles.js';

class CardView extends connect(store)(PageViewElement) {
  render() {
    return html`
      ${SharedStyles}
      ${ButtonSharedStyles}
      <style>
        :host {
          height: 100%;
          width: 100%;
          position:absolute;
        }
        .container {
          display:flex;
          height:100%;
          width:100%;
        }

        #center {
          flex-grow:1;
          /* The next property means that we take up as much space as we're given, and our content doesn't create a floor of size */
          overflow:hidden;
          display:flex;
          flex-direction:column;
        }

        #canvas {
          flex-grow: 1;
          display:flex;
          flex-direction:column;
          justify-content:center;
          align-items: center;
          background-color: var(--app-divider-color);
        }

        .presenting #canvas {
          background-color: var(--app-dark-text-color);
        }

        .presenting {
          --shadow-color:#444;
          /* have to redefine it because it uses the variables at the site where it's derived */
          --card-shadow: var(--card-shadow-first-part) var(--shadow-color);
        }

        .presenting .actions {
          position:absolute;
          bottom:0.5em;
          right:0.5em;
          display:flex;
          flex-direction:column;
          opacity: 0.3;
          transition: opacity var(--transition-fade);
        }

        .presenting .actions:hover {
          opacity:1.0;
        }


        .presenting .actions > div {
          display:flex;
          flex-direction: column;
        }

        .actions{
          /* This is a hack to allow the information/edit buttons to be on top of a section-head-card container. See #44. */
          z-index: 1;
          display:flex;
          flex-direction:row;
        }

        .actions .next-prev {
          display:none;
        }

        .presenting .actions .next-prev {
          display:flex;
        }

        .presenting .actions .panels {
          display:none;
        }

        card-editor {
          display:none;
        }

        card-editor[active] {
          display:block;
          width:100%;
          /*TODO: this is a total hack. I don't know why flex-grow:1 doesn't do the right thing.*/
          height: 300px;
        }

        card-renderer {
          font-size:22px;
        }

        .editing card-renderer {
          font-size:16px;
        }

        .container.editing .actions {
          display:none;
        }

        [hidden] {
          display:none;
        }

        card-renderer {
          /* this will be overridden via an explicit property set directly on card-renderer */
          font-size:20px;
        }

        .auto-read {
          display: none;
          height: 100%;
          width: 100%;
          border-radius: 50%;
          position: absolute;
          top: 0;
          left: 0;
          z-index:1;
          background-color:#FFFFFF66;
        }

        .auto-read.pending {
          display:block;
          animation-name: autoread;
          /* TODO: set this based on the live variable */
          animation-duration: 5s;
          animation-timing-function: linear;
        }

        @keyframes autoread {
          from {
            transform: scale(1.0);
          }
          to {
            transform: scale(0.0);
          }
        }

        #portrait-message {
          display:none;
        }

        #portrait-message > div {
          margin:5em;
        }

        @media (orientation:portrait) {

          .mobile #portrait-message {
            position:absolute;
            height:100%;
            width:100%;
            background-color:#000000CC;
            color: white;
            font-size:36px;
            display:flex;
            justify-content:center;
            align-items: center;
            z-index:1;
            text-align:center;
          }

        }

      </style>
      <div class='container${this._editing ? ' editing' : ''} ${this._presentationMode ? 'presenting' : ''} ${this._mobileMode ? 'mobile' : ''}'>
        <card-drawer .editable=${true}></card-drawer>
        <div id='center'>
          <div id='canvas'>
            <div id='portrait-message'>
              <div>Rotate your phone to landscape mode</div>
            </div>
            <card-renderer .editing=${this._editing} .card=${this._displayCard} .fromContentEditable=${this._fromContentEditable} @body-updated=${this._handleBodyUpdated}></card-renderer>
            <div class='actions'>
              <div class='presentation'>
                <button class='round ${this._presentationMode ? 'selected' : ''}' ?hidden='${this._mobileMode}' @click=${this._handlePresentationModeClicked}>${fullScreenIcon}</button>
              </div>
              <div class='panels'>
                <button class='round ${this._cardsDrawerPanelOpen ? 'selected' : ''}' @click=${this._handleCardsDrawerClicked}>${viewDayIcon}</button>
                <button class='round ${this._commentsPanelOpen ? 'selected' : ''} ${this._activeCardHasComments ? 'primary' : ''}' @click='${this._handleCommentsClicked}'>${forumIcon}</button>
                <button class='round ${this._cardInfoPanelOpen ? 'selected' : ''}' @click='${this._handleCardInfoClicked}'>${infoIcon}</button>
              </div>
              <div class='modify'>
                <button class='round ${this._cardHasStar ? 'selected' : ''}' @click='${this._handleStarClicked}' ?disabled='${!this._userMayStar}'>${this._cardHasStar ? starIcon : starBorderIcon }</button>
                <button class='round ${this._cardIsRead ? 'selected' : ''}' @click='${this._handleReadClicked}' ?disabled='${!this._userMayMarkRead}'><div class='auto-read ${this._autoMarkReadPending ? 'pending' : ''}'></div>${visibilityIcon}</button>
                <button class='round' ?hidden='${!this._userMayEdit}' @click='${this._handleEditClicked}'>${editIcon}</button>
              </div>
              <div class='next-prev'>
                <button class='round' @click=${this._handleBackClicked}>${arrowBackIcon}</button>
                <button class='round' @click=${this._handleForwardClicked}>${arrowForwardIcon}</button>
              </div>
            </div>
          </div>
          <card-editor ?active=${this._editing} ></card-editor>
        </div>
        <card-info-panel .active=${this.active}></card-info-panel>
        <comments-panel .active=${this.active}></comments-panel>
      </div>
    `;
  }

  static get properties() {
    return {
      _card: { type: Object },
      _cardIdOrSlug: { type: String },
      _editing: {type: Boolean },
      _userMayEdit: { type: Boolean },
      _userMayStar: { type: Boolean },
      _userMayMarkRead: { type: Boolean },
      _autoMarkReadPending : { type: Boolean},
      _displayCard: { type: Object },
      _editingCard: { type: Object },
      _commentsPanelOpen: {type: Boolean},
      _cardInfoPanelOpen: {type: Boolean},
      _cardsDrawerPanelOpen: {type:Boolean},
      _cardsDrawerPanelShowing: {type: Boolean},
      _headerPanelOpen: {type: Boolean},
      _activeCardHasComments: {type:Boolean},
      _fromContentEditable: {type:Boolean},
      _presentationMode: {type:Boolean},
      _mobileMode: {type: Boolean},
      _cardHasStar: {type: Boolean},
      _cardIsRead: {type: Boolean},
    }
  }

  modifyTitle() {
    let title = prompt("What should the new title be for this card?", this._card.title);
    if (!title) return;
    store.dispatch(modifyCard(this._card, {title:title}, false));
  }

  extractPageExtra(pageExtra) {
    let parts = pageExtra.split("/");
    let cardId = parts[0];
    let editing = false;
    if (parts[1] == 'edit') editing = true;

    return [cardId, editing]
  }

  _handleEditClicked(e) {
    if (this._editing) {
      return this._handleCloseEditor(e);
    }
    store.dispatch(editingStart())
  }

  _handleBodyUpdated(e) {
    this.shadowRoot.querySelector('card-editor').bodyUpdatedFromContentEditable(e.detail.html);
  }

  _handleCommentsClicked(e) {
    if (this._commentsPanelOpen) {
      store.dispatch(closeCommentsPanel());
    } else {
      store.dispatch(openCommentsPanel());
    }
  }

  _handleCardInfoClicked(e) {
    if (this._cardInfoPanelOpen) {
      store.dispatch(closeCardInfoPanel());
    } else {
      store.dispatch(openCardInfoPanel());
    }
  }

  _handleCardsDrawerClicked(e) {
    if (this._cardsDrawerPanelOpen) {
      store.dispatch(closeCardsDrawerPanel());
    } else {
      store.dispatch(openCardsDrawerPanel());
    }
  }

  _handlePresentationModeClicked(e) {
    if (this._presentationMode) {
      store.dispatch(disablePresentationMode());
    } else {
      store.dispatch(enablePresentationMode());
    }
  }

  _handleBackClicked(e) {
    store.dispatch(navigateToPreviousCard());
  }

  _handleForwardClicked(e) {
    store.dispatch(navigateToNextCard());
  }

  _handleStarClicked(e) {
    if (this._cardHasStar) {
      store.dispatch(removeStar(this._card));
    } else {
      store.dispatch(addStar(this._card));
    }
  }

  _handleReadClicked(e) {
    if (this._cardIsRead) {
      store.dispatch(markUnread(this._card));
    } else {
      store.dispatch(markRead(this._card));
    }
  }

  stateChanged(state) {
    this._editingCard = state.editor.card;
    this._card = cardSelector(state);
    this._displayCard = this._editingCard ? this._editingCard : this._card;
    this._cardIdOrSlug = this.extractPageExtra(state.app.pageExtra)[0];
    this._editing = state.editor.editing; 
    this._userMayStar  =  userMayStar(state);
    this._userMayMarkRead =  userMayMarkRead(state);
    this._autoMarkReadPending = state.user.autoMarkReadPending;
    this._userMayEdit = userMayEdit(state);
    this._headerPanelOpen = state.app.headerPanelOpen;
    this._commentsPanelOpen = state.app.commentsPanelOpen;
    this._cardInfoPanelOpen = state.app.cardInfoPanelOpen;
    //Note: do NOT use this for whether the panel is showing.
    this._cardsDrawerPanelOpen = state.app.cardsDrawerPanelOpen;
    this._activeCardHasComments = activeCardHasComments(state);
    this._fromContentEditable = state.editor.fromContentEditable;
    this._cardsDrawerPanelShowing = cardsDrawerPanelShowing(state);
    this._presentationMode = state.app.presentationMode;
    this._mobileMode = state.app.mobileMode;
    this._cardHasStar = cardHasStar(state, this._card ? this._card.id : "");
    this._cardIsRead = cardIsRead(state, this._card ? this._card.id : "");
  }

  _ensureUrlShowsName() {
    //Ensure that the article name that we're shwoing--no matter how they
    //havigated here--is the preferred slug name.
    if (!this._card || !this._card.name) return;
    if (this._card.name != this._cardIdOrSlug) {
      //Deliberately do not call the navigate sction cretator, since this
      //should be a no-op.
      store.dispatch(navigateToCard(this._card, true));
    }
  }

  _changedPropsAffectCanvasSize(changedProps) {
    let sizeProps = [
      '_headerPanelOpen',
      '_commentsPanelOpen',
      '_cardInfoPanelOpen',
      '_cardsDrawerPanelShowing',
      '_editing'
    ]
    for (let item of sizeProps) {
      if (changedProps.has(item)) return true;
    }
    return false;
  }

  _resizeCard() {
    let fontSize = 20;
    const canvas = this.shadowRoot.getElementById("canvas");
    if (!canvas) {
      console.warn("Couldn't find canvas element");
      return;
    }

    const rect = canvas.getBoundingClientRect();


    const paddingInPx = Math.round(rect.width / 12);
    //Next two come from the style for base-card
    const cardWidthInEms = 43.63;
    const cardWidthPaddingInEms = 2 * (1.45);

    const cardHeightInEms = 24.54;
    const cardHeightPaddingInEms = 2 * (1.0);

    const totalCardWidthInEms = cardWidthInEms + cardWidthPaddingInEms;
    const totalCardHeighInEms = cardHeightInEms + cardHeightPaddingInEms;

    let targetWidth = rect.width - paddingInPx;
    //TODO: take into account size of actions bar.
    //On small screens don't worry about any vertical padding.
    let targetHeight = rect.height - (this._mobileMode ? 0 : paddingInPx);

    let widthFontSize = Math.round(targetWidth / totalCardWidthInEms);
    let heightFontSize = Math.round(targetHeight / totalCardHeighInEms);

    //Pick the smaller of the two
    fontSize = widthFontSize;
    if (heightFontSize < fontSize) fontSize = heightFontSize;

    const renderer = this.shadowRoot.querySelector('card-renderer');
    if (!renderer) {
      console.warn("Couldn't find card-renderer to update its size");
      return;
    }

    renderer.style.fontSize = '' + fontSize + 'px';
  }

  firstUpdated(changedProps) {
    window.addEventListener('resize', e => this._resizeCard());
  }

  updated(changedProps) {
    if (changedProps.has('_cardIdOrSlug')) {
      if (this._cardIdOrSlug) {
        store.dispatch(showCard(this._cardIdOrSlug))
      } else {
        //Dispatching to '' will use default;
        store.dispatch(navigateToCard(''));
      }
    }
    if (changedProps.has('_editing') && !this._editing) {
      //Verify that our URL shows the canoncial name, which may have just
      //changed when edited.
      this._ensureUrlShowsName();
    }
    if (changedProps.has('_card') && this._card && this._card.name) {
      this._ensureUrlShowsName();
    }
    if (this._changedPropsAffectCanvasSize(changedProps)) Promise.resolve().then(() => this._resizeCard());
  }
}

window.customElements.define('card-view', CardView);
