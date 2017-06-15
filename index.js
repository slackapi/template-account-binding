require('dotenv').config();
const http = require('http');
const config = require('config');
const express = require('express');
const level = require('level');
const sublevel = require('level-sublevel');

const usersFactory = require('./lib/users');
const messageFactory = require('./lib/message');
const webRouterFactory = require('./routers/web');
const apiRouterFactory = require('./routers/api');

const db = sublevel(level('./data/db'));

const users = usersFactory(db.sublevel('users'));
// message represents a shared resource that users must be authenticated/authorized to access
const message = messageFactory(db.sublevel('message'), users);

const webRouter = webRouterFactory(db, users, message);
const apiRouter = apiRouterFactory(users, message);

const app = express();

app.set('trust proxy', config.has('session.secure') ? config.get('session.secure') : false);
app.set('view engine', 'pug');

app.use('/api', apiRouter);
app.use('/', webRouter);

const server = http.createServer(app);
const port = config.has('server.internalPort') ? config.get('server.internalPort') : config.get('server.port');

// eslint-disable-next-line no-console
server.listen(port, () => { console.log(`server listening on port ${port}`); });
