function login() {
        const username = document.getElementById('username').value;
        if (username) {
            // Store username in sessionStorage and redirect to loggedin page
            sessionStorage.setItem('username', username);
            window.location.href = `/loggedin?username=${encodeURIComponent(username)}`;
        } else {
            alert('Please enter a username to connect.');
        }
    }
    
    // Check if user is already logged in, redirect to loggedin page
    if (sessionStorage.getItem('username')) {
        window.location.href = `/loggedin?username=${encodeURIComponent(sessionStorage.getItem('username'))}`;
    }