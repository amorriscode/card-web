import {
	AnyAction
} from 'redux';

import {
	AI_REQUEST_STARTED,
	AI_RESULT,
	AI_DIALOG_CLOSE,
	AI_SET_ACTIVE_CARDS,
	AI_SHOW_ERROR,
	AI_SELECT_RESULT_INDEX
} from '../actions/ai.js';

import {
	AIState
} from '../types.js';

import {
	AI_DIALOG_TYPE_CARD_SUMMARY
} from '../type_constants.js';

const INITIAL_STATE : AIState = {
	open: false,
	active: false,
	kind: AI_DIALOG_TYPE_CARD_SUMMARY,
	selectedIndex: -1,
	result: [],
	error: '',
	allCards: [],
	filteredCards: []
};

const app = (state : AIState = INITIAL_STATE, action : AnyAction) : AIState => {
	switch (action.type) {
	case AI_REQUEST_STARTED:
		return {
			...state,
			active: true,
			open: true,
			kind: action.kind,
			selectedIndex: -1,
			allCards: [],
			filteredCards: []
		};
	case AI_RESULT:
		return {
			...state,
			active: false,
			result: [...action.result]
		};
	case AI_SELECT_RESULT_INDEX:
		return {
			...state,
			selectedIndex: action.index
		};
	case AI_SHOW_ERROR:
		return {
			...state,
			active: false,
			error: action.error
		};
	case AI_DIALOG_CLOSE:
		return {
			...state,
			open: false
		};
	case AI_SET_ACTIVE_CARDS:
		return {
			...state,
			allCards: action.allCards,
			filteredCards: action.filteredCards
		};
	default:
		return state;
	}
};

export default app;