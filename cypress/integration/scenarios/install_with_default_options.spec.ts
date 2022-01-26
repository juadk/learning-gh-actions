import { Epinio } from '~/cypress/support/epinio';
import { TopLevelMenu } from '~/cypress/support/toplevelmenu';

Cypress.config();
const epinio = new Epinio();
const topLevelMenu = new TopLevelMenu();

describe('First login on Rancher', () => {
  it('Log in and accept terms and conditions', () => {
    cy.runFirstConnectionTest();
  });
});

describe('Epinio installation with default options', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/home');
    topLevelMenu.openIfClosed();
  });

  it('Add the Epinio helm repo', () => {
    topLevelMenu.clusters('local');
    cy.addHelmRepo({repoName: 'epinio-repo', repoUrl: 'https://epinio.github.io/helm-charts'});
  });

  it('Install Epinio', () => {
    topLevelMenu.clusters('local');
    // Boolean must be forced to false otherwise code is failing
    cy.epinioInstall({s3: false, extRegistry: false});
  });
});

describe('Menu testing', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/home');
    topLevelMenu.openIfClosed();
  });
  
  it('Check Epinio menu', () => {
    // Epinio's icon should appear in the side menu
    epinio.epinioIcon().should('exist');

    // Click on the Epinio's logo as well as your Epinio instance 
    epinio.accessEpinioMenu(Cypress.env('cluster'));

    // Check Epinio's side menu
    epinio.checkEpinioNav();
  });
});

describe('Applications testing', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/home');
    topLevelMenu.openIfClosed();
    epinio.accessEpinioMenu(Cypress.env('cluster'));
  });

  it('Push a 5 instances application with container image into default namespace and check it', () => {
    cy.runApplicationsTest('multipleInstanceAndContainer');
  });

  it('Push application with custom route into default namespace and check it', () => {
    cy.runApplicationsTest('customRoute');
  });

  it('Push application with env vars and Git URL into default namespace and check it', () => {
    cy.runApplicationsTest('envVarsAndGitUrl');
  });

  it('Push a 5 instances application with mixed options into default namespace and check it', () => {
    cy.runApplicationsTest('allTests');
  });
});

describe('Services testing', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/home');
    topLevelMenu.openIfClosed();
    epinio.accessEpinioMenu(Cypress.env('cluster'));
  });

  it('Create an application with a service, unbind the service and delete all', () => {
    cy.runServicesTest('newAppWithService');
  });

  it('Bind a created service to an existing application and delete all', () => {
    cy.runServicesTest('bindServiceOnApp');
  });
});

describe('Namespaces testing', () => {
    beforeEach(() => {
      cy.login();
      cy.visit('/home');
      topLevelMenu.openIfClosed();
      epinio.accessEpinioMenu(Cypress.env('cluster'));
    });
  
    it('Push and check an application into the created namespace', () => {
      cy.runNamespacesTest('newNamespace');
    });
  
    it('Try to push an application without any namespace', () => {
      cy.runNamespacesTest('withoutNamespace');
    });
  });

describe('Epinio uninstallation testing', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/home');
    topLevelMenu.openIfClosed();
    cy.get('.clusters').contains('local').click()
  });

  it('Uninstall Epinio', () => {
    cy.epinioUninstall();
  });

  it('Remove the Epinio helm repo', () => {
    cy.removeHelmRepo();
  });
});
