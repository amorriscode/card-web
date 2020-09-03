import { html } from '@polymer/lit-element';
import { PageViewElement } from './page-view-element.js';
import { connect } from 'pwa-helpers/connect-mixin.js';

// This element is connected to the Redux store.
import { store } from '../store.js';

//lazy-load the permissions reducer
import permissions from '../reducers/permissions.js';
store.addReducers({
	permissions,
});

import { 
	selectUserMayEditPermissions,
	selectAllPermissions,
	selectUserPermissionsLoaded
} from '../selectors.js';

import {
	connectLivePermissions
} from '../actions/permissions.js';


import {
	USER_TYPE_ALL_PERMISSIONS,
	USER_TYPE_ANONYMOUS_PERMISSIONS,
	USER_TYPE_SIGNED_IN_PERMISSIONS,
	USER_TYPE_SIGNED_IN_DOMAIN_PERMISSIONS,
} from '../../config.GENERATED.SECRET.js';

// These are the shared styles needed by this element.
import { SharedStyles } from './shared-styles.js';

import './permissions-editor.js';

class PermissionsView extends connect(store)(PageViewElement) {
	render() {
		return html`
	  ${SharedStyles}
	  <style>
		:host {
			height: 100%;
			overflow: scroll; 
		}
	  </style>
      <section>
        <h2>Permissions</h2>
        <p>This page is where permissions can be changed.</p>
        <div ?hidden=${this._userMayEditPermissions}>
		  <p ?hidden=${this._permissionsLoaded}><strong>Loading...</strong></p>
          <p ?hidden=${!this._permissionsLoaded}>You aren't allowed to edit permissions, so nothing is available here.</p>
        </div>
		<div ?hidden=${!this._userMayEditPermissions}>
			<permissions-editor .title=${'Base permissions override'} .permissions=${USER_TYPE_ALL_PERMISSIONS} .description=${'Change these in your config.SECRET.json'}></permissions-editor>
			<permissions-editor .title=${'Anonymous permissions override'} .permissions=${USER_TYPE_ANONYMOUS_PERMISSIONS} .description=${'Change these in your config.SECRET.json'}></permissions-editor>
			<permissions-editor .title=${'Signed In permissions override'} .permissions=${USER_TYPE_SIGNED_IN_PERMISSIONS} .description=${'Change these in your config.SECRET.json'}></permissions-editor>
			<permissions-editor .title=${'Signed In Domain permissions override'} .permissions=${USER_TYPE_SIGNED_IN_DOMAIN_PERMISSIONS} .description=${'Change these in your config.SECRET.json'}></permissions-editor>
			${Object.keys(this._allPermissions || {}).map(uid => html`<permissions-editor .uid=${uid}></permissions-editor>`)}
        </div>
      </section>
    `;
	}

	static get properties() {
		return {
			_userMayEditPermissions: { type: Boolean},
			_allPermissions: { type: Object },
			_permissionsLoaded: { type: Boolean },
		};
	}

	stateChanged(state) {
		this._userMayEditPermissions = selectUserMayEditPermissions(state);
		this._allPermissions = selectAllPermissions(state);
		this._permissionsLoaded = selectUserPermissionsLoaded(state);
	}

	updated(changedProps) {
		if (changedProps.has('_userMayEditPermissions')) {
			if (this._userMayEditPermissions) {
				connectLivePermissions();
			}
		}
	}

}

window.customElements.define('permissions-view', PermissionsView);
