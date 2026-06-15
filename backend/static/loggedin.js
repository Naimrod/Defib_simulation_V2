 // Get username from URL or sessionStorage
    const urlParams = new URLSearchParams(window.location.search);
    let username = urlParams.get('username');
    
    if (!username) {
        username = sessionStorage.getItem('username');
    }
    
    if (!username) {
        // No username found, redirect to login
        window.location.href = '/';
    }
    
    // Store and display username
    sessionStorage.setItem('username', username);
    document.getElementById('current-username').textContent = username;
    
    // Add username to all menu links
    document.querySelectorAll('a.menu-card').forEach(link => {
        const href = link.getAttribute('href');
        if (href && !href.includes('username=')) {
            link.href = `${href}?username=${encodeURIComponent(username)}`;
        }
    });
    
    function logout() {
        sessionStorage.removeItem('username');
        window.location.href = '/';
    }

    async function launchSimulator() {
        const data = {
            username: sessionStorage.getItem('username') || 'anonymous',
        }
        try {
            const response = await fetch('http://192.168.8.4:8000/api/prepare_session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (response.ok) {
                window.location.href = "http://192.168.8.4:3000/simulator?username=" + encodeURIComponent(username);
            } else {
                alert('Failed to prepare session. Please try again.');
            }
        }  
        catch (error) {
            console.error('Error preparing session:', error);
        }
    }