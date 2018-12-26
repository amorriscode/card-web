import { html } from '@polymer/lit-element';
import { PageViewElement } from './page-view-element.js';
import { connect } from 'pwa-helpers/connect-mixin.js';

// This element is connected to the Redux store.
import { store } from '../store.js';

import changes from '../reducers/changes.js';
store.addReducers({
  changes
});

import {
  navigateToChangesNumDays
} from '../actions/app.js';

// These are the shared styles needed by this element.
import { SharedStyles } from './shared-styles.js';

class RecentChangesView extends connect(store)(PageViewElement) {
  render() {
    return html`
      ${SharedStyles}
      <h2>Recent Changes</h2>
      <p>This is where recent changes will go, I guess.</p>
    `
  }

  extractPageExtra(pageExtra) {
    let parts = pageExtra.split("/");
    let firstPart = parts[0];
    if (!firstPart) {
      return -1;
    }
    let numDays = parseInt(firstPart);
    return numDays;
  }

  static get properties() {
    return {
      _numDays: {type: Number}
    }
  }

  stateChanged(state) {
    this._numDays = this.extractPageExtra(state.app.pageExtra);
  }

  updated(changedProps) {
    if(changedProps.has('_numDays')) {
      if (this._numDays < 0) {
        store.dispatch(navigateToChangesNumDays(7));
      }
    }
  }


}

window.customElements.define('recent-changes-view', RecentChangesView);
