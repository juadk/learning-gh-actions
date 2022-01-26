export class Epinio {
  epinioIcon() {
    return cy.get('.option .icon.group-icon.icon-epinio');
  } 

  checkEpinioNav() {
    return cy.get('.list-unstyled > li').should(($lis) => {
      expect($lis).to.have.length(3);
      expect($lis.eq(0)).to.contain('Applications');
      expect($lis.eq(1)).to.contain('Services');
      expect($lis.eq(2)).to.contain('Namespaces');
    })
  }

  accessEpinioMenu(cluster: string) {
    cy.contains('Epinio').click();
    cy.contains('Epinio instances', {timeout: 8000}).should('be.visible') && cy.contains('Available').should('be.visible');
    cy.contains(cluster).click();
  }

  firstLogin() {
    cy.get('input').type(Cypress.env('password'));
    cy.clickButton('Log in with Local User');
    cy.contains('I agree').click('left');
    cy.clickButton('Continue');
    cy.contains("Getting Started", {timeout: 10000});
  }
}
