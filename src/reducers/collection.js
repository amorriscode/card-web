import {
	SHOW_CARD,
	UPDATE_COLLECTION,
	COMMIT_PENDING_COLLECTION_MODIFICATIONS
} from '../actions/collection.js';

import {
	UPDATE_SECTIONS,
	UPDATE_CARDS,
	UPDATE_TAGS,
} from '../actions/data.js';

import {
	UPDATE_STARS,
	UPDATE_READS,
	UPDATE_READING_LIST,
} from '../actions/user.js';

import {
	setUnion,
	setRemove,
	prettyTime,
	cardHasContent,
	cardHasNotes,
	cardHasTodo,
	toTitleCase,
	cardMatchingFilters,
	cardMissingReciprocalLinks,
	cardHasSubstantiveContent
} from '../util.js';

import {
	tweetOrderExtractor,
} from './tweet-helpers.js';

export const DEFAULT_SET_NAME = 'all';
//reading-list is a set (as well as filters, e.g. `in-reading-list`) since the
//order matters and is customizable by the user. Every other collection starts
//from the `all` set and then filters and then maybe sorts, but reading-list
//lets a custom order.
export const READING_LIST_SET_NAME = 'reading-list';

//Note: every time you add a new set name, add it here too and make sure that a
//filter of that name is kept updated.
export const FILTER_EQUIVALENTS_FOR_SET = {
	[DEFAULT_SET_NAME]: 'in-all-set',
	[READING_LIST_SET_NAME]: 'in-reading-list',
};

//If filter names have this character in them then they're actually a union of
//the filters
export const UNION_FILTER_DELIMITER = '+';

export const SET_NAMES = Object.entries(FILTER_EQUIVALENTS_FOR_SET).map(entry => entry[0]);

//The word in the URL That means "the part after this is a sort".
export const SORT_URL_KEYWORD = 'sort';
export const SORT_REVERSED_URL_KEYWORD = 'reverse';

export const DEFAULT_SORT_NAME = 'default';
export const RECENT_SORT_NAME = 'recent';

const sectionNameForCard = (card, sections) => {
	let section = sections[card.section];
	return section ? section.title : '';
};

//EAch sort is an extractor, a description (currently just useful for
//documentation; not shown anywhere), and a labelName to show in the drawer next
//to the label that extractor returns. The extractor is given the card object
//and the sections info map, and a map of all cards, and returns an array, where
//the 0 index is the raw value to compare for sorting, and the 1th value is the
//label to display. All sorts are currently assumed to be DESCENDING; if there's
//a new one that isn't, then add a property to config called ascending and
//toggle that.
export const SORTS = {
	//Default sort is a no-op.
	[DEFAULT_SORT_NAME]: {
		extractor: (card, sections) => [0, sectionNameForCard(card, sections)],
		description: 'The default order of the cards within each section in order',
		labelName: 'Section',
	},
	'link-count': {
		extractor: (card) => {
			const inbound_links = card.links_inbound || [];
			return [inbound_links.length, '' + inbound_links.length];
		},
		description: 'In descending order by number of inbound links',
		labelName: 'Link Count',
	},
	'updated': {
		extractor: (card) => {
			const timestamp = card.updated_substantive;
			return [timestamp ? timestamp.seconds : 0, prettyTime(timestamp)];
		},
		description: 'In descending order by when each card was last substantively updated',
		labelName:'Updated',
	},
	'stars': {
		extractor: (card) => [card.star_count || 0, '' + card.star_count],
		description: 'In descending order by number of stars',
		labelName: 'Stars',
	},
	'commented': {
		extractor: (card) => {
			const timestamp = card.updated_message;
			return [timestamp ? timestamp.seconds : 0, prettyTime(timestamp)];
		},
		description: 'In descending order by when each card last had a new message',
		labelName: 'Commented',
	},
	[RECENT_SORT_NAME]: {
		extractor: (card) => {
			const messageValue = card.updated_message ? card.updated_message.seconds : 0;
			const updatedValue = card.updated_substantive ? card.updated_substantive.seconds : 0;
			const usingMessageValue = messageValue > updatedValue;
			const value = usingMessageValue ? messageValue : updatedValue;
			const timestamp = usingMessageValue ? card.updated_message : card.updated_substantive;
			return [value, prettyTime(timestamp)];
		},
		description: 'In descending order by when each card was last updated or had a new message',
		labelName: 'Last Activity',
	},
	'last-tweeted': {
		extractor: (card) => {
			return [card.last_tweeted.seconds, prettyTime(card.last_tweeted)];
		},
		description: 'In descending order of when they were last auto-tweeted',
		labelName: 'Tweeted'
	},
	'tweet-count': {
		extractor: (card) => [card.tweet_count, '' + card.tweet_count],
		description: 'In descending order of how many times the card has been tweeted',
		labelName: 'Tweet Count',
	},
	'tweet-order': {
		extractor: tweetOrderExtractor,
		description: 'In descending order of the ones that are most deserving of a tweet',
		labelName: 'Tweet Worthiness',
	}
};

const defaultCardFilterName = (basename) => {
	return ['has-' + basename, 'no-' + basename, 'does-not-need-' + basename, 'needs-' + basename];
};

const FREEFORM_TODO_KEY = 'freeform-todo';
export const TODO_COMBINED_FILTER_NAME = 'has-todo';
const TODO_COMBINED_INVERSE_FILTER_NAME = 'no-todo';

const cardMayHaveAutoTODO = card => {
	return card && card.card_type == 'content';
};

//These are the enum values in CARD_FILTER_CONFIGS that configure whether an
//item is a TODO or not.

//TODO_TYPE_NA is for card filters that are not TODOs
const TODO_TYPE_NA = {
	type: 'na',
	isTODO: false,
};
//TODO_TYPE_AUTO is for card filters that are TODOs and are auto-set, meaning that
//their key is legal in auto_todo_overrides.
const TODO_TYPE_AUTO = {
	type: 'auto',
	isTODO: true,
};

//TODO_TYPE_FREEFORM is for card filters that are TODOs but are set via the freeform
//notes property and are not valid keys in auto_todo_overrides.
const TODO_TYPE_FREEFORM = {
	type: 'freeform',
	isTODO: true,
};

//Card filters are filters that can tell if a given card is in it given only the
//card object itself. They're so common that in order to reduce extra machinery
//they're factored into a single config here and all of the other machinery uses
//it (and extends with non-card-filter-types as appropriate). The keys of each
//config object are used as the keys in card.auto_todo_overrides map.
const CARD_FILTER_CONFIGS = {
	//tuple of good/bad filtername (good is primary), including no-todo/todo version if applicable, then the card->in-filter test, then one of the TODO_TYPE enum values.
	'comments': [defaultCardFilterName('comments'), card => card.thread_count, TODO_TYPE_NA],
	'notes': [defaultCardFilterName('notes'), card => cardHasNotes(card), TODO_TYPE_NA],
	'slug': [defaultCardFilterName('slug'), card => card.slugs && card.slugs.length, TODO_TYPE_AUTO],
	'content': [defaultCardFilterName('content'), card => cardHasContent(card), TODO_TYPE_AUTO],
	'substantive-content': [defaultCardFilterName('substantive-content'), card => cardHasSubstantiveContent(card), TODO_TYPE_AUTO],
	'links': [defaultCardFilterName('links'), card => card.links && card.links.length, TODO_TYPE_AUTO],
	'inbound-links': [defaultCardFilterName('inbound-links'), card => card.links_inbound && card.links_inbound.length, TODO_TYPE_AUTO],
	'reciprocal-links': [['has-all-reciprocal-links', 'missing-reciprocal-links', 'does-not-need-reciprocal-links', 'needs-reciprocal-links'], card => cardMissingReciprocalLinks(card).length == 0, TODO_TYPE_AUTO],
	'tags': [defaultCardFilterName('tags'), card => card.tags && card.tags.length, TODO_TYPE_AUTO],
	'published': [['published', 'unpublished', 'does-not-need-to-be-published', 'needs-to-be-published'], card => card.published, TODO_TYPE_AUTO],
	'tweet': [defaultCardFilterName('tweet'), card => card.tweet_count > 0, TODO_TYPE_NA],
	//TODO_COMBINED_FILTERS looks for the fourth key in the filtername array, so
	//we just duplicate the first two since they're the same (the reason they'd
	//differ is if there's an override key and that could make the has- and
	//needs- filters be different, and there isn't.)
	[FREEFORM_TODO_KEY]: [['no-freeform-todo', 'has-freeform-todo', 'no-freeform-todo', 'has-freeform-todo'], card => !cardHasTodo(card), TODO_TYPE_FREEFORM],
};

//REVERSE_CARD_FILTER_CXONFIG_MAP maps the filter names, e.g. 'has-links',
//'needs-links', 'does-not-need-links' to 'links'. Need to use a function
//literal not an arrow func because arrow funcs don't close over and we need
//entry[0].
export const REVERSE_CARD_FILTER_CONFIG_MAP = Object.fromEntries(Object.entries(CARD_FILTER_CONFIGS).map(entry => entry[1][0].map(function(filterNameListItem) {return [filterNameListItem, entry[0]];})).flat(1));


//TODO_ALL_INFOS is TODO_INFOS but also with an entry for FREEFORM_TODO_KEY. Use
//TODO_INFOS for any tag-list in editing mode as the FREEFORM_TODO_KEY isn't a
//valid key to set inoverrides; this is useful for the case where we want to
//non-editing show auto-todos.
export const TODO_ALL_INFOS = Object.fromEntries(Object.entries(CARD_FILTER_CONFIGS).filter(entry => entry[1][2].isTODO).map(entry => [entry[0], {id: entry[0], suppressLink: true, title: toTitleCase(entry[0].split('-').join(' '))}]));

//TODO_INFOS are appropriate to pass into tag-list.tagInfos as options to enable or disable.
export const TODO_AUTO_INFOS = Object.fromEntries(Object.entries(TODO_ALL_INFOS).filter(entry => CARD_FILTER_CONFIGS[entry[0]][2] == TODO_TYPE_AUTO));

//TODO_CONFIG_KEYS is all of the keys into CARD_FILTER_CONFIG that represent the
//set of items that count as a TODO.
const TODO_CONFIG_KEYS = Object.fromEntries(Object.entries(CARD_FILTER_CONFIGS).filter(entry => entry[1][2].isTODO).map(entry => [entry[0], true]));

//TODO_OVERRIDE_LEGAL_KEYS reflects the only keys that are legal to set in card.auto_todo_overrides
export const TODO_OVERRIDE_LEGAL_KEYS = Object.fromEntries(Object.entries(TODO_CONFIG_KEYS).filter(entry => CARD_FILTER_CONFIGS[entry[0]][2] == TODO_TYPE_AUTO));

//TODO_COMBINED_FILTERS represents the set of all filter names who, if ANY is
//true, the given card should be considered to have a todo.
export const TODO_COMBINED_FILTERS = Object.fromEntries(Object.entries(TODO_CONFIG_KEYS).map(entry => [CARD_FILTER_CONFIGS[entry[0]][0][3], true]));

//cardTodoConfigKeys returns the card filter keys (which index into for example
//TODO_INFOS) representing the todos that are active for this card. If
//onlyNonOverrides is true, then it will skip any keys that are only true because
//they're overridden to true.
export const cardTodoConfigKeys = (card, onlyNonOverrides) => {
	//TODO: this ideally should be in util.js (with the other cardHasContent
	//functions), but because of entanglement of constants this has to live next
	//to these constants.
	if (!card) return [];

	let result = [];

	for (let configKey of Object.keys(CARD_FILTER_CONFIGS)) {
		const config = CARD_FILTER_CONFIGS[configKey];
		if (!config[2].isTODO) continue;
		if (config[2] == TODO_TYPE_AUTO) {
			if (!cardMayHaveAutoTODO(card)) continue;
			if (card.auto_todo_overrides[configKey] === false) continue;
		}
		const done = config[1](card);
		if (!done || (!onlyNonOverrides && card.auto_todo_overrides[configKey] === true)) {
			result.push(configKey);
		}
	}
	return result;
};

//Theser are filters who are the inverse of another, smaller set. Instead of
//creating a whole set of "all cards minus those", we keep track of them as
//exclude sets.
export const INVERSE_FILTER_NAMES = Object.assign(
	{
		'unstarred': 'starred',
		'unread': 'read',
		[TODO_COMBINED_INVERSE_FILTER_NAME]: TODO_COMBINED_FILTER_NAME,
	},
	Object.fromEntries(Object.entries(FILTER_EQUIVALENTS_FOR_SET).map(entry => ['not-' + entry[1], entry[1]])),
	//extend with ones for all of the card filters badsed on that config
	Object.fromEntries(Object.entries(CARD_FILTER_CONFIGS).map(entry => [entry[1][0][1], entry[1][0][0]])),
	//Add the inverse need filters (skipping ones htat are not a TODO)
	Object.fromEntries(Object.entries(CARD_FILTER_CONFIGS).filter(entry => entry[1][2] == TODO_TYPE_AUTO).map(entry => [entry[1][0][3], entry[1][0][2]]))
);

//We pull this out because it has to be the same in filters and pendingFilters
//and to avoid having to duplicate it.
const INITIAL_STATE_FILTERS = Object.assign(
	{
		//None will match nothing. We use it for orphans.
		none: {},
		starred: {},
		read: {},
		[TODO_COMBINED_FILTER_NAME]: {},
	},
	Object.fromEntries(Object.entries(FILTER_EQUIVALENTS_FOR_SET).map(entry => [entry[1], {}])),
	//extend with ones for all of the card filters based on the config.
	Object.fromEntries(Object.entries(CARD_FILTER_CONFIGS).map(entry => [entry[1][0][0], {}])),
	//extend with the does-not-need filters
	Object.fromEntries(Object.entries(CARD_FILTER_CONFIGS).filter(entry => entry[1][2] == TODO_TYPE_AUTO).map(entry => [entry[1][0][2], {}]))
);

const INITIAL_STATE = {
	activeSetName: DEFAULT_SET_NAME,
	//activeFilterNames is the list of named filters to apply to the default
	//set. These names are either concrete filters, inverse filters, or union
	//filters (i.e. they concatenate conrete or inverse filternames delimited by
	//'+'). For the purposes of processing URLs though they can all be treated
	//as though they're concrete filters named their literal name in this.
	activeFilterNames: [],
	activeSortName: DEFAULT_SORT_NAME,
	activeSortReversed: false,
	//These are the actual values of the filters in current use. We queue up
	//changes in pendingFilters and then synchronize this value to that value
	//when we know it's OK for the collection to change.
	filters: INITIAL_STATE_FILTERS,
	//The things that modify filters actuall modify pendingFilters. Only when we
	//receive a COMMIT_PENDING_COLLECTION_MODIFICATIONS do we copy over the modifications.
	pendingFilters: INITIAL_STATE_FILTERS,
	//requestCard is the identifier specifically requested in the URL. This
	//could be the card's ID, a slug for that card, or a special placeholder
	//like `_`. The fully resolved activeCard is stored in activeCardId.
	requestedCard: '',
	//the fully resolved literal ID of the active card (not slug, not special
	//placeholder).
	activeCardId: '',
};

const app = (state = INITIAL_STATE, action) => {
	switch (action.type) {
	case SHOW_CARD:
		return {
			...state,
			requestedCard: action.requestedCard,
			activeCardId: action.card,
		};
	case UPDATE_COLLECTION:
		return {
			...state,
			activeSetName: action.setName,
			activeFilterNames: [...action.filters],
			activeSortName: action.sortName,
			activeSortReversed: action.sortReversed,
		};
	case COMMIT_PENDING_COLLECTION_MODIFICATIONS:
		//TODO: figure out how to fire this every time one of the other ones
		//that updates filters is fired if it's before data fully loaded.
		return {
			...state,
			filters: {...state.pendingFilters},
		};
	case UPDATE_SECTIONS:
		return {
			...state,
			pendingFilters: {...state.pendingFilters, ...makeFilterFromSection(action.sections, true)}
		};
	case UPDATE_TAGS:
		return {
			...state,
			pendingFilters: {...state.pendingFilters, ...makeFilterFromSection(action.tags, false)}
		};
	case UPDATE_CARDS:
		return {
			...state,
			pendingFilters: {...state.pendingFilters, ...makeFilterFromCards(action.cards, state.pendingFilters)}
		};
	case UPDATE_STARS:
		return {
			...state,
			pendingFilters: {...state.pendingFilters, starred: setUnion(setRemove(state.pendingFilters.starred, action.starsToRemove), action.starsToAdd)}
		};
	case UPDATE_READS:
		return {
			...state,
			pendingFilters: {...state.pendingFilters, read: setUnion(setRemove(state.pendingFilters.read, action.readsToRemove), action.readsToAdd)}
		};
	case UPDATE_READING_LIST:
		return {
			...state,
			pendingFilters: {...state.pendingFilters, ...makeFilterFromReadingList(action.list)}
		};
	default:
		return state;
	}
};

const makeFilterFromReadingList = (readingList) => {
	return {
		[FILTER_EQUIVALENTS_FOR_SET[READING_LIST_SET_NAME]]: Object.fromEntries(readingList.map(id => [id, true]))
	};
};

const makeFilterFromSection = (sections, includeDefaultSet) => {
	let result = {};
	let combinedSet = {};
	for (let key of Object.keys(sections)) {
		let filter = {};
		let section = sections[key];
		section.cards.forEach(card => {
			filter[card] = true;
			combinedSet[card] = true;
		});
		result[key] = filter;
	}
	if (includeDefaultSet) result[FILTER_EQUIVALENTS_FOR_SET[DEFAULT_SET_NAME]] = combinedSet;
	return result;
};

const makeFilterFromCards = (cards, previousFilters) => {
	let result = {};
	for(let [key, config] of Object.entries(CARD_FILTER_CONFIGS)) {
		const filterName = config[0][0];
		const filterFunc = config[1];
		let newMatchingCards = [];
		let newNonMatchingCards = [];
		for (let card of Object.values(cards)) {
			//filterFunc matching means that the card is DONE for that TODO. So
			//we should consider each one done if the card can't have autotodos.
			if(filterFunc(card) || !cardMayHaveAutoTODO(card)) {
				newMatchingCards.push(card.id);
			} else {
				newNonMatchingCards.push(card.id);
			}
		}
		const updatedFilter = setUnion(setRemove(previousFilters[filterName], newNonMatchingCards), newMatchingCards);
		result[filterName] = updatedFilter;
		//Bail out of next step for card filters that don't have todo overrides
		if (config[2] != TODO_TYPE_AUTO) continue;
		const doesNotNeedFilterName = config[0][2];
		let newMatchingDoesNotNeedCards = [];
		let newNonMatchingDoesNotNeedCards = [];
		for (let card of Object.values(cards)) {
			//cards are on the does-not-need (good!) list if they are NOT in the has-FOO list
			if (card.auto_todo_overrides[key] === false) {
				newMatchingDoesNotNeedCards.push(card.id);
			} else if (card.auto_todo_overrides[key] === true) {
				newNonMatchingDoesNotNeedCards.push(card.id);
			} else if (updatedFilter[card.id]) {
				//This will also correctly handle cards that may not have an
				//autotodo, becuase they've already been set to true for
				//matching the 'done' filter above.
				newMatchingDoesNotNeedCards.push(card.id);
			} else {
				newNonMatchingDoesNotNeedCards.push(card.id);
			}
		}
		result[doesNotNeedFilterName] = setUnion(setRemove(previousFilters[doesNotNeedFilterName], newNonMatchingDoesNotNeedCards), newMatchingDoesNotNeedCards);
	}
	//Now do the combined todo, which can only be done once all of the card-filters is updated to its final value.
	//Note: this logic presumes that all of the TODO_FILTER_NAMES are all card filters, and thus in the result set.
	let newMatchingTodoCards = [];
	let newNonMatchingTodoCards = [];
	for (let  card of Object.values(cards)) {
		let matchingTodoFilters = cardMatchingFilters(card, result, TODO_COMBINED_FILTERS, INVERSE_FILTER_NAMES);
		if (matchingTodoFilters.length) {
			newMatchingTodoCards.push(card.id);
		} else {
			newNonMatchingTodoCards.push(card.id);
		}
	}
	//AS long as the TODO_COMBINED_FILTER_NAME is a set based only on th3e card
	//itself, then this logic should work, because its TODO could only have
	//changed if the card itself changed.
	result[TODO_COMBINED_FILTER_NAME] = setUnion(setRemove(previousFilters[TODO_COMBINED_FILTER_NAME], newNonMatchingTodoCards), newMatchingTodoCards);
	return result;
};

export default app;