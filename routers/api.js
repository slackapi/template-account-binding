const config = require('config');
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const util = require('../lib/util');

const slackVerificationToken = config.get('slack.verificationToken');
const httpClient = axios.create({
  headers: { 'User-Agent': util.packageIdentifier() },
});

function verifySlack(req, res, next) {
  // Assumes this application is is not distributed and can only be installed on one team.
  // If this assumption does not hold true, then we would modify this code as well as
  // the data model to store individual team IDs, verification tokens, and access tokens.
  if (req.body.token === slackVerificationToken) {
    next();
  } else {
    next(new Error('Could not verify the request originated from Slack.'));
  }
}

module.exports = (users, message) => {
  const commands = {
    '/read-message': ({ user }) => message.getMessage(user).then(m => `The message is: ${m}`),
    '/write-message': ({ user, text }) => message.setMessage(text, user).then(m => `The message has been set: ${m}`),
  };

  const api = express.Router();

  api.use(bodyParser.urlencoded({ extended: false }));

  api.post('/slack/command', verifySlack, (req, res) => {
    // Respond to Slack immediately
    // There's no reason to wait, we will handle error cases asynchronously.
    // This value will ensure that the command is made visible to the entire channel.
    res.json({ response_type: 'in_channel' });

    // Authenticate the Slack user
    // An assumption is being made: all commands require authentication
    users.findBySlackId(req.body.user_id)
      .then((user) => {
        // Execution of command
        const command = commands[req.body.command];
        if (!command) {
          throw new Error(`Cannot understand the command: \`${req.body.command}\``);
        }
        return command.call(undefined, {
          user,
          text: req.body.text,
        });
      })
      .catch((error) => {
        // A helpful message for commands that will not complete because of failed user auth
        if (error.code === 'EUSERNOTFOUND') {
          // Start user association
          return users.beginSlackAssociation(req.body.user_id)
            .then(() => `Sorry <@${req.body.user_id}>, you cannot run \`${req.body.command}\` until after you authenticate. I can help you, just check my DM for the next step, and then you can try the command again.`);
        }
        // For all other errors, the in-channel response will be the error's message
        return error.message;
      })
      .then(response => httpClient.post(req.body.response_url, {
        response_type: 'in_channel',
        text: response,
      }));
  });

  return api;
};
