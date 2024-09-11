chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSessionCookie') {
        const originalDomain = new URL(sender.tab.url).hostname;
        let domain;

        if (originalDomain.includes('sandbox')) {
            // Handle sandbox environment
            domain = originalDomain.replace(/\.sandbox\..*$/, '.sandbox.my.salesforce.com');
        } else {
            // Handle production environment
            domain = originalDomain.replace(/\.develop\..*$/, '.develop.my.salesforce.com');
        }

        console.log(`Attempting to retrieve cookies for domain: ${domain}`);
        chrome.cookies.getAll({ domain }, (cookies) => {
            if (chrome.runtime.lastError) {
                console.error('Error accessing cookies:', chrome.runtime.lastError.message);
                sendResponse({ error: chrome.runtime.lastError.message });
                return;
            }
            console.log('Retrieved cookies:', cookies);
            const sessionCookie = cookies.find(cookie => cookie.name === 'sid');
            if (sessionCookie) {
                console.log('Session cookie found:', sessionCookie);
                sendResponse({ accessToken: sessionCookie.value });
            } else {
                console.error('Session cookie not found');
                sendResponse({ error: 'Session cookie not found' });
            }
        });
        return true; // Indicates that the response will be sent asynchronously
    }
});