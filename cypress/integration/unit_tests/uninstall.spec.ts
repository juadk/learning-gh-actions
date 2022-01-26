import { Epinio } from '~/cypress/support/epinio';
import { TopLevelMenu } from '~/cypress/support/toplevelmenu';

Cypress.config();
describe('Epinio uninstallation testing', () => {
  const topLevelMenu = new TopLevelMenu();
  const epinio = new Epinio();

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
