const express = require('express');
const cors = require('cors');
const { ExpressPeerServer } = require('peer');
const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(cors());
const server = app.listen(9000, () => console.log('broker en 9000'));
const peerServer = ExpressPeerServer(server, { debug: false });
app.use('/', peerServer);
