fetch('http://localhost:3000/portal/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'next-action': 'replace_me'
  }
})
