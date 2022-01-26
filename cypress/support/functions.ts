import 'cypress-file-upload';

// Generic functions

// Log into Rancher
Cypress.Commands.add('login', (username = Cypress.env('username'), password = Cypress.env('password'), cacheSession = Cypress.env('cache_session')) => {
  const login = () => {
    cy.intercept('POST', '/v3-public/localProviders/local*').as('loginReq');
    cy.visit('/auth/login');

    cy.byLabel('Username')
      .focus()
      .type(username);

    cy.byLabel('Password')
      .focus()
      .type(password);

    cy.get('button').click();
    cy.wait('@loginReq');
    cy.contains("Getting Started", {timeout: 10000}).should('be.visible');
  };

  if (cacheSession) {
    cy.session([username, password], login);
  } else {
    login();
  }
});

// Search fields by label
Cypress.Commands.add('byLabel', (label) => {
  cy.get('.labeled-input').contains(label).siblings('input');
});

// Search button by label
Cypress.Commands.add('clickButton', (label) => {
  cy.get('.btn').contains(label).click();
});

// Ensure that we are in the desired menu
Cypress.Commands.add('clickMenu', (label) => {
  cy.get('.label').contains(label).click();
  cy.get('header').should('contain', label);
});

// Confirm the delete operation
Cypress.Commands.add('confirmDelete', (namespace) => {
  if (namespace) cy.get('#confirm').type(namespace);

  // Always unbind a service before deletion
  cy.get('.card-body').then(($cardBody) => {
    if ($cardBody.find('.checkbox-container').length) {
      cy.contains('Unbind').click();
    }
  });

  // Confirm the deletion
  cy.get('.card-actions').contains('Delete').click();
});

// Check the status of the running stage
Cypress.Commands.add('checkStageStatus', ({numIndex, timeout=6000, status='Success'}) => {
  var getScope = ':nth-child(' + numIndex + ') > .col-badge-state-formatter > .status > .badge';
  cy.get(getScope, {timeout: timeout}).contains(status).should('be.visible');
});

// Insert a value in a field *BUT* force a clear before!
Cypress.Commands.add('typeValue', ({label, value, noLabel}) => {
  if (noLabel === true) {
    cy.get(label).focus().clear().type(value);
  } else {
    cy.byLabel(label).focus().clear().type(value);
  }
});

// Make sure we are in the desired menu inside a cluster (local by default)
// You can access submenu by giving submenu name in the array
// ex:  cy.clickClusterMenu(['Menu', 'Submenu'])
Cypress.Commands.add('clickClusterMenu', (listLabel: string[]) => {
  listLabel.forEach(label => cy.get('nav').contains(label).click());
});

// Insert a key/value pair
Cypress.Commands.add('typeKeyValue', ({key, value}) => {
  cy.get(key).clear().type(value);
});

// Get the detail of an element
Cypress.Commands.add('getDetail', ({name, type, namespace='workspace'}) => {
  var dataNodeId = '[data-node-id="' + type + '/' + namespace + '/' + name + '"]';
  cy.get(dataNodeId).within(() => {
    cy.get('td').contains(name).click();
  });
});

// Application functions

// Create an Epinio application
Cypress.Commands.add('createApp', ({appName, archiveName, sourceType, customPaketoImage, route, addVar, instanceNum=1, serviceName, shouldBeDisabled}) => {
  var envFile = 'read_from_file.env';  // File to use for the "Read from File" test

  cy.clickMenu('Applications');
  cy.clickButton('Create');
  cy.typeValue({label: 'Name', value: appName});

  // Only if we want to check that 'Next' button is disabled
  // This could happen only if there is no namespace defined
  if (shouldBeDisabled === true) {
    cy.get('.btn').should('contain', 'Next').and('be.disabled');
    return;  // Of course, in that case the test is done if button is disabled
  }

  // Change default route if needed
  if (route) {
    cy.get('.btn').contains('Add').click();
    cy.typeValue({label: '.value > input', value: route, noLabel: true});
  }

  // Add an environment variable
  if (addVar === 'ui') {
    cy.get('.key-value > .footer > .add').click();
    cy.typeKeyValue({key: '.kv-item.key', value: 'PORT'});
    cy.typeKeyValue({key: '.kv-item.value', value: '8080'});
  } else if (addVar === 'file') {
    cy.get('input[type="file"]').attachFile({filePath: envFile});

    // Check the entered values
    cy.get('.key > input').should('have.value', 'PORT');
    cy.get('.no-resize').should('have.value', '8080');
  }

  // Set the desired number of instances
  cy.typeValue({label: 'Instances', value: instanceNum});
  cy.clickButton('Next');

  // Select the Source Type if needed
  if (sourceType) {
    cy.get('.labeled-select').click();
    cy.contains(sourceType, {timeout: 120000}).click();
    if (sourceType === 'Container Image') cy.typeValue({label: 'Image', value: archiveName});
    if (sourceType === 'Git URL') {
      cy.typeValue({label: 'URL', value: archiveName});
      cy.typeValue({label: 'Branch', value: 'main'});
    }
  } else {
    // Use the default one and upload the test application
    cy.get('input[type="file"]').attachFile({filePath: archiveName, encoding: 'base64', mimeType: 'application/octet-stream'});
  }

  // Use a custom Paketo Build Image if needed
  if (customPaketoImage) {
    cy.contains('Custom Image').click();
    cy.typeValue({label: '.no-label', value: customPaketoImage, noLabel: true});
  }

  // Continue with the next screen
  cy.clickButton('Next');

  // Bind a service if needed
  if (serviceName) {
    cy.wait(500);  // We need to wait a little for the listbox to be updated
    cy.get('.labeled-select').click();
    cy.contains(serviceName, {timeout: 120000}).click();
  }

  // Start application creation
  cy.clickButton('Create');

  // Check that each steps are succesfully done
  cy.checkStageStatus({numIndex: 1});
  cy.checkStageStatus({numIndex: 2});
  if (sourceType !== 'Container Image') {
    cy.checkStageStatus({numIndex: 3, timeout: 240000});
    cy.checkStageStatus({numIndex: 4, timeout: 120000});
  }

  // Application is created!
  cy.clickButton('Done');
});

// Ensure that the application is up and running
Cypress.Commands.add('checkApp', ({appName, namespace='workspace', route, checkVar, checkService, dontCheckRouteAccess}) => {
  cy.clickMenu('Applications');

  // Go to application details
  cy.getDetail({name: appName, type: 'applications', namespace: namespace});

  // Make sure the application is in running state
  cy.get('header').should('contain', appName).and('contain', 'Running');

  // Make sure all application instances are up
  cy.get('.numbers', {timeout: 160000}).should('contain', '100%');

  // If needed. check that the correct namespace has been used
  if (namespace) cy.contains('Namespace: ' + namespace).should('be.visible');

  // If needed, check that there is one environment variable
  if (checkVar) cy.contains('1 Environment Vars').should('be.visible');

  // Check binded services
  var serviceNum = 0;
  if (checkService === true) serviceNum = 1;
  cy.contains(serviceNum + ' Services', {timeout: 24000}).should('be.visible');

  // Check the application route
  var appRoute = 'https://' + appName + '.' + Cypress.env('system_domain');
  if (route) appRoute = route;  // Supersede the app route if needed
  cy.contains(appRoute).should('be.visible');

  // Check that the application website is responding if needed
  if (dontCheckRouteAccess === false) {
    cy.contains(appRoute).invoke('attr', 'href').then(appLink => {
      cy.request({
        url: appLink,
      }).then(httpAnswer => {
        // Answer status code should be 200
        expect(httpAnswer.status).to.eq(200);
      });
    });
  }
});

// Delete an Epinio application
Cypress.Commands.add('deleteApp', ({appName, state='Running'}) => {
  cy.clickMenu('Applications');
  cy.contains(state + ' ' + appName).click('left');
  cy.clickButton('Delete');
  cy.confirmDelete();

  // Check that the application has effectively been destroyed
  cy.contains(appName, {timeout: 60000}).should('not.exist');
});

// Namespace functions

// Create an Epinio namespace
Cypress.Commands.add('createNamespace', (namespace) => {
  cy.clickMenu('Namespaces');
  cy.clickButton('Create');
  cy.typeValue({label: 'Name', value: namespace});
  cy.clickButton('Create');

  // Check that the namespace has effectively been created
  cy.contains(namespace).should('be.visible');
});

// Delete an Epinio namespace
Cypress.Commands.add('deleteNamespace', ({namespace, appName}) => {
  cy.clickMenu('Namespaces');
  cy.get('[data-title="Name"]').contains(namespace).click();
  cy.clickButton('Delete');
  cy.confirmDelete(namespace);

  // Check that the namespace has effectively been destroyed
  cy.contains(namespace, {timeout: 60000}).should('not.exist');

  // If needed, make sure the application is also deleted
  if (appName) {
    cy.clickMenu('Applications');
    cy.contains(appName).should('not.exist');
  }
});

// Services functions

// Create a service
Cypress.Commands.add('createService', ({serviceName, fromFile, namespace='workspace'}) => {
  var serviceFile = 'read_from_file.service';  // File to use for the "Read from File" test

  cy.clickMenu('Services');
  cy.clickButton('Create');

  // Name of the service
  cy.typeValue({label: 'Name', value: serviceName});

  // Enter Service Data
  if (fromFile === true) {
    cy.clickButton('Remove');
    cy.get('input[type="file"]').attachFile({filePath: serviceFile});

    // Check the entered values
    cy.get('.key > input').should('have.value', 'service_var');
    cy.get('.no-resize').should('have.value', 'service_value');
  } else {
    cy.typeKeyValue({key: '.kv-item.key', value: 'test_data'});
    cy.typeKeyValue({key: '.kv-item.value', value: 'test_value'});
  }

  // We need this little trick before clicking on 'Create' (why?)
  cy.wait(500);
  cy.clickButton('Create');

  // Check that the service has effectively been created
  cy.contains(serviceName).should('be.visible');
});

// Delete a service
Cypress.Commands.add('deleteService', ({serviceName, namespace='workspace'}) => {
  cy.clickMenu('Services');

  // Search for the correct service (same name can be used on different namespace)
  cy.getDetail({name: serviceName, type: 'services', namespace: namespace});

  // Make sure we are in the details page
  cy.get('header').should('contain', 'Services:').and('contain', serviceName);

  // Select the 3dots button and delete the service
  cy.get('.role-multi-action').click();
  cy.contains('Delete').click();
  cy.confirmDelete();

  // Check that the service has effectively been destroyed
  cy.contains(serviceName).should('not.exist');
});

// Bind a service to an existing application
Cypress.Commands.add('bindService', ({appName, serviceName, namespace='workspace'}) => {
  cy.clickMenu('Applications');

  // Go to application details
  cy.getDetail({name: appName, type: 'applications', namespace: namespace});

  // Make sure we are in the details page
  cy.get('header').should('contain', 'Applications:').and('contain', appName);

  // Select the 3dots button and edit configuration
  cy.get('.role-multi-action').click();
  cy.contains('Edit Config').click();

  // Select the Services tab
  cy.get('#services').click();

  // Select the service
  cy.wait(500);  // We need to wait a little for the listbox to be updated
  // 'multiple' and 'force' are needed here
  // TODO: try to find a better way for this
  cy.get('.labeled-select').click({multiple: true, force: true});
  cy.contains(serviceName, {timeout: 120000}).click();

  // And save
  cy.clickButton('Save');
  // Strange sporadic issues happen here
  // The wait call seems to improve test realibility
  cy.wait(6000);
});

// Epinio installation functions

// Add the Epinio Helm repo
Cypress.Commands.add('addHelmRepo', ({repoName, repoUrl}) => {
  cy.clickClusterMenu(['Apps & Marketplace', 'Repositories'])

  // Make sure we are in the 'Repositories' screen (test failed here before)
  cy.contains('header', 'Repositories', {timeout: 8000}).should('be.visible');
  cy.contains('Create').should('be.visible');

  cy.clickButton('Create');
  cy.contains('Repository: Create').should('be.visible');
  cy.typeValue({label: 'Name', value: repoName});
  cy.typeValue({label: 'Index URL', value: repoUrl});
  cy.clickButton('Create');
});

// Install Epinio via Helm
Cypress.Commands.add('epinioInstall', ({s3, extRegistry}) => {
  cy.clickClusterMenu(['Apps & Marketplace', 'Charts']);
  
  // Make sure we are in the chart screen (test failed here before)
  cy.contains('header', 'Charts', {timeout: 8000}).should('be.visible');
  
  // Install epinio-installer chart
  cy.contains('epinio-installer').click();
  cy.contains('Charts: epinio-installer').should('be.visible');
  cy.clickButton('Install');

  // Namespace where installation will happen
  cy.typeValue({label: 'Name', value: 'epinio-install'});
  cy.clickButton('Next');
  
  // Configure custom domain
  cy.typeValue({label: 'Domain', value: Cypress.env('system_domain')});

  // Configure cors setting
  cy.typeValue({label: 'Access control allow origin', value: Cypress.env('cors')});

  // Cert Manager and ingress controler already installed by Rancher
  cy.contains('CertManager').click();
  cy.contains('ingress controller').click();

  // Configure external registry
  if (extRegistry === true) {
    cy.contains('a', 'External registry').click();
    cy.contains('Use an external registry').click();
    cy.typeValue({label: 'External registry url', value: 'registry.hub.docker.com'});
    cy.typeValue({label: 'External registry username', value: Cypress.env('external_reg_username')});
    cy.typeValue({label: 'External registry password', value: Cypress.env('external_reg_password')});
    cy.typeValue({label: 'External registry namespace', value: 'juadk'});
  }

  // Configure s3 storage
  if (s3 === true) {
    cy.contains('a', 'External S3 storage').click();
    cy.contains('Use an external s3 storage').click();
    cy.typeValue({label: 'S3 endpoint', value: 's3.amazonaws.com'});
    cy.typeValue({label: 'S3 access key id', value: Cypress.env('s3_key_id')});
    cy.typeValue({label: 'S3 access key secret', value: Cypress.env('s3_key_secret')});
    cy.typeValue({label: 'S3 bucket', value: 'epinio-ci'});
    cy.contains('S3 use SSL').click();
  }

  // Install and check we get successfull installation message with a timeout long enough
  cy.clickButton('Install');
  cy.contains('SUCCESS: helm install', { timeout: 600000 }).should('be.visible');
  cy.get('.tab > .closer').click();
});

// Uninstall Epinio via Helm
Cypress.Commands.add('epinioUninstall', () => {
  cy.clickClusterMenu(['Apps & Marketplace', 'Installed Apps'])

  // Make sure we are in the 'Installed Apps' screen (test failed here before)
  cy.contains('header', 'Installed Apps', {timeout: 8000}).should('be.visible');
  cy.contains('epinio-installer:').click();
  cy.clickButton('Delete');
  cy.confirmDelete();
  cy.contains('SUCCESS: helm uninstall', {timeout: 300000}).should('be.visible');
});

// Remove the Epinio Helm repo
Cypress.Commands.add('removeHelmRepo', () => {
  cy.clickClusterMenu(['Apps & Marketplace', 'Repositories']);

  // Make sure we are in the 'Repositories' screen (test failed here before)
  cy.contains('header', 'Repositories', {timeout: 8000}).should('be.visible');
  cy.contains('epinio-repo').click();
  // Using three dots menu to delete the repo
  // TODO: Check if we can click checkbox instead
  cy.contains('Repository: epinio-repo').should('be.visible');
  cy.get('.role-multi-action').click();
  cy.contains('Delete').click();
  cy.confirmDelete();
});
