//NOTE: this next one is duplicated in tweet-helpers.js and both are in
//functions/updates.js;
export const REFERENCES_INFO_CARD_PROPERTY = 'references_info';
//Also referenced directly in firestore.TEMPLATE.rules
export const REFERENCES_INFO_INBOUND_CARD_PROPERTY = 'references_info_inbound';
//These two properties are exactly like the normal references fields exccept
//it's a map of cardID -> true for cards that are referenced.
export const REFERENCES_CARD_PROPERTY = 'references';
//Also referenced directly in firestore.TEMPLATE.rules
export const REFERENCES_INBOUND_CARD_PROPERTY = 'references_inbound';

//Recreated in functions/src/embedding.ts
export const TEXT_FIELD_BODY = 'body';
export const TEXT_FIELD_TITLE = 'title';
export const TEXT_FIELD_SUBTITLE = 'subtitle';
//Also duplicated in card-renderer styles
export const TEXT_FIELD_TITLE_ALTERNATES = 'title_alternates';
export const TEXT_FIELD_REFERENCES_INFO_INBOUND = REFERENCES_INFO_INBOUND_CARD_PROPERTY;
export const TEXT_FIELD_REFERENCES_NON_LINK_OUTBOUND = 'non_link_references';
export const TEXT_FIELD_RERERENCES_CONCEPT_OUTBOUND = 'concept_references';

//CardFieldType and EditableCardFieldType is driven off of these keys. Note the
//membership in each object need to be consistent with
//TEXT_fIELD_CONIGURATION.readOnly

export const TEXT_FIELD_TYPES_EDITABLE = {
	[TEXT_FIELD_BODY]: true,
	[TEXT_FIELD_TITLE]: true,
	[TEXT_FIELD_SUBTITLE]: true,
	[TEXT_FIELD_TITLE_ALTERNATES]: true
} as const;

export const TEXT_FIELD_TYPES = {
	...TEXT_FIELD_TYPES_EDITABLE,
	[TEXT_FIELD_REFERENCES_INFO_INBOUND]: true,
	[TEXT_FIELD_REFERENCES_NON_LINK_OUTBOUND]: true,
	[TEXT_FIELD_RERERENCES_CONCEPT_OUTBOUND]: true,
};

export const CARDS_COLLECTION = 'cards';
export const CARD_UPDATES_COLLECTION = 'updates';
export const SECTION_UPDATES_COLLECTION = 'updates';
export const SECTIONS_COLLECTION = 'sections';
export const TAGS_COLLECTION = 'tags';
export const TAG_UPDATES_COLLECTION = 'updates';
export const MAINTENANCE_COLLECTION = 'maintenance_tasks';
export const AUTHORS_COLLECTION = 'authors';
export const THREADS_COLLECTION = 'threads';
export const MESSAGES_COLLECTION = 'messages';
export const STARS_COLLECTION = 'stars';
export const READS_COLLECTION = 'reads';
//The user of this is actually clsoer to "userInfos", but that sounded weird.
//This is a cache of information related to users, like whether htey're
//anonymous, and when they were last seen. We never use it on the client, just
//report up so the info exists on the server.
export const USERS_COLLECTION = 'users';
export const READING_LISTS_COLLECTION = 'reading_lists';
export const READING_LISTS_UPDATES_COLLECTION = 'updates';
export const PERMISSIONS_COLLECTION = 'permissions';
export const TWEETS_COLLECTION = 'tweets';

export const FIND_CARD_OPEN = 'FIND_CARD_OPEN';
export const FIND_CARD_TO_LINK = 'FIND_CARD_TO_LINK';
export const FIND_CARD_TO_REFERENCE = 'FIND_CARD_TO_REFERENCE';
export const FIND_CARD_TO_PERMISSION = 'FIND_CARD_TO_PERMISSION';