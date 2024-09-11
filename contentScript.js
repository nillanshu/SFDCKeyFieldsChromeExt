console.log("Salesforce Inspector content script loaded");

function handleTabChange() {
    const urlPattern = /\.lightning\.force\.com\/lightning\/r\//;
    if (urlPattern.test(window.location.href)) {
        chrome.runtime.sendMessage({ action: 'getSessionCookie' }, (response) => {
            if (response.error) {
                console.error('Error getting session cookie:', response.error);
                return;
            }
            injectInspector(response.accessToken);
        });
    } else {
        removeInspector();
    }
}

function injectInspector(accessToken) {
    if (document.getElementById('key-fields-inspector')) {
        return; // Inspector is already injected
    }

    const inspectorDiv = document.createElement('div');
    inspectorDiv.id = 'key-fields-inspector';
    inspectorDiv.innerHTML = `
        <div class="help-container" id="help-container">
            <div class="help-content">
                <div>Need Help</div>
                <div style="padding-right: 5px; padding-left: 5px;">?</div>
            </div>
        </div>
        
        <div id="modal" class="fixed-left" style="display: none;">
            <header class="fixed-left-header">
                <h3 class="slds-text-heading_medium key-fields-header">Key Fields</h3>
            </header>
            <div class="fixed-left-content slds-p-around_medium">
                <div class="search-container" style="position: relative; width: 100%; margin-bottom: 10px;">
                    <input type="text" id="search-bar" placeholder="Search fields here..." style="width: 100%; padding: 8px; padding-right: 30px;">
                    <span class="search-icon" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: default;">
                        🔍
                    </span>
                </div>
                <div id="datatable-container" class="datatable-container"></div>
                <p id="no-fields-message" style="display: none;">No key fields available.</p>
                <p id="error-message" style="display: none; color: red;">Error fetching key fields. Please check your session.</p>
            </div>
        </div>
    `;
    document.body.appendChild(inspectorDiv);

    // Fetch modal and key elements
    const helpContainer = document.getElementById('help-container');
    const modal = document.getElementById('modal');
    const datatableContainer = document.getElementById('datatable-container');
    const noFieldsMessage = document.getElementById('no-fields-message');
    const errorMessage = document.getElementById('error-message');
    const searchBar = document.getElementById('search-bar');

    let keyFields = null; // Original key fields data
    let filteredKeyFields = null; // Filtered key fields data

    // Toggle modal visibility on clicking "Need Help"
    helpContainer.addEventListener('click', function () {
        if (modal.style.display === 'block') {
            modal.style.display = 'none'; // Hide the modal if it's already visible
        } else {
            modal.style.display = 'block'; // Show the modal
            fetchKeyFields(); // Fetch key fields data
        }
    });

    // Function to fetch key fields data using Salesforce REST API
    function fetchKeyFields() {
        const pathSegments = window.location.pathname.split('/');
        const objectApiName = pathSegments[pathSegments.length - 3]; // Get the third-to-last segment
        const recordId = pathSegments[pathSegments.length - 2]; // Get the second-to-last segment
        const originalUrl = window.location.href;
        let instanceUrl;

        if (originalUrl.includes('sandbox')) {
            // Handle sandbox environment
            instanceUrl = originalUrl.replace(/\.sandbox\..*$/, '.sandbox.my.salesforce.com');
        } else {
            // Handle production environment
            instanceUrl = originalUrl.replace(/\.develop\..*$/, '.develop.my.salesforce.com');
        }

        // Log access token and instance URL
        console.log('Access Token:', accessToken);
        console.log('Instance URL:', instanceUrl);
        console.log('Object API Name:', objectApiName);

        // Make the API request
        fetch(`${instanceUrl}/services/data/v52.0/sobjects/${objectApiName}/${recordId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json', // Add Content-Type header
                'Accept': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.errorCode === 'INVALID_SESSION_ID') {
                console.error('Invalid Session:', data);
                errorMessage.style.display = 'block';
                noFieldsMessage.style.display = 'none';
                datatableContainer.innerHTML = '';
                return;
            }
            keyFields = Object.entries(data).map(([key, value]) => ({
                fieldName: key,
                fieldValue: typeof value === 'object' ? JSON.stringify(value) : value
            }));
            filteredKeyFields = [...keyFields]; // Initialize filteredKeyFields with the original data
            renderKeyFields(filteredKeyFields);
        })
        .catch(error => {
            console.error('Error fetching key fields:', error);
            errorMessage.style.display = 'block';
            noFieldsMessage.style.display = 'none';
            datatableContainer.innerHTML = '';
        });
    }

    // Function to render key fields in a table format
    function renderKeyFields(fields) {
        if (fields && fields.length > 0) {
            datatableContainer.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Field Name</th>
                            <th>Field Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${fields.map(field => `
                            <tr>
                                <td>${field.fieldName}</td>
                                <td>${field.fieldValue}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            noFieldsMessage.style.display = 'none'; // Hide "No fields available" message
            errorMessage.style.display = 'none'; // Hide error message
        } else {
            datatableContainer.innerHTML = ''; // Clear the table
            noFieldsMessage.style.display = 'block'; // Show "No fields available" message
            errorMessage.style.display = 'none'; // Hide error message
        }
    }

    // Add event listener to search bar for filtering key fields
    searchBar.addEventListener('input', function () {
        const searchTerm = searchBar.value.toLowerCase();
        filteredKeyFields = keyFields.filter(field => 
            field.fieldName.toLowerCase().includes(searchTerm) || 
            field.fieldValue.toLowerCase().includes(searchTerm)
        );
        renderKeyFields(filteredKeyFields);
    });
}

function removeInspector() {
    const inspectorDiv = document.getElementById('key-fields-inspector');
    if (inspectorDiv) {
        inspectorDiv.remove();
    }
}

// Listen for tab updates and activations
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'checkReady') {
        sendResponse({ ready: true });
        return;
    }
    if (request.action === 'injectInspector') {
        injectInspector(request.accessToken);
    } else if (request.action === 'removeInspector') {
        removeInspector();
    }
});

handleTabChange();