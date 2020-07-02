
import {
	isWhitespace
} from './util.js';

const replaceAsWithCardLinks = (body) => {
	//Replaces all a's with card-links.
	//TODO: consider modifying the actual nodes in place, which is more robust.;
	body = body.split('<a').join('<card-link');
	body = body.split('</a>').join('</card-link>');
	return body;
};

const replaceCardLinksWithAs = (body) => {
	//Inverse of replaceAwsWithCardLinks
	body = body.split('<card-link').join('<a');
	body = body.split('</card-link>').join('</a>');
	return body;
};

const hrefToCardAttribute = (cardLink) => {
  
	let cardAttribute = cardLink.getAttribute('card');
	//Sometimes the HTML erroneously has a normal href in the card, so look for
	//that too and put it in the href property, where we expect it to be. See
	//#97.
	if (cardAttribute) {
		cardLink.setAttribute('href', cardAttribute);
		cardLink.removeAttribute('card');
	}

	let href = cardLink.getAttribute('href');

	if (!href) return;
	if (href.startsWith('/')) return;
	if (href.startsWith('http://')) return;
	if (href.startsWith('https://')) return;

	cardLink.setAttribute('card', href);
	cardLink.removeAttribute('href');

};

const cardAttributeToHref = (a) => {

	let card = a.getAttribute('card');

	if (!card) return;

	a.setAttribute('href', card);
	a.removeAttribute('card');

};
const normalizeBodyFromContentEditable = (html) => {

	//Rewrite elements from content editable form to canonical form (which is
	//primarily replacing <a>'s with <card-link>.)

	//This transform should be the inverse, semantically, of normalizeBodyFromCotentEditable

	html = replaceAsWithCardLinks(html);

	//This is the part where we do live-node fix-ups of stuff that
	//contenteditable might have erroneously spewed in.

	let section = document.createElement('section');
	//TODO: catch syntax errors
	section.innerHTML = html;

	//createLink will have <a href='cardid'>. We will have changed the <a> to
	//<card-link> already, but the href should be a card attribute.
	section.querySelectorAll('card-link').forEach(hrefToCardAttribute);

	return section.innerHTML;
};

export const normalizeBodyToContentEditable = (html) => {
	//inverse transform of normalizeBodyFromContentEditable. contentEditable
	//expects links to be, for example, actual link elements. We only do
	//transforms that are necessary for Chrome's content editable to understand
	//our content. For example, although Chrome's content editable places <b>'s,
	//it understands that <strong>'s are the same thing for the purpose of
	//unbolding.

	html = replaceCardLinksWithAs(html);

	//This is the part where we do live-node fix-ups of stuff that
	//contenteditable might have erroneously spewed in.

	let section = document.createElement('section');
	//TODO: catch syntax errors
	section.innerHTML = html;

	section.querySelectorAll('a').forEach(cardAttributeToHref);

	return section.innerHTML;

};

const removeZombieSpans = (ele) => {
	//Remove zombie spans (which can show up if you backspace to remove
	//a paragraph break, and then can start infecting all content as you
	//edit.)

	//We used to only treat spans as zombies if they had specific styles in
	//them, but zombies show up way more often than that. The new policy is to
	//assume that EVERY span is a zombie. If you want to have some kind of
	//styling, use literally any other kind of element. Spans and fonts are
	//special because they are likely to be injected somewhat randomly by
	//contenteditable, but nothing else is (well, excdept for p since that's the
	//paragraph separator).

	if (ele.children.length > 0) {
		for (let child of ele.children) {
			removeZombieSpans(child);
		}
	}

	let removedZombies = false;
	for (let child of Object.values(ele.childNodes)) {
		if (child.localName == 'span' || child.localName == 'font') {
			//Replace it with either just the text if it's only got 
			child.replaceWith(...child.childNodes);
			removedZombies = true;
		}
	}
	//Combine adjacent text nodes, otherwise when you add back in a space it
	//will show as &nbsp; because it will be between two runs not within one.
	if (removedZombies) ele.normalize();
};

const cleanUpTopLevelHTML = (html, tag = 'p') => {
	//Does deeper changes that require parsing.
	//1) make sure all text in top is within a p tag.
	//2) make sure that p elements don't have any line breaks inside.
	let section = document.createElement('section');
	section.innerHTML = html;
	let children = section.childNodes;
	for (let child of Object.values(children)) {
		if (child.nodeType == Node.TEXT_NODE) {
			if (isWhitespace(child.textContent)) {
				//It's all text content, just get rid of it
				child.parentNode.removeChild(child);
				continue;
			}
			//OK, it's not all whitespace, so wrap it in a default element.
			let ele = document.createElement(tag);
			ele.innerText = child.textContent.trim();
			child.parentNode.replaceChild(ele, child);
			//Deliberately drop dwon into the next processing step.
			child = ele;
		}
		if (child.nodeType == Node.ELEMENT_NODE) {
			if (isWhitespace(child.innerText)) {
				child.parentNode.removeChild(child);
				continue;
			}

			removeZombieSpans(child);

			let inner = child.innerHTML;
			inner = inner.trim();
			child.innerHTML = inner;

			if (child.localName == 'ol' || child.localName == 'ul') {
				child.innerHTML = cleanUpTopLevelHTML(child.innerHTML, 'li');
			}
		}

	}

	return section.innerHTML;

};

export const normalizeBodyHTML = (html) => {

	if (!html) return html;

	//normalizeBodyHTML makes sure that the html is well formatted. It first
	//does basic string processing to clean it up, and then does node
	//modification. Thus, it assumes the HTML is always valid. This is true if
	//the html is coming directly from a contentEditable, or if it's the final
	//stage before commit.

	//normalizeBodyHTML should do processing on the HTML (that comes potentially
	//from contentEditable) to represent it in a sane, simple way that should
	//ideally not change the display of the content, just structure the markup
	//differently.

	//Ensure that after every block element we have a new line. Don't worry
	//about putting in extra; we'll remove them in the next step.

	//Do all gross tag replacements

	//If you have a link at the end and hit enter, it puts in a <br> in a <p>.
	html = html.split('<br>').join('');
	html = html.split('<b>').join('<strong>');
	html = html.split('</b>').join('</strong>');
	html = html.split('<i>').join('<em>');
	html = html.split('</i>').join('</em>');

	//Remove all line breaks. We'll put them back in.
	html = html.split('\n').join('');

	html = cleanUpTopLevelHTML(html);

	//Add in line breaks
	html = html.split('</p>').join('</p>\n');
	html = html.split('<ul>').join('<ul>\n');
	html = html.split('</ul>').join('</ul>\n');
	html = html.split('<ol>').join('<ol>\n');
	html = html.split('</ol>').join('</ol>\n');
	html = html.split('<li>').join('\t<li>');
	html = html.split('</li>').join('</li>\n');

	html = html.split('&nbsp;').join(' ');

	//Remove any extra linke breaks (which we might have added)
	//html = removeDoubleLineBreaks(html);

	return normalizeBodyFromContentEditable(html);

};