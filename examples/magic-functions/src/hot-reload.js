const ws = new WebSocket('ws://localhost:1234');

ws.onmessage = (evt) => {
  if (evt.data === 'refresh') {
    window.location.reload();
  }
}