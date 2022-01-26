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

describe('Epinio installation testing with s3 and external registry configured', () => {
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
    cy.epinioInstall({s3: true, extRegistry: true});
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

  it('Deploy an application to test external registry / s3', () => {
    cy.runApplicationsTest('multipleInstanceAndContainer');
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
