import { Epinio } from '~/cypress/support/epinio';
import { TopLevelMenu } from '~/cypress/support/toplevelmenu';

Cypress.config();
describe('Services testing', () => {
  const topLevelMenu = new TopLevelMenu();
  const epinio = new Epinio();

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
