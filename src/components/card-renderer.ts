import { LitElement, css, html, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import {GestureEventListeners} from '@polymer/polymer/lib/mixins/gesture-event-listeners.js';
import * as Gestures from '@polymer/polymer/lib/utils/gestures.js';

import { SharedStyles } from './shared-styles.js';
import { ScrollingSharedStyles } from './scrolling-shared-styles.js';

import {
	badgeStyles,
	starBadge
} from './card-badges.js';

import dompurify from 'dompurify';

import {
	reportSelectionRange
} from '../actions/editor.js';

import {
	normalizeBodyToContentEditable
} from '../contenteditable.js';

import {
	getImagesFromCard,
	setImageProperties
} from '../images.js';

import {
	TEXT_FIELD_CONFIGURATION,
	CARD_TYPE_CONFIGURATION,
	editableFieldsForCardType,
	IMAGES_TEXT_FIELD,
	EMPTY_PROCESSED_CARD,
	EMPTY_CARD_ID
} from '../card_fields.js';

import {
	TEXT_FIELD_BODY,
	TEXT_FIELD_TITLE
} from '../type_constants.js';

import {
	highlightConceptReferences
} from '../nlp.js';

import * as icons from './my-icons.js';

import {
	makeElementContentEditable,
	deepActiveElement
} from '../util.js';

//Cards that include links need card-link
import './card-link.js';
import './card-highlight.js';
import './reference-block.js';

import {
	ProcessedCard,
	Card,
	CardID,
	CardFieldType,
	CardFieldMap,
	HTMLElementWithStashedSelectionOffset,
	CardFieldTypeEditable,
	isProcessedCard
} from '../types.js';

import {
	ExpandedReferenceBlocks
} from '../reference_blocks.js';

import {
	makeCardSwipedEvent,
	makeEditableCardFieldUpdatedEvent
} from '../events.js';

import {
	TypedObject
} from '../typed_object.js';

export const CARD_WIDTH_IN_EMS = 43.63;
export const CARD_HEIGHT_IN_EMS = 24.54;
export const CARD_VERTICAL_PADDING_IN_EMS = 1.0;
export const CARD_HORIZONTAL_PADDING_IN_EMS = 1.45;

// Number of pixels until a track is considered a swipe.
const SWIPE_DX = 15.0;
// Max duration of gesture to qualify as a swipe, in milliseconds.
const SWIPE_MAX_GESTURE_DURATION = 200;
// Timestamps of 'start' gestures.
const startGestureTimestamps : {[key : string] : number} = {};

const CARD_TYPE_STYLE_BLOCKS_RAW_CONTENT = Object.entries(CARD_TYPE_CONFIGURATION).filter(entry => entry[1].styleBlock).map(entry => '/* Styles for ' + entry[0] + ' */\n' + entry[1].styleBlock).join('\n\n');

const CARD_TYPE_STYLE_BLOCKS = unsafeCSS(CARD_TYPE_STYLE_BLOCKS_RAW_CONTENT);

interface ExtendedHTMLElement extends HTMLElementWithStashedSelectionOffset {
	hasContentEditableListeners? : boolean;
	conceptReferencesHighlighted? : boolean;
	field? : CardFieldType;
}

interface ExtenedHTMLImageElement extends HTMLImageElement {
	hasImageLoadHandler? : boolean;
}

//See https://github.com/ankitects/anki/issues/1386
interface ShadowRootWithGetSelection extends ShadowRoot {
	getSelection() : Selection
}

//Polymer Gestures doesn't have type information for events, so just do it
//manually.
type GestureEventDetail = {
	state : 'start' | 'end';
	x : number,
	y : number,
	dx : number,
	dy : number
};

type GestureEvent = CustomEvent<GestureEventDetail>;

@customElement('card-renderer')
export class CardRenderer extends GestureEventListeners(LitElement) {

	@property({ type : Object })
		card: ProcessedCard | Card;

	@property({ type : Boolean })
		editing: boolean;

	@property({ type : Object })
		updatedFromContentEditable: CardFieldMap;

	//if provided, will be piped through to the concept highlighter
	@property({ type : Array })
		suggestedConcepts : CardID[];

	@property({ type : Boolean })
		dataIsFullyLoaded: boolean;

	//expanded reference blocks to render, for example generated by getExpandedPrimaryReferenceBlocksForCard
	@property({ type : Array })
		expandedReferenceBlocks: ExpandedReferenceBlocks;

	@state()
		_elements: {[cardType in CardFieldType]+?: ExtendedHTMLElement};

	@state()
		_currentImagesResolve: (imagesLoaded : boolean) => void;

	@state()
		_currentImagesPromise : Promise<boolean>;

	static override styles = [
		badgeStyles,
		ScrollingSharedStyles,
		SharedStyles,
		//All of these are known to be guarded by a .container.CARD_TYPE, so
		//they can just be statically prepended, and their styles will be
		//activated based on the actual card-type of the card instance.
		CARD_TYPE_STYLE_BLOCKS,
		css`
			:host {
				display:block;
				background-color: var(--card-color);
				--effective-background-color: var(--card-color);
				--effective-background-color-rgb-inner: var(--card-color-rgb-inner);
				
				width: ${CARD_WIDTH_IN_EMS}em;
				height: ${CARD_HEIGHT_IN_EMS}em;
				

				box-shadow: var(--card-shadow);
				box-sizing: border-box;
				line-height:1.4;
				position:relative;
			}

			.container {
				height:100%;
				width:100%;
				padding: ${CARD_VERTICAL_PADDING_IN_EMS}em ${CARD_HORIZONTAL_PADDING_IN_EMS}em;
				box-sizing:border-box;
			}

			.container.unpublished {
				background-color: var(--unpublished-card-color);
				--effective-background-color: var(--unpublished-card-color);
				--effective-background-color-rgb-inner: var(--unpublished-card-color-rgb-inner);
			}

			.container.editing {
				box-shadow: inset 0 0 1em 0.5em var(--app-primary-color-light-transparent);
			}

			.container.editing card-link[card] {
				--card-link-cursor:not-allowed;
			}

			[hidden] {
				display:none;
			}

			h1, h2, h3{
				font-family: 'Raleway', sans-serif;
				font-weight:bold;
				margin-top:0;
			}

			h1, .title-container svg {
				color: var(--app-primary-color);
				fill: var(--app-primary-color);
				font-size: 1.4em;
			}

			h2 {
				color: var(--app-dark-text-color);
				font-size: 1.2em;
			}

			h3 {
				color: var(--app-dark-text-color);
				font-size: 1.1em;
			}

			h1 strong, h2 strong, h3 strong {
				color: var(--app-primary-color);
			}

			section {
				font-family: 'Source Sans Pro', sans-serif;
				font-size: 1em;
				color: var(--app-dark-text-color);
				background-color:transparent;
			}

			section p {
				/* make it so the top most item doesn't push the whole
				section down. p still have margin-bottom that previously
				would collapse with margin-top so the only effect is
				allowing boosted p to not push down the screen */
				margin-top:0;
			}

			section.full-bleed {
				top:0;
				left:0;
				height:100%;
				width:100%;
				position:absolute;
				display:flex;
				flex-direction:column;
				justify-content:center;
				align-items:center;
			}

			.small {
				font-size:0.72em;
			}
			.loading {
				font-style:italic;
				opacity: 0.5;
			}

			.star-count {
				position:absolute;
				top:0.5em;
				right:0.5em;
			}

			.background {
				display: none;
			}

			.content {
				display: flex;
				flex-direction: column;
				height: 100%;
				width: 100%;
			}

			.primary {
				flex-grow: 1;
				flex-shrink: 0.1;
			}

			.reference-blocks {
				flex-shrink: 1;
			}

			.title-container {
				display:flex;
				flex-direction:row;
				flex-shrink: 0;
			}

			.title-container svg {
				margin-right: 0.5em;
				height: 1em;
				width: 1em;
			}

			.vertical-spacer {
				/* make sure that subtitle-container always takes up space if it's empty */
				height: 1.4em;
			}

			img {
				/* This will be overriden in the img.style.width */
				width: 15em;
				/* since height/width are set directly on img tags, the aspect ratio will be right */
				height: auto;
			}

			.sub-title-container {
				display:flex;
				flex-direction:row;
				/* some cards have lots of synonyms etc */
				flex-wrap: wrap;
				align-items: center;
				/* total hack to consume most of the vertical space of the
				h1 above it. This would break on cards with a
				title_alternate but no title */
				margin-top: -1.4em;
			}

			.title-container [data-field=title] {
				flex:1;
			}

			[data-field=title_alternates]{
				color: var(--app-dark-text-color);
				font-size: 0.7em;
				font-weight: bold;
				margin: 0;
				margin-right: 0.5em;
			}

			[data-field=title_alternates] span {
				font-weight: normal;
			}

			.scroll-indicators {
				/* inspired by https://stackoverflow.com/questions/9333379/check-if-an-elements-content-is-overflowing */
				background:
					/* Shadow covers */
					linear-gradient(var(--effective-background-color) 30%, rgba(var(--effective-background-color-rgb-inner),0)),
					linear-gradient(rgba(var(--effective-background-color-rgb-inner),0), var(--effective-background-color) 70%) 0 100%,
					
					/* Shadows */
					radial-gradient(50% 0, farthest-side, rgba(var(--card-overflow-shadow-rgb-inner),.2), rgba(var(--card-overflow-shadow-rgb-inner),0)),
					radial-gradient(50% 100%,farthest-side, rgba(var(--card-overflow-shadow-rgb-inner),.2), rgba(var(--card-overflow-shadow-rgb-inner),0)) 0 100%;
				background:
					/* Shadow covers */
					linear-gradient(var(--effective-background-color) 30%, rgba(var(--effective-background-color-rgb-inner),0)),
					linear-gradient(rgba(var(--effective-background-color-rgb-inner),0), var(--effective-background-color) 70%) 0 100%,
					
					/* Shadows */
					radial-gradient(farthest-side at 50% 0, rgba(var(--card-overflow-shadow-rgb-inner),.2), rgba(var(--card-overflow-shadow-rgb-inner),0)),
					radial-gradient(farthest-side at 50% 100%, rgba(var(--card-overflow-shadow-rgb-inner),.2), rgba(var(--card-overflow-shadow-rgb-inner),0)) 0 100%;
				background-repeat: no-repeat;
				background-size: 100% 2.5em, 100% 2.5em, 100% 0.5em, 100% 0.5em;
				background-attachment: local, local, scroll, scroll;
			}

			/* Google docs pasted output includes <p> inside of li a lot. This
			is a hack, #361 covers fixing it */
			li > p {
				display:inline;
			}
		`
	];

	override render() {
		const cardType = this._card.card_type || 'content';
		const cardTypeConfig = CARD_TYPE_CONFIGURATION[cardType];
		const fieldsToRender = editableFieldsForCardType(cardType);
		const titleFields : CardFieldTypeEditable[] = [];
		const nonScrollableFields : CardFieldTypeEditable[] = [];
		const scrollableFields : CardFieldTypeEditable[] = [];
		for (const [fieldName,fieldConfig] of TypedObject.entries(fieldsToRender)) {
			if (fieldName == TEXT_FIELD_TITLE) {
				titleFields.push(fieldName);
			} else if (fieldConfig.nonScrollable) {
				nonScrollableFields.push(fieldName);
			} else {
				scrollableFields.push(fieldName);
			}
		}
		const condensedReferenceBlocks = [];
		const normalReferenceBlocks = [];
		for (const block of this.expandedReferenceBlocks || []) {
			if (block.condensed) {
				condensedReferenceBlocks.push(block);
			} else {
				normalReferenceBlocks.push(block);
			}
		}
		return html`
			<div class="container ${this.editing ? 'editing' : ''} ${this._card.published ? 'published' : 'unpublished'} ${cardType}">
				<div class='background'></div>
				<div class='content'>
					<div class='title-container'>
						${(titleFields.length || nonScrollableFields.length) && cardTypeConfig.iconName ? html`${icons[cardTypeConfig.iconName]}` : ''}
						<div>
							${titleFields.map(fieldName => this._templateForField(fieldName))}
							<div class='sub-title-container'>
								<div class='vertical-spacer'></div>
								${nonScrollableFields.map(fieldName => this._templateForField(fieldName))}
								${condensedReferenceBlocks.map(block => html`<reference-block .block=${block}></reference-block>`)}
							</div>
						</div>
					</div>
					<div class='primary show-scroll-if-needed scroller'>
						${scrollableFields.map(fieldName => this._templateForField(fieldName))}
					</div>
					<div class='reference-blocks show-scroll-if-needed scroller'>
						${normalReferenceBlocks.map(block => html`<reference-block .block=${block}></reference-block>`)}
					</div>
				</div>
				${starBadge(this._card.star_count)}
			</div>
		`;
	}

	get _card() {
		return this.card || EMPTY_PROCESSED_CARD;
	}

	_handleClick(e : MouseEvent) {
		//We only cancel link following if editing is true
		if (!this.editing) return;
		const ele = e.composedPath()[0];
		if (!(ele instanceof HTMLElement)) throw new Error('not html element');
		if (ele.localName != 'a') return;
		const aEle = ele as HTMLAnchorElement;
		//Links that will open a new tab are fine
		if (aEle.target == '_blank') return;
		e.preventDefault();

	}

	_handleTrack(e : GestureEvent) {
		if (e.detail.state != 'start' && e.detail.state != 'end') {
			return;
		}

		const startX = e.detail.x - e.detail.dx;
		const startY = e.detail.y - e.detail.dy;
		const key = `${startX},${startY}`;
		const currentTimestamp = e.timeStamp;

		if (e.detail.state == 'start') {
			// Save start data for later, but should not be handled further.
			startGestureTimestamps[key] = currentTimestamp;
			return;
		}

		// Gesture is ending.
		const startTimestamp = startGestureTimestamps[key];
		delete startGestureTimestamps[key];
		const gestureDuration = currentTimestamp - startTimestamp;

		// Discard gestures with a duration greater than the threshold.
		if (gestureDuration > SWIPE_MAX_GESTURE_DURATION) {
			return;
		}

		if (e.detail.dx > SWIPE_DX) {
			this.dispatchEvent(makeCardSwipedEvent('right'));
		}
		if (e.detail.dx < - 1 *SWIPE_DX) {
			this.dispatchEvent(makeCardSwipedEvent('left'));
		}
	}

	override firstUpdated() {
		this.addEventListener('click', e => this._handleClick(e));
		Gestures.addListener(this, 'track', (e : GestureEvent) => this._handleTrack(e));
		document.addEventListener('selectionchange', this._selectionChanged.bind(this));
	}

	constructor() {
		super();
		this._elements = {};
	}

	_textFieldChanged(e : InputEvent) {
		const ele = e.composedPath()[0];
		if (!(ele instanceof HTMLElement)) throw new Error('not html element');
		const rawField = ele.dataset.field;
		if (!rawField) throw new Error('no field dataset');
		const field = rawField as CardFieldTypeEditable;
		const config = TEXT_FIELD_CONFIGURATION[field];
		if (!config) throw new Error('unknown field type');
		const value = config.html ? ele.innerHTML : ele.innerText;
		this.dispatchEvent(makeEditableCardFieldUpdatedEvent(field, value));
	}

	_selectionChanged() {
		const shadowRoot = this.shadowRoot as ShadowRootWithGetSelection;
		const selection = shadowRoot.getSelection();
		if (!selection.focusNode) return;
		reportSelectionRange(selection.getRangeAt(0));
	}

	_templateForField(field : CardFieldTypeEditable) {
		const config = TEXT_FIELD_CONFIGURATION[field] || {};

		//If the update to body came from contentEditable then don't change it,
		//the state is already in it. If we were to update it, the selection state
		//would reset and defocus.
		const updatedFromContentEditable = (this.updatedFromContentEditable || {})[field];
		//If the last update to the field came from content editable, and we
		//already ahve an element, AND it's the currently selected element, then
		//we don't want to mess with its focus, so return the same thing. If
		//it's not focused, then we can update it however we want.
		const isActiveElement = deepActiveElement() == this._elements[field];
		const doHighlightConcepts = !this.editing || !isActiveElement;
		if (updatedFromContentEditable && this._elements[field] && isActiveElement && this._elements[field].conceptReferencesHighlighted == doHighlightConcepts) {
			return this._elements[field];
		}

		let value = this._card[field] || '';
		let htmlToSet = '';
		if (config.html) {
			//If not editing, then highlight. But even if editing, if the field
			//is blurred, show which items are concepts. We strip out any
			//card-highlights that come from contenteditable, so even if they
			//sneak in we won't save them.
			if (doHighlightConcepts && isProcessedCard(this._card)) {
				value = highlightConceptReferences(this._card, field, this.suggestedConcepts);
			}
			htmlToSet = value;
		}
		if (value && config.htmlFormatter) htmlToSet = config.htmlFormatter(value);
		if (value && config.displayPrefix) htmlToSet = '<span>' + config.displayPrefix + '</span> ' + value;
		if (!value && !this.editing) {
			if (this._card.full_bleed) {
				value = '';
			} else {
				if (this._card.id != EMPTY_CARD_ID) {
					htmlToSet = '<span class=\'loading\'>Content goes here...</span>';
				} else if (this.dataIsFullyLoaded) {
					htmlToSet = 'No card by that name, try a link from above.';
				} else {
					htmlToSet = '<span class=\'loading\'>Loading...<span>';
				}
			}
		}

		let ele = this._elements[field];

		if (!ele) {
			ele = document.createElement(config.container || 'span');
			this._elements[field] = ele;
			ele.field = field;
			ele.dataset.field = field;
		}

		//Add or remove a font size boost if there is one for this card and fieldName.
		let fontSizeBoost = '';
		if (!this.editing && this._card.font_size_boost && this._card.font_size_boost[field]) {
			fontSizeBoost = (1.0 + this._card.font_size_boost[field]) + 'em';
		}
		ele.style.fontSize = fontSizeBoost;

		if (!value && config.hideIfEmpty) {
			ele.setAttribute('hidden', '');
		} else {
			ele.removeAttribute('hidden');
		}

		ele.conceptReferencesHighlighted = doHighlightConcepts;

		if (this.editing && !config.noContentEditable) {
			makeElementContentEditable(ele);
			//Only install the content editable listeners once. Otherwise, you
			//get serious performance regressions as observed in #452.
			if (!ele.hasContentEditableListeners) {
				ele.addEventListener('input', this._textFieldChanged.bind(this));
				//When a content editable item is blurred, update it. This will have
				//the effect of normalizing HTML, since this overall handler will
				//run fully as long as the item is not selected. Yes, it's weird
				//that there's a change we react to that's not in the
				//state/properties of the object, but the focused node is state
				//managed by the browser so :shrug:.
				ele.addEventListener('blur', () => {
					//If there's a stashed selection offset, then we're being defocused to go to a find dialog.
					if (!ele.stashedSelectionOffset) this.requestUpdate();
				});
				//Highlights disappear on focus
				ele.addEventListener('focus', () => {
					//If there's a stashed selection offset, then when we're refocused, we'll have a paste happen.
					if (!ele.stashedSelectionOffset) this.requestUpdate();
				});
				ele.hasContentEditableListeners = true;
			}
			if (config.html) htmlToSet = normalizeBodyToContentEditable(htmlToSet);
		} else {
			//Ele might not be a fresh element, so make sure it's not editable if it's not supposed to be.
			ele.contentEditable = 'false';
		}

		if (config.html) {
			htmlToSet = dompurify.sanitize(htmlToSet, {
				ADD_ATTR: ['card', 'alternate'],
				ADD_TAGS: ['card-link', 'card-highlight'],
			});
			if (htmlToSet === '') {
				//This is a total hack. If the body is empty, then contenteditable
				//will have the first line of content in an anoymous top-level node,
				//even though makeElementContentEditable configures it to use <p>
				//for top-level elements, and even though the textarea will show the
				//first line of wrapped in <p>'s because that's what it's normalized
				//to but can't be reinjected into the contenteditable. If you then
				//link to anything in that first line, then it will put a <p> before
				//and after it for the rest of the content. If we just input
				//`<p></p>` as starter content then Chrome's contenteditable
				//wouldn't allow it to be focused. The answer is to inject a <p> so
				//that the first line has the right content, and include a
				//non-removable whitespace. Then, in the logic below in update(),
				//special case delete that content, leaving us with a content
				//editable that's selected, with the cursor starting out inside of
				//paragraph tags.
				htmlToSet = '<p>&nbsp;</p>';
			}
		}

		//Only set innerHTML if it came from this method; title is untrusted.
		if (htmlToSet) {
			ele.innerHTML = htmlToSet;
		} else {
			ele.innerText = value;
		}

		if (field == IMAGES_TEXT_FIELD) {
			const images = getImagesFromCard(this._card);
			let lastInsertedEle = null;
			for (const image of images) {
				const imgEle = document.createElement('img');
				setImageProperties(image, imgEle);
				if (lastInsertedEle) {
					lastInsertedEle.after(imgEle);
				} else {
					//First inserted image
					ele.prepend(imgEle);
				}
				lastInsertedEle = imgEle;
			}

		}

		ele.className = this._card.full_bleed ? 'full-bleed' : '';
		return ele;
	}

	override updated(changedProps : Map<string, CardRenderer[keyof CardRenderer]>) {
		if (changedProps.has('editing') && this.editing) {
			//If we just started editing, focus the content editable immediately
			//(the title if there's no title)
			if (this._elements[TEXT_FIELD_BODY]) {
				this._elements[TEXT_FIELD_BODY].focus();

				//Move the selection to the end of the content editable.
				if (this._card[TEXT_FIELD_BODY]) {
					const range = document.createRange();
					range.selectNodeContents(this._elements[TEXT_FIELD_BODY]);
					range.collapse(false);
					const sel = window.getSelection();
					sel.removeAllRanges();
					sel.addRange(range);
				} else {
					//This is a total hack, but in the special case where the
					//body is empty, we had to include an nbsp; so that the
					//cursor would render inside of the <p>, so delete it.
					document.execCommand('selectAll');
					document.execCommand('delete');
				}
			}
			//If the title is empty we _always_ want to select it
			if (!this._card[TEXT_FIELD_TITLE] && this._elements[TEXT_FIELD_TITLE]) {
				//If there isn't a title, we actually want the title focused
				//(after clearing out hte extra 'nbsp'. For some reason
				//Chrome doesn't actually focus the second item, unless we
				//do a timeout. :shrug:
				setTimeout(() => this._elements[TEXT_FIELD_TITLE].focus(), 0);
			}
		}
		//TODO: only run this if things that could have caused this to change
		//changed
		
		//Even though the DOM is supposed to have settled by when
		//updated() is called, the style properties still haven't (maybe because
		//the updates of children haven't yet completed?)
		setTimeout(() => this._setScrollingIndicators());

		if (this._currentImagesPromise) {
			//Make sure we're listening to any new images
			this.updateComplete.then(() => {
				this._listenForImageLoads();
				//Check to see if all images are loaded (for example, if they're all gone now)
				this._imageLoaded();
			});
		}
	}

	_setScrollingIndicators() {
		//Editing will have it change constantly as the user types so just skip
		//updating it unless it's not editing.
		if (this.editing) return;
		//We disable the overscroll indicators becuase on Chrome and safari they
		//can show a 1px line intermittently even if they're not
		//necessary--which is the vast majority of cards. This helps avoid that
		//artifact except in cases where the scrollbars might be necessary.
		for (const ele of this.shadowRoot.querySelectorAll('.show-scroll-if-needed') as NodeListOf<HTMLElement>) {
			const isScrollable = ele.scrollHeight > ele.offsetHeight;
			const hasScrollbars = isScrollable && ele.offsetWidth > ele.scrollWidth;
			if (isScrollable && !hasScrollbars) {
				ele.classList.add('scroll-indicators');
			} else {
				ele.classList.remove('scroll-indicators');
			}
		}
	}

	//called when an image with a load handler has loaded
	_imageLoaded() {
		//Remove this._currentImagesPromise
		if (!this._allImagesLoaded()) return;
		if (!this._currentImagesPromise) return;
		if (!this._currentImagesResolve) return;
		this._currentImagesPromise = null;
		this._currentImagesResolve(true);
		this._currentImagesResolve = null;
	}

	//returns true if all images are loaded
	_allImagesLoaded() {
		return [...this.shadowRoot.querySelectorAll('img')].every(img => img.complete);
	}

	_listenForImageLoads() {
		const imgs = [...this.shadowRoot.querySelectorAll('img')] as ExtenedHTMLImageElement[];
		for (const img of imgs) {
			if (img.complete) continue;
			if (img.hasImageLoadHandler) continue;
			img.addEventListener('load', () => this._imageLoaded());
			img.hasImageLoadHandler = true;
		}
	}

	//Returns a promise that is resolved when all images in the content of the
	//card are loaded.
	imagesLoaded() {
		if (this._allImagesLoaded()) return Promise.resolve(true);
		if (this._currentImagesPromise) return this._currentImagesPromise;

		//Install image load listeners where necessary. We'll need to redo this
		//if the element is updated again while this promse is still out.
		this._listenForImageLoads();

		this._currentImagesPromise = new Promise(resolve => {
			this._currentImagesResolve = resolve;
		});

		return this._currentImagesPromise;
	}

	//isOverflowing checks if any fields are overflowing--that is, that the
	//field's bounds are outside the bounds of the positioning parent. If
	//optFieldNames is provided, it will check just those fields, and if
	//optFieldNames is not provided it will check all of them.
	isOverflowing() {
		const ele = this.shadowRoot.querySelector('.primary') as HTMLElement;
		return ele.scrollHeight > ele.offsetHeight;
	}

}

declare global {
	interface HTMLElementTagNameMap {
		'card-renderer': CardRenderer;
	}
}
