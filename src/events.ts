import {
    CardID,
    ComposedCommentMessage
} from './types.js';

type TagEventDetail = {
    tag : string,
    subtle : boolean,
};

export type TagEvent = CustomEvent<TagEventDetail>;

export const TAG_TAPPED_EVENT_NAME = 'tag-tapped';
//TODO: change to 'tag-added'
export const TAG_ADDED_EVENT_NAME = 'add-tag';
//TODO: change to 'tag-removed'
export const TAG_REMOVED_EVENT_NAME = 'remove-tag';

export const makeTagTappedEvent = (tagName : string, subtle? : boolean) : TagEvent => {
    return makeTagEvent(TAG_TAPPED_EVENT_NAME, tagName, subtle);
}

export const makeTagAddedEvent = (tagName : string) : TagEvent => {
    return makeTagEvent(TAG_ADDED_EVENT_NAME, tagName);
}

export const makeTagRemovedEvent = (tagName : string) : TagEvent => {
    return makeTagEvent(TAG_REMOVED_EVENT_NAME, tagName);
}

const makeTagEvent = (eventName : string, tagName : string, subtle : boolean = false) : TagEvent => {
    return new CustomEvent(eventName, {composed: true, detail: {tag: tagName, subtle}});
}

export type NewTagEvent = CustomEvent<null>;

//TODO: change to 'tag-new'
export const TAG_NEW_EVENT_NAME = 'new-tag';

export const makeTagNewEvent = () : NewTagEvent => {
    return new CustomEvent(TAG_NEW_EVENT_NAME, {composed : true, detail: null})
}

export type ShowNeedSigninEvent = CustomEvent<null>;

export const SHOW_NEED_SIGNIN_EVENT_NAME = 'show-need-signin';

export const makeShowNeedSigninEvent = () : ShowNeedSigninEvent => {
    return new CustomEvent(SHOW_NEED_SIGNIN_EVENT_NAME, {composed : true, detail: null})
}

type CardHoveredEventDetail = {
    card : CardID;
    x : number;
    y : number;
}

export type CardHoveredEvent = CustomEvent<CardHoveredEventDetail>;

export const CARD_HOVERED_EVENT_NAME = 'card-hovered';

export const makeCardHoveredEvent = (card : CardID, x : number, y : number) : CardHoveredEvent => {
    return new CustomEvent(CARD_HOVERED_EVENT_NAME, {composed : true, detail: {card, x, y}});
}

type ThumbnailTappedDetail = {
    card : CardID;
    ctrl : boolean;
}

export type ThumbnailTappedEvent = CustomEvent<ThumbnailTappedDetail>;

export const THUMBNAIL_TAPPED_EVENT_NAME = 'thumbnail-tapped';

export const makeThumbnailTappedEvent = (card : CardID, ctrl : boolean) : ThumbnailTappedEvent => {
    return new CustomEvent(THUMBNAIL_TAPPED_EVENT_NAME, {composed : true, detail: {card, ctrl}});
}

type UpdateRenderOffsetDetail = {
    value : number;
}

export type UpdateRenderOffsetEvent = CustomEvent<UpdateRenderOffsetDetail>;

export const UPDATE_RENDER_OFFSET_EVENT_NAME = 'update-render-offset';

export const makeUpdateRenderOffsetEvent = (value : number) : UpdateRenderOffsetEvent => {
    return new CustomEvent(UPDATE_RENDER_OFFSET_EVENT_NAME, {composed : true, detail : {value}});
};

type DialogShouldCloseDetail = {
    cancelled : boolean;
}

export type DialogShouldCloseEvent = CustomEvent<DialogShouldCloseDetail>;

export const DIALOG_SHOULD_CLOSE_EVENT_NAME = 'dialog-should-close';

export const makeDialogShouldCloseEvent = (cancelled : boolean = false) : DialogShouldCloseEvent => {
    return new CustomEvent(DIALOG_SHOULD_CLOSE_EVENT_NAME, {composed : true, detail: {cancelled}});
}

type CommentMessageDetail = {
    message : ComposedCommentMessage;
}

export type CommmentMessageEvent = CustomEvent<CommentMessageDetail>;

export const COMMENT_EDIT_MESSAGE_NAME = 'edit-message';

export const makeCommentEditMessageEvent = (message : ComposedCommentMessage) : CommmentMessageEvent => {
    return new CustomEvent(COMMENT_EDIT_MESSAGE_NAME, {composed : true, detail: {message}});
}