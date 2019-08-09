const axios = require('axios');
const config = require('config');
const crypto = require('crypto');
const cryptico = require('cryptico-js');
const log = require('npmlog');
const MockAdapter = require('axios-mock-adapter');

const appConfig = require('../../../src/components/appConfig');
const lifecycleService = require('../../../src/services').lifecycleService;
const utils = require('../../../src/components/utils');

log.level = config.get('server.logLevel');
const mockAxios = new MockAdapter(axios);

const uniqueSeed = crypto.randomBytes(20).toString('hex');
const pubKey = cryptico.generateRSAKey(uniqueSeed, 1024);
const pubKeyString = cryptico.publicKeyString(pubKey);

describe('buildWebAdeCfg', () => {
  it('should yield a configuration and encrypted password with a common service', async () => {
    const result = await appConfig.buildWebAdeCfg({
      applicationAcronym: 'TEST',
      applicationName: 'name',
      applicationDescription: 'description',
      commonServices: ['cmsg'],
      deploymentMethod: 'deploymentDirect',
      webadeEnvironment: 'INT'
    }, pubKeyString);

    expect(result).toBeTruthy();
    expect(result.unencryptedPassword).toBeTruthy();
    expect(result.encryptedPassword).toBeTruthy();
    expect(result.webAdeCfg).toBeTruthy();
    expect(result.webAdeCfg.serviceClients[0].authorizations.length).toBeGreaterThan(0);
    expect(result.webAdeCfg.actions.length).toBeGreaterThan(0);
    expect(result.webAdeCfg.roles.length).toBeGreaterThan(0);
    expect(result.webAdeCfg.profiles.length).toBeGreaterThan(0);
  });

  it('should yield a configuration and encrypted password without a common service', async () => {
    const result = await appConfig.buildWebAdeCfg({
      applicationAcronym: 'TEST',
      applicationName: 'name',
      applicationDescription: 'description',
      commonServices: [],
      deploymentMethod: 'deploymentDirect',
      webadeEnvironment: 'INT'
    }, pubKeyString);

    expect(result).toBeTruthy();
    expect(result.unencryptedPassword).toBeTruthy();
    expect(result.encryptedPassword).toBeTruthy();
    expect(result.webAdeCfg).toBeTruthy();
    expect(result.webAdeCfg.serviceClients[0].authorizations.length).toBe(0);
  });
});

describe('postAppConfig', () => {
  const accountName = 'TEST_SERVICE_CLIENT';
  const encryptedPass = 'encryptedPassword';
  const token = '00000000-0000-0000-0000-000000000000';
  const userId = '00000000-0000-0000-0000-000000000000';
  const url = config.get('serviceClient.getokInt.endpoint') + '/applicationConfigurations';

  lifecycleService.create = jest.fn().mockResolvedValue();

  const spy = jest.spyOn(axios, 'post');
  const lifecycleSpy = jest.spyOn(lifecycleService, 'create');

  afterEach(() => {
    spy.mockClear();
    lifecycleSpy.mockClear();
  });

  it('should error if unable to acquire access token', async () => {
    utils.getWebAdeToken = jest.fn().mockReturnValue({
      error: 'error'
    });

    await expect(appConfig.postAppConfig({
      webadeEnvironment: 'INT'
    }, pubKeyString)).rejects.toThrowError('Unable to acquire access_token');
    expect(spy).toHaveBeenCalledTimes(0);
    expect(lifecycleSpy).not.toHaveBeenCalled();
  });

  it('should error if WebADE post returned an error', async () => {
    utils.getWebAdeToken = jest.fn().mockResolvedValue({
      access_token: token
    });

    const generatedConfig = {
      webAdeCfg: {
        serviceClients: [{
          accountName: accountName
        }]
      },
      unencryptedPassword: 'unencryptedPassword',
      encryptedPassword: encryptedPass
    };
    appConfig.buildWebAdeCfg = jest.fn().mockReturnValue(generatedConfig);

    mockAxios.onPost(url).reply(500);

    await expect(appConfig.postAppConfig({
      webadeEnvironment: 'INT'
    }, pubKeyString)).rejects.toThrowError(/^WebADE \/applicationConfigurations returned an error./);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(url, generatedConfig.webAdeCfg, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
    expect(lifecycleSpy).not.toHaveBeenCalled();
  });

  it('should yield a response upon successful WebADE post', async () => {
    const appAcronym = 'TEST';
    const webadeEnv = 'INT';

    utils.getWebAdeToken = jest.fn().mockResolvedValue({
      access_token: token
    });

    const generatedConfig = {
      webAdeCfg: {
        serviceClients: [{
          accountName: accountName
        }]
      },
      unencryptedPassword: 'unencryptedPassword',
      encryptedPassword: encryptedPass
    };
    appConfig.buildWebAdeCfg = jest.fn().mockReturnValue(generatedConfig);

    const response = 'webAdeResponseObject';
    mockAxios.onPost(url).reply(200, response);

    const result = await appConfig.postAppConfig({
      applicationAcronym: appAcronym,
      applicationName: 'name',
      applicationDescription: 'description',
      commonServices: ['cmsg'],
      deploymentMethod: 'deploymentDirect',
      webadeEnvironment: webadeEnv
    }, pubKeyString, userId);

    expect(result).toBeTruthy();
    expect(result.webAdeResponse).toEqual(response);
    expect(result.generatedPassword).toEqual(encryptedPass);
    expect(result.generatedServiceClient).toEqual(accountName);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(url, generatedConfig.webAdeCfg, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
    expect(lifecycleSpy).toHaveBeenCalledTimes(1);
    expect(lifecycleSpy).toHaveBeenCalledWith(appAcronym, generatedConfig.webAdeCfg, webadeEnv, userId);
  });
});
