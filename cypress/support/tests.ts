import cypress from 'cypress';
import { Epinio } from '~/cypress/support/epinio';
import './functions';

// First connexion test
Cypress.Commands.add('runFirstConnectionTest', () => {
  const epinio = new Epinio();

  cy.visit('/auth/login');
  cy.get("span").then($text => {
    if ($text.text().includes('your first time visiting Rancher')) {
      epinio.firstLogin();
    }
    else {
      cy.log('Rancher already initialized, no need to handle first login.');
    };
  });
});

// Applications tests
Cypress.Commands.add('runApplicationsTest', (testName: string) => {
  const appName = 'testapp';
  const archive = 'sample-app.tar.gz';
  const customRoute = 'custom-route-' + appName + '.' + Cypress.env('system_domain');
  const paketobuild = 'paketobuildpacks/builder:tiny';
  const gitUrl = 'https://github.com/epinio/git-url-app-test';

  // Create an application on default namespace and check it
  switch (testName) {
    case 'multipleInstanceAndContainer':
      cy.createApp({appName: appName, archiveName: 'httpd:latest', instanceNum: 5, sourceType: 'Container Image'});
      cy.checkApp({appName: appName, dontCheckRouteAccess: true});
      break;
    case 'customRoute':
      cy.createApp({appName: appName, archiveName: archive, route: customRoute});
      cy.checkApp({appName: appName, route: customRoute});
      break;
    case 'envVarsAndGitUrl':
      cy.createApp({appName: appName, archiveName: gitUrl, customPaketoImage: paketobuild, addVar: 'ui', sourceType: 'Git URL'});
      cy.checkApp({appName: appName, checkVar: true});
      break;
    case 'allTests':
      cy.createApp({appName: appName, archiveName: gitUrl, customPaketoImage: paketobuild, instanceNum: 5, addVar: 'ui', route: customRoute, sourceType: 'Git URL'});
      cy.checkApp({appName: appName, checkVar: true, route: customRoute});
      break;
  }

  // Delete the tested application
  cy.deleteApp({appName: appName});
});

// Services tests
Cypress.Commands.add('runServicesTest', (testName: string) => {
  const appName = 'testapp';
  const archive = 'sample-app.tar.gz'
  const service = 'service01';

  switch (testName) {
    case 'newAppWithService':
      // Create a new service
      cy.createService({serviceName: service});

      // Create an application with the newly created service and check it
      cy.createApp({appName: appName, archiveName: archive, serviceName: service});
      cy.checkApp({appName: appName, checkService: true});

      // Unbind and delete the created service
      cy.deleteService({serviceName: service});
      cy.checkApp({appName: appName});

      // Delete the tested application
      cy.deleteApp({appName: appName});
      break;
    case 'bindServiceOnApp':
      // Create another new service
      cy.createService({serviceName: service, fromFile: true});

      // Create an application *WITHOUT* any service
      cy.createApp({appName: appName, archiveName: archive, addVar: 'file'});
      cy.checkApp({appName: appName});

      // Bind the created service to the application and check it
      cy.bindService({appName: appName, serviceName: service});
      cy.checkApp({appName: appName, checkService: true, checkVar: true});

      // Delete the tested application and the service
      cy.deleteApp({appName: appName});
      cy.deleteService({serviceName: service});
      break;
  }
});

// Namespaces tests
Cypress.Commands.add('runNamespacesTest', (testName: string) => {
  const appName = 'testapp';
  const archive = 'sample-app.tar.gz';
  const defaultNamespace = 'workspace';
  const namespace = 'mynamespace';

  switch (testName) {
    case 'newNamespace':
      // Create a new namespace
      cy.createNamespace(namespace);

      // Create an application on the new namespace and check it
      cy.createApp({appName: appName, archiveName: archive});
      cy.checkApp({appName: appName, namespace: namespace});

      // Delete the namespace
      cy.deleteNamespace({namespace: namespace, appName: appName});
      break;
    case 'withoutNamespace':
      // Delete default namespace
      cy.deleteNamespace({namespace: defaultNamespace});

      // Try to create the application
      cy.createApp({appName: appName, archiveName: archive, shouldBeDisabled: true});

      // Re-create default namespace
      cy.createNamespace(defaultNamespace);
      break;
  }
});
