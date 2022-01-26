import './functions';
import './tests';

declare global {
  // eslint-disable-next-line no-unused-vars
  namespace Cypress {
    interface Chainable {
      // Functions declared in functions.ts
      login(username?: string, password?: string, cacheSession?: boolean,): Chainable<Element>;
      byLabel(label: string,): Chainable<Element>;
      clickButton(label: string,): Chainable<Element>;
      clickMenu(label: string,): Chainable<Element>;
      clickClusterMenu(listLabel: string[],): Chainable<Element>;
      confirmDelete(namespace?: string,): Chainable<Element>;
      checkStageStatus(numIndex: number, timeout?: number, status?: string,): Chainable<Element>;
      typeValue(label: string, value: string, noLabel?: boolean,): Chainable<Element>;
      typeKeyValue(key: string, value: string,): Chainable<Element>;
      getDetail(name: string, type: string, namespace?: string): Chainable<Element>;
      createApp(appName: string, archiveName: string, sourceType?: string, customPaketoImage?: string, route?: string, addVar?: string, instanceNum?: number, serviceName?: string, shouldBeDisabled?: boolean,): Chainable<Element>;
      checkApp(appName: string, namespace?: string, route?: string, checkVar?: boolean, checkService?: boolean, dontCheckRouteAccess?: boolean): Chainable<Element>;
      deleteApp(appName: string, state?: string,): Chainable<Element>;
      createNamespace(namespace: string,): Chainable<Element>;
      deleteNamespace(namespace: string, appName?: string,): Chainable<Element>;
      createService(serviceName: string, fromFile?: boolean, namespace?: string,): Chainable<Element>;
      deleteService(serviceName: string, namespace?: string,): Chainable<Element>;
      bindService(appName: string, serviceName: string, namespace?: string,): Chainable<Element>;
      addHelmRepo(repoName: string, repoUrl: string,): Chainable<Element>;
      removeHelmRepo(): Chainable<Element>;
      epinioInstall(s3?: boolean, extRegistry?: boolean,): Chainable<Element>;
      epinioUninstall(): Chainable<Element>;

      // Functions declared in tests.ts
      runApplicationsTest(testName: string,): Chainable<Element>;
      runServicesTest(testName: string,): Chainable<Element>;
      runNamespacesTest(testName: string,): Chainable<Element>;
      runFirstConnectionTest(): Chainable<Element>;
    }
}}

// TODO handle redirection errors better?
// we see a lot of 'error nagivation cancelled' uncaught exceptions that don't actually break anything; ignore them here
Cypress.on('uncaught:exception', (err, runnable) => {
  // returning false here prevents Cypress from failing the test
  if (err.message.includes('navigation guard')) {
    return false;
  }
});

require('cypress-dark');
