import {
	storage,
	getCardByIDOrSlug,
	getCardLinkCardsForCard,
	urlForBasicCard,
	DEV_MODE,
	LAST_DEPLOY_AFFECTING_RENDERING,
	WINDOW_INJECT_FETCHED_CARD_NAME,
	WINDOW_CARD_RENDERED_VARIABLE
} from './common.js';

import * as puppeteer from 'puppeteer';
import md5 from 'md5';

//JSON.stringify is not deterministic, but we need it to be to use as a hash.
import stringify from 'json-stringify-deterministic';
import { Card, CardID, CardIdentifier } from './types.js';

//SCREENSHOT_VERSION should be incremented whenever the settings or generation
//logic changes, such that a fetch for an unchanged card should generate a new
//screenshot.
const SCREENSHOT_VERSION = 7;
const SCREENSHOT_WIDTH = 1330;
const SCREENSHOT_HEIGHT = 768;

//By default screenshot cache is disabled in dev, but you can turn it off here
//to test taht screenshot caching works in dev.
const DISABLE_SCREENSHOT_CACHE_IN_DEV = true;

//When true, won't use the screenshot cache but will instead just generate a new
//one. Shouldn't be left on in production.
const MANUAL_DISABLE_SCREENSHOT_CACHE_IN_PROD = false;

const DISABLE_SCREENSHOT_CACHE = DEV_MODE ? DISABLE_SCREENSHOT_CACHE_IN_DEV : MANUAL_DISABLE_SCREENSHOT_CACHE_IN_PROD;

//The default bucket is already configured, just use that
const screenshotBucket = storage.bucket();

const screenshotFileNameForCard = (card : Card, cardLinkCards : Record<CardID, Card>) => {
	//This logic should include any parts of the card that might change the
	//visual display of the card. The logic can change anytime the
	//SCREENSHOT_VERSION increments.

	const title = card.title || '';
	const subtitle = card.subtitle || '';
	const body = card.body || '';
	const starCount = String(card.star_count || 0);
	const images = card.images || [];
	const imagesJSON = stringify(images);

	const publishedCardKeys = Object.keys(cardLinkCards).filter(key => cardLinkCards[key].published);
	publishedCardKeys.sort();

	const str = title + ':' + subtitle + ':' + body + ':' + starCount + ':' + publishedCardKeys.join('+') + ':' + imagesJSON;

	const hash = md5(str);

	//include the last prod deploy in the screenshot cache key because any time
	//prod is deployed, the card rendering might have changed. Note that this is
	//slightly in error because now we use the card renderer that is deployed
	//for this project, not just the prod rendrer as before.
	return 'screenshots/v' + SCREENSHOT_VERSION + '/' + LAST_DEPLOY_AFFECTING_RENDERING + '/' + card.id + '/' + hash + '.png';
};

export const fetchScreenshotByIDOrSlug = async (idOrSlug : CardIdentifier) => {
	const card = await getCardByIDOrSlug(idOrSlug);
	if (!card) {
		console.warn('No such card: ' + idOrSlug);
		return null;
	}
	return await fetchScreenshot(card);
};

export const fetchScreenshot = async(card : Card) =>{
	if (!card) {
		console.warn('No card provided');
		return null;
	}
	if (!card.published) {
		console.warn('The card wasn\'t published');
		return null;
	}
	const cardLinkCards = await getCardLinkCardsForCard(card);
	const filename = screenshotFileNameForCard(card, cardLinkCards);
	const file = screenshotBucket.file(filename);
	const existsResponse = await file.exists();
	if (existsResponse[0]) {
		if (DISABLE_SCREENSHOT_CACHE) {
			console.log('Screenshot exists in cache, but the cache has been disabled.');
		} else {
			//Screenshot exists, return it
			const downloadFileResponse = await file.download();
			return downloadFileResponse[0];
		}
	}
	console.log('Screenshot ' + filename + ' didn\'t exist in storage, creating.');
	const screenshot = await makeScreenshot(card, cardLinkCards);
	await file.save(screenshot);
	return screenshot;
};

const makeScreenshot = async (card : Card, cardLinkCards : Record<CardID, Card>) => {
	const browser = await puppeteer.launch({
		defaultViewport: {
			width: SCREENSHOT_WIDTH,
			height: SCREENSHOT_HEIGHT
		},
		args: ['--no-sandbox'],
	});

	const page = await browser.newPage();
	//forward any console messages from the page to our own log
	page.on('console', e => {
		console.log('Page logged via console: ' + e.text());
	});

	//Wait for networkidle0, otherwise bold fonts etc might not have finished
	//loading.
	await page.goto(urlForBasicCard(card.id), {
		waitUntil: 'networkidle2',
	});

	//networkidle2 doesn't wait long enough, so wait until we can inject the card
	await page.waitForFunction('window[\'' + WINDOW_INJECT_FETCHED_CARD_NAME + '\'] !== undefined');

	//Inject in the card directly, which should short-circuit the firebase fetch.
	//This function is run in the context of the page, where in injectFetchedCard exists. We'll do some checks to convince typescript to not freak out.
	await page.evaluate((card, cards) => {
		//eslint-disable-next-line no-undef
		if (!('injectFetchedCard' in window) || typeof window.injectFetchedCard != 'function') throw new Error('no inject card');
		//eslint-disable-next-line no-undef
		window.injectFetchedCard(card, cards);
	}, card, cardLinkCards) ;

	//Make sure the fonts are fully loaded, since networkidle2 likely won't wait for them
	await page.waitForFunction('document.fonts.status == \'loaded\'');

	//Wait for the signal that the card has been fetched and rendered
	await page.waitForFunction('window.' + WINDOW_CARD_RENDERED_VARIABLE);

	//Wait a little bit longer just for good measure, especially since the card
	//fades in as it loads in basic-card-viewer.
	await page.waitForTimeout(1000);
	const png = await page.screenshot();
	await browser.close();
	return png;
};