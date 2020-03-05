import 'nprogress/nprogress.css';
import axios from 'axios';
import NProgress from 'nprogress';
import Vue from 'vue';
import VueKeycloakJs from '@dsb-norge/vue-keycloak-js';

import App from '@/App.vue';
import router from '@/router';
import vuetify from '@/plugins/vuetify';

Vue.config.productionTip = false;

NProgress.start();

// Globally register all components with base in the name
const requireComponent = require.context('@/components', true, /Base[A-Z]\w+\.(vue|js)$/);
requireComponent.keys().forEach(fileName => {
  const componentConfig = requireComponent(fileName);
  const componentName = fileName.split('/').pop().replace(/\.\w+$/, '');
  Vue.component(componentName, componentConfig.default || componentConfig);
});

loadConfig();

/**
 * @function initializeApp
 * Initializes and mounts the Vue instance
 */
function initializeApp() {
  new Vue({
    router,
    vuetify,
    render: h => h(App)
  }).$mount('#app');
}

/**
 * @function loadConfig
 * Acquires the configuration state from the backend server
 */
async function loadConfig() {
  // App publicPath is ./ - so use relative path here, will hit the backend server using relative path to root.
  const configUrl = process.env.NODE_ENV === 'production' ? 'config' : 'app/config';
  const storageKey = 'config';

  try {
    // Get configuration if it isn't already in session storage
    if (sessionStorage.getItem(storageKey) === null) {
      const { data } = await axios.get(configUrl);
      sessionStorage.setItem(storageKey, JSON.stringify(data));
    }

    // Mount the configuration as a prototype for easier access from Vue
    const config = JSON.parse(sessionStorage.getItem(storageKey));
    Vue.prototype.$config = Object.freeze(config);

    if (!config || !config.keycloak ||
      !config.keycloak.clientId || !config.keycloak.realm || !config.keycloak.serverUrl) {
      throw new Error('Keycloak is misconfigured');
    }
    await loadKeycloak(config.keycloak);
  } catch (err) {
    sessionStorage.removeItem(storageKey);
    throw new Error(`Failed to acquire configuration: ${err.message}`);
  } finally {
    initializeApp();
    NProgress.done();
  }
}

/**
 * @function loadKeycloak
 * Applies Keycloak authentication capabilities
 * @param {object} kcConfig An object containing keycloak configuration data
 */
function loadKeycloak(kcConfig) {
  Vue.use(VueKeycloakJs, {
    init: { onLoad: 'check-sso' },
    config: {
      clientId: kcConfig.clientId,
      realm: kcConfig.realm,
      url: kcConfig.serverUrl
    },
    onReady: kc => {
      const timeout = 10000;
      // Generic Axios instance with timeout
      const instance = axios.create({ timeout: timeout });
      // API focused Axios instance with timeout and authorization header insertion
      const instanceApi = axios.create({
        baseURL: '/api/v1',
        timeout: timeout
      });

      instanceApi.interceptors.request.use(cfg => {
        if (kc.authenticated) {
          cfg.headers.Authorization = `Bearer ${kc.token}`;
        }
        return Promise.resolve(cfg);
      }, error => {
        return Promise.reject(error);
      });

      instanceApi.interceptors.response.use(response => {
        return Promise.resolve(response);
      }, error => {
        return Promise.reject(error);
      });

      // Make available to components
      Vue.prototype.$http = instance;
      Vue.prototype.$httpApi = instanceApi;
    },
    onInitError: error => {
      console.error('Keycloak failed to initialize'); // eslint-disable-line no-console
      console.error(error); // eslint-disable-line no-console
    }
  });
}
