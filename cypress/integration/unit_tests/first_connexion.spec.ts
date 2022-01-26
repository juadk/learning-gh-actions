import { Epinio } from '~/cypress/support/epinio';
 
Cypress.config();
describe('First login on Rancher', () => {
   const epinio = new Epinio();

  it('Log in and accept terms and conditions', () => {
    cy.visit('/auth/login');
    cy.get("span").then($text => {
      if ($text.text().includes('your first time visiting Rancher')) {
        epinio.firstLogin();
      }
      else {
        cy.log('Rancher already initialized, no need to handle first login.')
      }
    })
  });
});
