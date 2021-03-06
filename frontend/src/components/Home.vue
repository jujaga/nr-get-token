<template>
  <v-container v-if="!isAuthenticated">
    <v-row class="ma-md-12">
      <v-col cols="12" md="8" offset-md="2">
        <h2>Please log in to manage your access to any of the following Common Services:</h2>
        <ul class="mt-md-5">
          <li
            v-for="(item) in KeycloakCommonServiceList"
            :key="item.name"
          >{{item.abbreviation.toUpperCase()}} - {{item.name}}</li>
        </ul>
        <div class="text-center pt-12">
          <v-btn
            color="primary"
            class="login-btn"
            id="auth-login"
            @click="clearStorage"
            :href="authRoutes.LOGIN"
            medium
          >
            <span>Login</span>
          </v-btn>
        </div>
      </v-col>
    </v-row>
  </v-container>

  <v-container v-else>
    <v-row>
      <v-col cols="4">
        <v-img
          :src="require('@/assets/images/tokey.svg')"
          contain
          height="180"
          position="right"
          id="devModeTrigger"
        ></v-img>
      </v-col>
      <v-col cols="8">
        <v-img
          :src="require('@/assets/images/Get-Token_md.png')"
          class="my-3"
          contain
          height="150"
          position="left"
        ></v-img>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-card class="sectionCard">
          <v-toolbar flat color="grey lighten-3">
            <v-tabs v-model="tabControl" background-color="grey lighten-3" slider-color="blue">
              <v-tab :href="`#tab-1`">Submit Application Configuration</v-tab>
              <v-tab :href="`#tab-2`">WebADE Application Configuration Viewer</v-tab>
              <v-tab :href="`#tab-3`" v-if="hasReadAllWebade">Security Utils</v-tab>
            </v-tabs>
            <v-spacer></v-spacer>

            <v-tooltip bottom>
              <template v-slot:activator="{ on }">
                <v-btn
                  fab
                  small
                  color="primary"
                  v-on="on"
                  @click.stop="dialog = true"
                  @click="getHealthCheck"
                >
                  <v-icon>healing</v-icon>
                </v-btn>
              </template>
              <span>API Health Check</span>
            </v-tooltip>

            <v-dialog v-model="dialog" width="600">
              <v-card>
                <v-toolbar dark flat color="primary">
                  <v-icon right class="mr-2">healing</v-icon>

                  <v-toolbar-title class="text-center">API Health Check</v-toolbar-title>

                  <v-spacer></v-spacer>
                  <v-tooltip bottom>
                    <template v-slot:activator="{ on }">
                      <v-btn class="getHealthCheck" flat icon v-on="on" @click="getHealthCheck">
                        <v-icon>cached</v-icon>
                      </v-btn>
                    </template>
                    <span>Refresh</span>
                  </v-tooltip>
                </v-toolbar>

                <HealthCheck />

                <v-divider></v-divider>

                <v-card-actions>
                  <v-spacer></v-spacer>
                  <v-btn color="primary" text @click="dialog = false">Close</v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
          </v-toolbar>

          <v-tabs-items v-model="tabControl">
            <v-tab-item :value="`tab-1`">
              <div>
                <v-progress-linear v-if="configSubmissionInProgress" :indeterminate="true"></v-progress-linear>
                <v-alert
                  :value="configSubmissionSuccess != ''"
                  tile
                  icon="check"
                  type="success"
                  transition="scale-transition"
                >{{configSubmissionSuccess}}</v-alert>
                <v-alert
                  :value="configSubmissionError != ''"
                  tile
                  type="error"
                  transition="scale-transition"
                >{{configSubmissionError}}</v-alert>
              </div>
              <v-row>
                <v-col cols="12" md="5">
                  <ConfigForm></ConfigForm>
                </v-col>
                <v-col cols="12" md="6" offset-md="1" v-if="usingWebadeConfig">
                  <ConfigGeneratedJson></ConfigGeneratedJson>
                </v-col>
              </v-row>
            </v-tab-item>

            <v-tab-item :value="`tab-2`">
              <WebAdeVisualizer></WebAdeVisualizer>
            </v-tab-item>
            <v-tab-item :value="`tab-3`" v-if="hasReadAllWebade">
              <SecurityUtils></SecurityUtils>
            </v-tab-item>
          </v-tabs-items>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-if="devMode">
      <v-col cols="12">
        <v-card class="sectionCard">
          <v-toolbar flat color="grey lighten-3">
            <v-toolbar-title>DEBUG API Tester</v-toolbar-title>
          </v-toolbar>
          <ApiCheck></ApiCheck>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { mapGetters } from 'vuex';
import { CommonServiceList } from '@/utils/commonServices.js';
import { AuthRoutes } from '@/utils/constants.js';
import ApiCheck from './ApiCheck';
import ConfigForm from './ConfigForm';
import ConfigGeneratedJson from './ConfigGeneratedJson';
import HealthCheck from './HealthCheck';
import WebAdeVisualizer from './webAdeVisualizer/WebAdeVisualizer';
import SecurityUtils from './webAdeVisualizer/SecurityUtils';

export default {
  name: 'home',
  components: {
    ConfigForm,
    ConfigGeneratedJson,
    ApiCheck,
    HealthCheck,
    WebAdeVisualizer,
    SecurityUtils
  },
  data() {
    return {
      authRoutes: AuthRoutes,
      KeycloakCommonServiceList: CommonServiceList.filter( x => x.type === 'keycloak' ),
      dialog: false,
      tabControl: 'tab-1'
    };
  },
  computed: {
    ...mapGetters(['devMode']),
    ...mapGetters('auth', ['isAuthenticated', 'hasReadAllWebade']),
    ...mapGetters('configForm', [
      'configSubmissionSuccess',
      'configSubmissionError',
      'configSubmissionInProgress',
      'usingWebadeConfig'
    ])
  },
  methods: {
    clearStorage() {
      this.$store.commit('auth/setJwtToken');
      this.$store.commit('auth/setRefreshToken');
    },
    getHealthCheck() {
      this.$store.dispatch('checks/getHealthCheckStatus');
    }
  },
  mounted() {
    const pressed = [];
    const devModeCode =
      'ArrowUpArrowUpArrowDownArrowDownArrowLeftArrowRightArrowLeftArrowRightbaEnter';
    const devModeKeyLength = 11;
    window.addEventListener('keyup', e => {
      pressed.push(e.key);
      pressed.splice(-devModeKeyLength - 1, pressed.length - devModeKeyLength);
      if (pressed.join('').includes(devModeCode)) {
        this.$store.commit('setDevMode');
      }
    });
  }
};
</script>

<style>
h1 {
  margin-bottom: 10px;
}

.sectionCard {
  margin-bottom: 20px;
}

.jsonText textarea {
  font-family: 'Courier New', Courier, monospace;
}

.underRadioField {
  padding-left: 32px;
}

.buttonLink {
  text-decoration: none;
}
</style>
