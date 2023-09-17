import {
	FirebaseOptions
} from 'firebase/app';

import {
	TabConfig,
	TabConfigOverrides,
	UserPermissions
} from '../src/types.js';

export type FirebaseProdDevOptions = {
	prod?: FirebaseOptions,
	dev?: FirebaseOptions
};

export type Config = {
	app_title : string;
	app_description : string;
	seo : boolean;
	google_analytics? : string;
	twitter_handle? : string;
	openai_api_key? : string;
	disable_persistence? : boolean;
	disable_anonymous_login? : boolean;
	disable_service_worker? : boolean;
	disable_callable_cloud_functions? : boolean;
	tabs? : TabConfig;
	tab_overrides? : TabConfigOverrides;
	//TODO: type this more tightly
	region? : string;
	user_domain? : string;
	permissions? : {
		all? : UserPermissions;
		anonymous? : UserPermissions;
		signed_in? : UserPermissions;
		signed_in_domain? : UserPermissions;
	}
	firebase: FirebaseProdDevOptions | FirebaseOptions;
};